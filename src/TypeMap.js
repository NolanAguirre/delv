var pluralize = require('pluralize')

const blacklistFields = ['node', 'id', 'nodeId', 'nodes', 'edges']

const blacklistTypes = [null, 'Node', 'Int', 'String', 'Cursor', 'UUID', 'Boolean', 'PageInfo', 'Float', 'Mutation', 'ID', 'Datetime', '__Type',  '__Schema', '__Directive', '__EnumValue', '__Field', '__InputValue']


class TypeMap {
    constructor(){
        this.map = new Map();
    }

    loadIntrospection = (queryResult) => {
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
