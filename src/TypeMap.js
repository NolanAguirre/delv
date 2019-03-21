import data from './TypeMapData'
var pluralize = require('pluralize')
const blacklistFields = ['node', 'id', 'nodeId', 'nodes', 'edges']

const blacklistTypes = [null, 'Node', 'Int', 'String', 'Cursor', 'UUID', 'Boolean', 'PageInfo', 'Float', 'Mutation', 'ID', 'Datetime', '__Type',  '__Schema', '__Directive', '__EnumValue', '__Field', '__InputValue']


class TypeMap {
    constructor(){
        this.map = new Map();
    }
    loadTypes = () => {
        for(let key in data){
            let value = data[key]
            this.map.set(key, value)
        }
    }
    loadIntrospection = (queryResult) => {  //for development
        queryResult['__schema'].types.forEach((type)=>{
            if(type.fields && !blacklistTypes.includes(type.name) && !type.name.endsWith('Payload')){
                type.fields.forEach((field)=>{
                    let typeName = field.type.name;
                    if(typeName === null){
                        typeName = field.type.ofType.name
                    }
                    if(!blacklistTypes.includes(typeName)){
                        this.map.set(field.name, typeName)
                    }
                })
            }
        })
        let exportData = {}
        this.map.forEach((value, key)=>{
            exportData[key] = value;
        })
        console.log(JSON.stringify(exportData))
    }

    get = (name) => {
        return this.map.get(name);
    }

    guessParentType = (type) => {
        if(type.endsWith('Connection')){
            return type
        }
        return pluralize(type) + "Connection"
    }

    guessChildType = (type) => {
        if(type.endsWith('Connection')){
            return pluralize.singular(type.slice(0,-10))
        }
        return type;
    }
}

export default new TypeMap();
