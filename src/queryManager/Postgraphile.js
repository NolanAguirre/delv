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
    '__Type'
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


class TypeMap {
    constructor({typeMap, api}){
        if(typeMap){
            this.map = typeMap
        }else{
            return new Promise((resolve, reject)=>{
                const axios = require('axios')
                axios.post(api, {query:INTROSPECTION_QUERY})
                .then((res) => {
                    this._loadIntrospection(res.data.data)
                    resolve(true)
                }).catch((error) => {
                    reject(new Error('Introspection query incountered an error ' + error.message))
                })
            })
        }
    }

    _loadIntrospection = (data) => {
        let exportData = this._parseFields(data['__schema'].types)
        this.map = this._arrayToObject(exportData)
        console.log(JSON.stringify(this.map, null, 2))
        console.log('Delv is in development mode, include the typemap above as a config to delv to switch to production.')
    }

    parseDescription = (description) => {
        const descriptionType = description.match(/\`\S+\`/)
        if(descriptionType){
            return descriptionType[0].replace(/`/g, '')
        }
        return false
    }

    _parseFields = (types) => {
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
                        typeName = this.parseDescription(field.type.ofType.description)
                    }else if(field.type.name && field.type.name.endsWith('Connection') && field.type.description){
                        typeName = this.parseDescription(field.type.description)
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

    _arrayToObject = (arr) => {
        if(arr && arr.length){
            let data = {}
            arr.forEach(item => {
                data[item.name] = item.value
            })
            return data
        }
        return false
    }

    getTypeDefinition = (name) => {
        return this.map[name]
    }

    toString = () => {
        return this.map
    }
}

export default TypeMap
