const BLACKLIST_FIELDS = [
    'node',
    'nodeId',
    'nodes',
    'edges',
    'query'
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
    'JSON'
]

const INTROSPECTION_QUERY =
`{
  __schema {
    queryType {
      fields {
        name
        description
        type {
          name
          fields {
            name
            description
            type {
              name
              ofType {
                name
              }
            }
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
        let exportData = this._parseFields(data['__schema'].queryType.fields)
        this.map = this._arrayToObject(exportData)
        console.log(JSON.stringify(this.map, null, 2))
        console.log('Delv is in development mode, include the typemap above as a config to delv to switch to production.')
    }

    _parseDescription = (description) => {
        const descriptionType = description.match(/\`\S+\`/)
        if(descriptionType){
            return descriptionType[0].replace(/`/g, '')
        }
        return false
    }

    _parseFields = (fields) => { //fuck this, the data isnt normalized, work on normalizing introspection query so this shit can actually work
        return fields.map(field => {
            const {
                name,
                description,
                type
            } = field
            if(name && !BLACKLIST_FIELDS.includes(name)){
                if(type.name && type.name.endsWith('Connection')){
                    return{
                        name,
                        value:this._parseDescription(description)
                    }
                }else if(type.name && type.fields){
                    return {
                       name:type.name,
                       value:this._arrayToObject(this._parseFields(type.fields))
                   }
               }else if(type.name && !type.ofType && !BLACKLIST_TYPES.includes(type.name)){
                  return  {
                      name,
                      value:type.name
                  }
              }else if(type.ofType && description){
                  return  {
                      name,
                      value:this._parseDescription(description)
                  }
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
