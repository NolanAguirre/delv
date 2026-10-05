const graphql = require('graphql-anywhere')
const { gql } = require('graphql-tag')
const CONNECTION_WRAPPERS = ['nodes', 'edges', 'node']
const BLACKLIST_FIELDS = [
    'node',
    'nodeId',
    'nodes',
    'Node',
    'edges',
    'PageInfo',
    'Mutation',
    '__Schema',
    '__Type',
    '__Field',
    '__InputValue',
    '__EnumValue',
    '__Directive'
]

const BLACKLIST_TYPES = [
     null,
    'Node',
    'Int',
    'String',
    'Cursor',
    'UUID',
    'Boolean',
    'PageInfo',
    'Float',
    'Mutation',
    'ID',
    'Datetime',
    'Interval',
    'BigFloat',
    'BigInt',
    '__Type',
    'JSON'
]

const ROOT_TYPES = ['Query', 'Mutation', 'Subscription']

const INTROSPECTION_QUERY =
`{
  __schema {
    types {
      name
      description
      possibleTypes { name }
      enumValues { name }
      fields {
        name
        args { name defaultValue type { kind name ofType { kind name } } }
        type {
          kind
          name
          description
          ofType {
            kind
            name
            description
            ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } } }
          }
        }
      }
    }
  }
}
`


function TypeMap({typeMap, api, httpClient, fields = {}, keys = {}}) {
    let map



    const parseDescription = (description) => {
        const descriptionType = description.match(/\`\S+\`/)
        if(descriptionType){
            return descriptionType[0].replace(/`/g, '')
        }
        return false
    }

    const getTypes = (query) => {
        const types = []
        const push = (type) => {
            if(type && !types.includes(type)){
                types.push(type)
            }
        }
        const ast = gql`${query}`
        const operation = ast.definitions[0]
        if(operation.name){
            push('__' + operation.name.value)
        }

        const walk = (selectionSet, typeName) => {
            if(!selectionSet){
                return
            }
            const typeDefinition = (typeName && getTypeDefinition(typeName)) || {}
            selectionSet.selections.forEach((selection) => {
                if(selection.kind !== 'Field'){
                    return
                }
                const fieldName = selection.name.value
                if(fieldName === '__typename'){
                    return
                }
                if(CONNECTION_WRAPPERS.includes(fieldName)){
                    walk(selection.selectionSet, typeName)
                    return
                }
                const childType = typeDefinition[fieldName]
                push(childType)
                walk(selection.selectionSet, childType)
            })
        }

        walk(operation.selectionSet, 'Query')
        return types
    }

    const getTypeDefinition = (name) => {
        return map[name]
    }

    // Full output fields live separately from the relationship-only cache map.
    const getFields = (name) => Object.fromEntries(Object.entries({...(map[name] || {}), ...((map.__fields || {})[name] || {}), ...(fields[name] || {})}).map(([field, type]) => [field, typeof type === 'string' ? type.replace(/[\[\]!]/g, '') : type]))

    const getFieldType = (type, field) => (fields[type] || {})[field]
        || ((map.__fieldTypes || {})[type] || {})[field]
        || ((map.__fields || {})[type] || {})[field] || (map[type] || {})[field]
    const getEnumValues = (type) => (map.__enumValues || {})[type] || []
    const getPossibleTypes = (name) => (map.__possibleTypes || {})[name] || []
    const canSelectField = (type, field) => !((map.__requiredArgs || {})[type] || []).includes(field)
    const getKey = (type) => keys[type] || (map.__keys || {})[type] || 'id'
    const toString = () => {
        const hasFields = Object.keys(fields).length > 0
        const hasKeys = Object.keys(keys).length > 0
        if(!hasFields && !hasKeys) return map
        const names = new Set([...Object.keys(map.__fields || {}), ...Object.keys(fields)])
        return {...map,
            ...(hasFields ? {
                __fields: Object.fromEntries([...names].map((name) => [name, {...getFields(name), ...(fields[name] || {})}])),
                __fieldTypes: Object.fromEntries([...new Set([...Object.keys(map.__fieldTypes || {}), ...Object.keys(fields)])].map((name) => [name, {...(map.__fieldTypes || {})[name], ...(fields[name] || {})}]))
            } : {}),
            ...(hasKeys ? {__keys: {...map.__keys, ...keys}} : {})
        }
    }

    const _loadIntrospection = (data) => {
        let exportData = _parseFields(data['__schema'].types)
        map = _arrayToObject(exportData)
        const unwrap = (type) => type && (type.name || unwrap(type.ofType))
        map.__fields = Object.fromEntries(data.__schema.types.filter((type) => type.fields && !type.name.startsWith('__')).map((type) => [type.name,
            Object.fromEntries(type.fields.map((field) => [field.name, unwrap(field.type)]).filter(([, name]) => name))
        ]))
        const signature = (type) => {
            if(!type) return undefined
            if(type.kind === 'NON_NULL') return signature(type.ofType) && `${signature(type.ofType)}!`
            if(type.kind === 'LIST') return signature(type.ofType) && `[${signature(type.ofType)}]`
            return type.name || signature(type.ofType)
        }
        const fieldTypes = data.__schema.types.filter((type) => type.fields).map((type) => [type.name,
            Object.fromEntries(type.fields.filter((field) => field.type.kind && signature(field.type)).map((field) => [field.name, signature(field.type)]))
        ]).filter(([, types]) => Object.keys(types).length)
        if(fieldTypes.length) map.__fieldTypes = Object.fromEntries(fieldTypes)
        const enums = data.__schema.types.filter((type) => type.enumValues && type.enumValues.length)
        if(enums.length) map.__enumValues = Object.fromEntries(enums.map((type) => [type.name, type.enumValues.map((value) => value.name)]))
        const possibleTypes = data.__schema.types.filter((type) => type.possibleTypes && type.possibleTypes.length)
        if(possibleTypes.length) map.__possibleTypes = Object.fromEntries(possibleTypes.map((type) => [type.name, type.possibleTypes.map((item) => item.name)]))
        const requiredArgs = data.__schema.types.filter((type) => type.fields).map((type) => [type.name,
            type.fields.filter((field) => (field.args || []).some((arg) => arg.type.kind === 'NON_NULL' && arg.defaultValue == null)).map((field) => field.name)
        ]).filter(([, names]) => names.length)
        if(requiredArgs.length) map.__requiredArgs = Object.fromEntries(requiredArgs)
        const detectedKeys = _detectKeys(data.__schema.types)
        if(Object.keys(detectedKeys).length) map.__keys = detectedKeys
        Object.defineProperty(map, '__networkGenerated', {value: true})
        return map
        // console.log('Delv is in development mode, include the typemap above as a config to delv to switch to production.')
    }

    // Types the cache normalizes but that have no `id` are keyed by their
    // PostGraphile single-column unique lookup, e.g. entityTypeByType(type: String!).
    const _detectKeys = (types) => {
        const byName = Object.fromEntries(types.filter((type) => type.name).map((type) => [type.name, type]))
        const unwrap = (type) => type && (type.name || unwrap(type.ofType))
        const isList = (type) => Boolean(type) && (type.kind === 'LIST' || isList(type.ofType))
        const isObject = (name) => Boolean(byName[name] && byName[name].fields)
        const relationships = Object.entries(map || {}).filter(([name]) => !name.startsWith('__'))
        const targets = new Set(relationships.flatMap(([, definition]) => Object.values(definition)))
        const queryFields = (byName.Query && byName.Query.fields) || []
        const detected = {}
        // Introspection captured without `args` can't show lookups; stay quiet.
        if(!queryFields.some((field) => Array.isArray(field.args))) return detected
        const candidates = [...targets].filter((name) => map[name] && isObject(name) && !ROOT_TYPES.includes(name)
            && !(byName[name].possibleTypes || []).length
            && !byName[name].fields.some((field) => field.name === 'id'))
        candidates.forEach((name) => {
            const scalars = byName[name].fields.filter((field) => !isObject(unwrap(field.type))).map((field) => field.name)
            const lookups = queryFields.filter((field) => unwrap(field.type) === name && !isList(field.type)
                && (field.args || []).length === 1 && field.args[0].name !== 'nodeId'
                && field.args[0].type && field.args[0].type.kind === 'NON_NULL' && scalars.includes(field.args[0].name))
            if(lookups.length === 1){
                detected[name] = lookups[0].args[0].name
            }else if(!keys[name]){
                const reason = lookups.length
                    ? `has multiple single-column lookups (${lookups.map((field) => field.name).join(', ')})`
                    : 'has no id and no single-column lookup'
                console.log(`delv: ${name} ${reason}; it will not be cached. Set keys.${name} in TypeMap config.`)
            }
        })
        return detected
    }

    const _parseFields = (types) => {
        return types.map(t => {
            const {
                name,
                description,
                fields
            } = t
            if(!name){
                return
            }

            if(!name.endsWith('Connection') && fields){
                if((name.endsWith('Edge') && fields.some(field => field.name === 'cursor') && !fields.some(field => field.name === 'id')) || name.endsWith('Payload') || BLACKLIST_FIELDS.includes(name)){
                    return
                }
                let data = {}
                fields.forEach(field=>{
                    let unwrapped = field.type
                    while(unwrapped.ofType) unwrapped = unwrapped.ofType
                    let typeName = unwrapped.name
                    if(field.type.ofType && field.type.ofType.name && field.type.ofType.name.endsWith('Connection') && field.type.ofType.description){
                        typeName = parseDescription(field.type.ofType.description)
                    }else if(field.type.name && field.type.name.endsWith('Connection') && field.type.description){
                        typeName = parseDescription(field.type.description)
                    }
                    if(field.name !== 'query' && typeName && !BLACKLIST_TYPES.includes(typeName)){
                        data[field.name] = typeName
                    }
                })
                return{
                    name,
                    value:data
                }
            }
        }).filter(field => field)
    }

    const _arrayToObject = (arr) => {
        if(arr && arr.length){
            let data = {}
            arr.forEach(item => {
                data[item.name] = item.value
            })
            return data
        }
        return false
    }

    if(typeMap){
        map = typeMap
        Object.entries(keys).forEach(([type, key]) => {
            const known = {...(map.__fields || {})[type], ...fields[type]}
            if(Object.keys(known).length && !(key in known)){
                console.log(`delv: keys.${type} = '${key}' is not a field of ${type}`)
            }
        })
    }else{
        if(!httpClient || typeof httpClient.post !== 'function'){
            return Promise.reject(new Error('TypeMap({api}) requires an httpClient with a post(url, body) method, such as axios'))
        }
        return new Promise((resolve, reject)=>{
            httpClient.post(api, {query:INTROSPECTION_QUERY})
            .then((res) => {
                resolve(_loadIntrospection(res.data.data))
            }).catch((error) => {
                reject(new Error('Introspection query incountered an error ' + error.message))
            })
        })
    }

    return {
        isNetworkGenerated: Boolean(map.__networkGenerated),
        toString,
        getTypeDefinition,
        getFields,
        getPossibleTypes,
        getFieldType,
        getEnumValues,
        canSelectField,
        getKey,
        getTypes
    }
}

module.exports = TypeMap
