const graphql = require('graphql-anywhere').default
const { gql } = require('graphql-tag')
const queryKey = require('../../queryManager/QueryKey')
const { applyWhere, applyCondition, applyOrderBy, applySlice } = require('../Filter.js')

const CURSOR = '__cursor'
const COLLECTION_PREFIX = '@@delv/collection:'
const LIST_PREFIX = '@@delv/list:'

function CacheByType({emitter, storage, typeMap, reverseReferences = require('../ReverseReferences')(typeMap), mutationActions = require('../MutationActions')()}){

    // listKey -> childType for every root list field whose membership (the
    // ordered set of ids it has returned) has been recorded. Lets mutations
    // maintain that membership without scanning opaque storage.
    const collections = new Map()
    const keyOf = (type) => typeMap.getKey ? typeMap.getKey(type) : 'id'
    const connectionCounts = require('../ConnectionCounts')(storage, keyOf)

    const getName = () => 'type'

    // Classify a mutation root field so create appends to and delete evicts from
    // recorded membership. Configured mutationActions win; otherwise fall back to
    // PostGraphile naming. Normal query fields (allBooks, etc.) match none of the
    // prefixes and fall through to 'query'.
    const classify = (fieldName) => {
        const configured = mutationActions.resolve(fieldName)
        if(configured !== undefined){
            return configured
        }
        if(fieldName.startsWith('create')){
            return 'create'
        }
        if(fieldName.startsWith('delete')){
            return 'delete'
        }
        if(fieldName.startsWith('update')){
            return 'update'
        }
        return 'query'
    }

    // Pull the mutated entity(ies) out of a payload wrapper (e.g.
    // CreateBookPayload -> { book }). Only the payload's direct entity children
    // count: we deliberately do not recurse into an entity's relations so that
    // creating a book does not append its author/genre to their collections.
    const mutationEntities = (payload) => {
        const entities = []
        const collect = (node) => {
            if(node == null || typeof node !== 'object'){
                return
            }
            if(node instanceof Array){
                node.forEach(collect)
                return
            }
            if(node['__typename'] && node[keyOf(node['__typename'])] != null){
                entities.push({id: node[keyOf(node['__typename'])], type: node['__typename']})
                return
            }
            for(let key in node){
                collect(node[key])
            }
        }
        if(payload && typeof payload === 'object'){
            for(let field in payload){
                // Payload query contains related data, not created/deleted entities.
                if(field !== '__typename' && field !== 'query'){
                    collect(payload[field])
                }
            }
        }
        return entities
    }

    // Membership arrays are replaced, never mutated, so optimistic layers can
    // restore the previous array.
    const appendMembership = (entities) => {
        entities.forEach(({id, type}) => {
            for(let [colKey, colType] of collections){
                if(colType !== type){
                    continue
                }
                const membership = storage.getAbsolute(colKey)
                if(Array.isArray(membership) && !membership.some((member) => String(member) === String(id))){
                    storage.setAbsolute(colKey, [...membership, id])
                }
            }
            emitter.updateType(type)
        })
    }

    const evictMembership = (entities) => {
        entities.forEach(({id, type}) => {
            storage.evict(id, type)
            for(let [colKey, colType] of collections){
                if(colType !== type){
                    continue
                }
                const membership = storage.getAbsolute(colKey)
                if(Array.isArray(membership)){
                    const next = membership.filter((member) => String(member) !== String(id))
                    if(next.length !== membership.length){
                        storage.setAbsolute(colKey, next)
                    }
                }
            }
            emitter.updateType(type)
        })
    }

    // Hand-written values may omit __typename on nested relations; the type
    // map knows it, and cacheNode needs it to normalize them.
    const withTypenames = (type, node) => {
        const definition = typeMap.getTypeDefinition(type) || {}
        const filled = {...node}
        for(let field in definition){
            if(node[field] !== undefined){
                filled[field] = relationWithTypenames(definition[field], node[field])
            }
        }
        return filled
    }

    const relationWithTypenames = (type, value) => {
        if(value == null || typeof value !== 'object'){
            return value
        }
        if(Array.isArray(value)){
            return value.map((item) => relationWithTypenames(type, item))
        }
        if(value.nodes){
            return {...value, nodes: relationWithTypenames(type, value.nodes)}
        }
        if(value.edges){
            return {...value, edges: value.edges.map((edge) => (
                edge && edge.node ? {...edge, node: relationWithTypenames(type, edge.node)} : edge
            ))}
        }
        const typename = value.__typename || type
        return withTypenames(typename, {...value, __typename: typename})
    }

    // Write one entity the way create*/update*/delete* mutation payloads are
    // written: normalized, with reverse references and membership maintained.
    const writeEntity = ({action, type, id, values = {}}) => {
        if(action === 'delete'){
            evictMembership([{id, type}])
            return true
        }
        cacheNode({node: withTypenames(type, {...values, __typename: type, [keyOf(type)]: id})})
        if(action === 'create'){
            appendMembership([{id, type}])
        }
        emitter.updateType(type)
        return true
    }

    const collectionKey = (query, variables, fieldName) => (
        COLLECTION_PREFIX + queryKey(query, variables) + ':' + fieldName
    )

    // Root lists behave like a list field on the Query root: one membership
    // per field, shared by every argument set and filtered in memory.
    const listKey = (fieldName) => LIST_PREFIX + fieldName

    const access = {
        getKey: (node) => node[keyOf(node.__typename)],
        getType: (node, field) => typeMap.getFields ? typeMap.getFields(node.__typename)[field] : undefined,
        isRelation: (node, field) => Boolean((typeMap.getTypeDefinition(node.__typename) || {})[field]),
        getValue: (node, field) => {
            const childType = (typeMap.getTypeDefinition(node.__typename) || {})[field]
            if(!childType) return node[field]
            const bucket = storage.get(childType)
            const ids = node[field]
            return Array.isArray(ids) ? ids.map((id) => bucket && bucket.get(id)).filter(Boolean)
                : bucket && bucket.get(ids)
        }
    }

    const filterNodes = (nodes, args) => {
        if(!args) return nodes
        let value = applyCondition(nodes, args.condition)
        value = applyWhere(value, args.where, access)
        value = applyWhere(value, args.filter, access)
        value = applyOrderBy(value, args.order_by || args.orderBy, access)
        return applySlice(value, args.first, args.offset)
    }

    // Only a schema list signature (e.g. `[AssetTag!]!`) proves a bare list.
    // Connections and legacy relationship-only maps keep the wrapper.
    const isList = (type, field) => {
        const signature = typeMap.getFieldType ? typeMap.getFieldType(type, field) : undefined
        return typeof signature === 'string' && signature.startsWith('[')
    }

    const read = ({query, variables}) => {
        const resolver = (fieldName, root, args, context, info) => {
            if(fieldName === '__typename'){
                return
            }

            if(root === storage){
                const type = typeMap.getTypeDefinition('Query')
                const childType = type[fieldName]
                const metadata = connectionCounts.read({query, variables}, null, fieldName, args)
                const bucket = storage.get(childType)
                const entity = storage.getAbsolute(collectionKey(context.queryString, context.variables, fieldName))
                if(entity != null) return bucket && bucket.get(entity)
                // Only delete mutations remove ids from a recorded membership.
                const membership = storage.getAbsolute(listKey(fieldName))
                if(Array.isArray(membership)){
                    const nodes = membership
                        .map((id) => (bucket ? bucket.get(id) : undefined))
                        .filter((node) => node != null)
                    if(isList('Query', fieldName)) return filterNodes(nodes, args)
                    return {...metadata, getValues: () => nodes, connectionArgs: args}
                }
                if(!bucket && metadata.totalCount !== undefined) return metadata
                if(!bucket){
                    // Nothing of this type has ever been cached: signal a miss so
                    // cache-first falls through to the network instead of
                    // resolving to an empty result.
                    throw new Error(`delv cache miss: no cached "${childType}" for query field "${fieldName}"`)
                }
                if(isList('Query', fieldName)) return filterNodes(bucket.getValues(), args)
                return {...metadata, getValues: bucket.getValues, connectionArgs: args}
            }

            if(fieldName === 'edges' || fieldName === 'nodes'){
                let value = root

                if(root && root.getValues){
                    value = root.getValues()
                }
                if(root && root.connectionArgs){
                    value = filterNodes(value, root.connectionArgs)
                }
                return value
            }

            if(fieldName === 'node'){
                return root
            }

            if(fieldName === 'cursor'){
                return root ? root[CURSOR] : null
            }

            if(info.isLeaf){
                return root ? root[fieldName] : null
            }

            const rootType = root['__typename']
            const type = typeMap.getTypeDefinition(rootType)
            const childType = type[fieldName]
            const metadata = connectionCounts.read({query, variables}, root, fieldName, args)
            if(root[fieldName] instanceof Array){
                const childChoices = storage.get(childType)
                const nodes = filterNodes(root[fieldName]
                    .map((id) => childChoices && childChoices.get(id))
                    .filter((node) => node != null), args)
                if(isList(rootType, fieldName)) return nodes
                // Return a connection-shaped wrapper (not a bare array) so the
                // nested `nodes`/`edges` selection resolves once against the list
                // instead of graphql-anywhere mapping the array element-by-element.
                // Inferred reverse references have no cardinality in legacy
                // type maps. Support a singular selection as well as nodes/edges.
                return {...nodes[0], ...metadata, getValues: () => nodes}
            }else{
                const childChoices = storage.get(childType)
                const foreignId = root[fieldName]
                if(!childChoices || foreignId == null){
                    if(metadata.totalCount !== undefined) return metadata
                    return null
                }
                return childChoices.get(foreignId)
            }
        }

        return graphql(resolver, gql `${query}`, storage, {storage:storage, query:true, queryString:query, variables}, variables)
    }

    const cacheUnknown = ({node, ...other}) => {
        if(node == null){
            return node
        }
        if(node instanceof Array){
            return node.map((item) => cacheUnknown({node:item, ...other}))
        }
        if(node.nodes && node.edges){
            throw new Error('Both nodes and edges detected on a connection, choose one.')
        }
        if(node.nodes){
            return node.nodes.map((item) => cacheNode({node:item, ...other, parentIsCollection:true}))
        }
        if(node.edges){
            return node.edges.map((item) => {
                let child = item.node
                if(item.cursor != null){
                    child = {...item.node, [CURSOR]:item.cursor}
                }
                return cacheNode({node:child, ...other, parentIsCollection:true})
            })
        }
        if(node && node.__typename && node.__typename.endsWith('Connection') && node.totalCount !== undefined) return undefined
        return cacheNode({node, ...other})
    }

    // Nested lists are shared by every query that selects them, whatever its
    // arguments, so each response adds ids and reads filter in memory.
    const unionIds = (existing, incoming) => {
        const ids = Array.isArray(existing) ? [...existing] : []
        incoming.forEach((id) => {
            if(id != null && !ids.some((member) => String(member) === String(id))){
                ids.push(id)
            }
        })
        return ids
    }

    const cacheNode = ({node, parent, parentIsCollection = false, parentField, seen = new Set(), ...other}) => {
        if(node == null || typeof node !== 'object'){
            return node
        }
        const type = node['__typename']
        if(!type){
            console.warn('delv cache: skipping a node without a __typename.')
            return undefined
        }
        const id = node[keyOf(type)]
        if(id == null){
            // Not a normalizable entity (e.g. a mutation payload wrapper like
            // UpdateUserByIdPayload). Don't store it, but still recurse so the
            // entities nested inside it (the updated row) land in the cache.
            for(let key in node){
                const value = node[key]
                if(value && typeof value === 'object'){
                    cacheUnknown({node:value, seen, ...other})
                }
            }
            return undefined
        }

        const typeDefinition = typeMap.getTypeDefinition(type) || {}
        const parentType = parent ? parent['__typename'] : null
        const reverse = {}
        const inverse = parent && reverseReferences.resolve(parentType, parentField).inverse
        if(inverse && node[inverse] === undefined){
            const existing = storage.get(type)
            const previous = existing && existing.get(id)
            const ids = previous && previous[inverse]
            const cardinality = reverseReferences.isCollection(type, inverse)
            const collection = cardinality === undefined ? Array.isArray(ids) || !parentIsCollection : cardinality
            reverse[inverse] = collection
                ? [...new Set([...(ids == null ? [] : [].concat(ids)), parent[keyOf(parentType)]])]
                : parent[keyOf(parentType)]
        }
        if(Object.keys(reverse).length){
            storage.merge(id, type, {__typename:type, [keyOf(type)]:id, ...reverse})
            emitter.updateType(type)
        }

        const seenKey = `${type}:${id}`
        if(seen.has(seenKey)){
            return id
        }
        seen.add(seenKey)

        // shallow clone so the network response is never mutated in place
        const cached = {...node}
        const bucket = storage.get(type)
        const previous = (bucket && bucket.get(id)) || {}

        for(let key in typeDefinition){
            const value = node[key]
            if(value == null){
                continue
            }
            const reference = cacheUnknown({node:value, parent:node, parentField:key, seen, ...other})
            if(reference === undefined) delete cached[key]
            else if(Array.isArray(reference)) cached[key] = unionIds(previous[key], reference)
            else cached[key] = reference
        }

        emitter.updateType(type)
        storage.merge(id, type, cached)
        return id
    }

    const write = ({data, query, variables, connectionSource, ...other}) => {
        connectionCounts.write({query, variables, data: data.data, ...connectionSource})
        for(let key in data.data){
            if(key === '__typename'){
                continue
            }
            const value = data.data[key]
            const action = classify(key)
            const cached = cacheUnknown({node:value, ...other})
            if(action === 'create'){
                // The new entity is now normalized; append its id to every
                // recorded collection of its type so subscribed lists gain it.
                appendMembership(mutationEntities(value))
            }else if(action === 'delete'){
                // Remove the returned id from its bucket and every collection of
                // its type so subscribed lists drop it.
                evictMembership(mutationEntities(value))
            }else if(action === 'query' && query !== undefined && value && value[keyOf(value.__typename)] != null){
                storage.setAbsolute(collectionKey(query, variables, key), cached)
            }else if(query !== undefined && cached instanceof Array){
                const key0 = listKey(key)
                storage.setAbsolute(key0, unionIds(storage.getAbsolute(key0), cached))
                // Mark the collection's type changed so subscribers re-read
                // even when the result is now empty (nothing was cacheNode'd).
                const queryDef = typeMap.getTypeDefinition('Query') || {}
                const childType = queryDef[key]
                if(childType){
                    collections.set(key0, childType)
                    emitter.updateType(childType)
                }
            }
        }
        emitter.emitCacheUpdate()
    }

    return {
        read,
        write,
        writeEntity,
        getName
    }
}

module.exports = CacheByType
