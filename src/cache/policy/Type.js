const graphql = require('graphql-anywhere').default
const gql = require('graphql-tag')
const { applyWhere, applyOrderBy, applySlice } = require('../Filter.js')

const UID = 'id'
const CURSOR = '__cursor'

function CacheByType({emitter, storage, typeMap}){

    const getName = () => 'type'

    const read = ({query, variables}) => {
        const resolver = (fieldName, root, args, context, info) => {
            if(fieldName === '__typename'){
                return
            }

            if(context.query){
                const type = typeMap.getTypeDefinition('Query')
                const childType = type[fieldName]
                context.query = false
                if(args){
                    context.args = args
                }
                return storage.get(childType)
            }

            if(fieldName === 'edges' || fieldName === 'nodes'){
                let value = root

                if(root && root.getValues){
                    value = root.getValues()
                }
                if(context.args){
                    const { where, order_by, first, offset } = context.args
                    value = applyWhere(value, where)
                    value = applyOrderBy(value, order_by)
                    value = applySlice(value, first, offset)
                    context.args = null
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
            if(root[fieldName] instanceof Array){
                const childChoices = storage.get(childType)
                let nodes = root[fieldName].map((id) => childChoices.get(id))
                if(args){
                    nodes = applyWhere(nodes, args.where)
                    nodes = applyOrderBy(nodes, args.order_by)
                    nodes = applySlice(nodes, args.first, args.offset)
                }
                return nodes
            }else{
                const childChoices = storage.get(childType)
                const foreignId = root[fieldName]
                if(!childChoices || foreignId == null){
                    return null
                }
                return childChoices.get(foreignId)
            }
        }

        return graphql(resolver, gql `${query}`, storage, {storage:storage, query:true}, variables)
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
            return node.nodes.map((item) => cacheNode({node:item, ...other}))
        }
        if(node.edges){
            return node.edges.map((item) => {
                let child = item.node
                if(item.cursor != null){
                    child = {...item.node, [CURSOR]:item.cursor}
                }
                return cacheNode({node:child, ...other})
            })
        }
        return cacheNode({node, ...other})
    }

    const cacheNode = ({node, parent, seen = new Set(), ...other}) => {
        if(node == null || typeof node !== 'object'){
            return node
        }
        const type = node['__typename']
        if(!type){
            console.warn('delv cache: skipping a node without a __typename.')
            return undefined
        }
        const id = node[UID]
        if(id == null){
            console.warn(`delv cache: skipping a ${type} node without a stable "${UID}".`)
            return undefined
        }

        const seenKey = `${type}:${id}`
        if(seen.has(seenKey)){
            return id
        }
        seen.add(seenKey)

        const typeDefinition = typeMap.getTypeDefinition(type) || {}
        const parentType = parent ? parent['__typename'] : null

        // shallow clone so the network response is never mutated in place
        const cached = {...node}

        for(let key in typeDefinition){
            const fieldType = typeDefinition[key]
            const value = node[key]
            if(value == null){
                // unexpanded back-reference to the parent: keep the foreign key
                if(parent && fieldType === parentType){
                    cached[key] = parent[UID]
                }
                continue
            }
            cached[key] = cacheUnknown({node:value, parent:node, seen, ...other})
        }

        emitter.updateType(type)
        storage.merge(id, type, cached)
        return id
    }

    const write = ({data, ...other}) => {
        for(let key in data.data){
            if(key !== '__typename'){
                const value = data.data[key]
                cacheUnknown({node:value, ...other})
            }
        }
        emitter.emitCacheUpdate()
    }

    return {
        read,
        write,
        getName
    }
}

module.exports = CacheByType
