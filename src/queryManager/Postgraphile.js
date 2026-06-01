const graphql = require('graphql-anywhere')
const gql = require('graphql-tag')
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

const INTROSPECTION_QUERY =
`{
  __schema {
    types {
      name
      description
      fields {
        name
        type {
          name
          description
          ofType {
            name
            description
          }
        }
      }
    }
  }
}
`


function TypeMap({typeMap, api}) {
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

    const toString = () => {
        return map
    }

    const _loadIntrospection = (data) => {
        let exportData = _parseFields(data['__schema'].types)
        map = _arrayToObject(exportData)
        _findTypeConflicts(map)
        return map
        // console.log('Delv is in development mode, include the typemap above as a config to delv to switch to production.')
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
                if(name.endsWith('Edge') || name.endsWith('Payload') || BLACKLIST_FIELDS.includes(name)){
                    return
                }
                let data = {}
                fields.forEach(field=>{
                    let typeName = field.type.name
                    if(field.type.ofType && field.type.ofType.name && field.type.ofType.name.endsWith('Connection') && field.type.ofType.description){
                        typeName = parseDescription(field.type.ofType.description)
                    }else if(field.type.name && field.type.name.endsWith('Connection') && field.type.description){
                        typeName = parseDescription(field.type.description)
                    }
                    if(!BLACKLIST_TYPES.includes(typeName)){
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

    const _findTypeConflicts = (map) => {
        const keys = Object.keys(map)
        for(let key of keys){
            if(key !== 'Query'){
                const value = map[key]
                const keys2 = Object.keys(value)
                let seen = []
                let dup = {}
                for(let key2 of keys2){
                    const value2 = value[key2]
                    if(seen.includes(value2)){
                        console.log(`conflict detected on ${key} field ${key2} share's its type (${value2}) with ${dup[value2]}.`)
                    }else{
                        dup[value2] = key2
                    }
                    seen.push(value2)
                }
            }
        }
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
    }else{
        return new Promise((resolve, reject)=>{
            const axios = require('axios')
            axios.post(api, {query:INTROSPECTION_QUERY})
            .then((res) => {
                resolve(_loadIntrospection(res.data.data))
            }).catch((error) => {
                reject(new Error('Introspection query incountered an error ' + error.message))
            })
        })
    }

    return {
        toString,
        getTypeDefinition,
        getTypes
    }
}

module.exports = TypeMap
