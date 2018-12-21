const gql = require('graphql-tag')
const util = require('util');
var _ = require('lodash');
var pluralize = require('pluralize')
var fs = require('fs');

const blacklistFields = ['node', 'id', 'nodeId', 'nodes', 'edges']

const blacklistTypes = [null,'Node', 'Int', 'String', 'Cursor', 'UUID', 'Boolean', 'PageInfo', 'Float', 'Mutation', 'ID', 'Datetime', '__Type',  '__Schema', '__Directive', '__EnumValue', '__Field', '__InputValue']

class Cache {
    constructor() {
        this.cache = {};
        this.fields = new Map();
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
                        this.fields.set(field.name, typeName)
                    }
                })
            }
        })
        //console.log(this.fields)
    }

    getIds = (obj) => {
        if(obj.nodeId){
            return {nodeId: obj.nodeId}
        }
        return obj.nodes.map((o)=> {return o.nodeId})
    }

    guessParentType = (type) => {
        return pluralize(type) + "Connection"
    }
    guessChildType = (type) => {
        return pluralize.singular(type.slice(0,-10))
    }

    processQuerySection = (section, rootType) => {
        let isOneToOne = true;
        if(!rootType){
            throw new Error(`A type was not mapped for field ${rootName}`)
        }
        if (!this.cache[rootType]) {
            this.cache[rootType] = {}
        }
        for (var key in section) {
            if (Array.isArray(section[key])) {
                isOneToOne = false;
                section[key].forEach((node) => {

                    let childType = this.guessChildType(rootType)
                    this.cache[rootType][node.nodeId] = childType;
                    if(!this.cache[childType]){
                        this.cache[childType] = {}
                    }
                    this.cache[childType][node.nodeId] = _.cloneDeep(node);
                    for (var nodeKey in node) {
                        if (typeof node[nodeKey] === 'object') {
                            this.cache[childType][node.nodeId][nodeKey] = this.getIds(node[nodeKey]);
                            this.processQuerySection(node[nodeKey], this.fields.get(nodeKey))
                        }
                    }

                })
            }
        }
        if(isOneToOne){
            let parentType = this.guessParentType(rootType)
            if(!this.cache[parentType]){
                this.cache[parentType] = {};
            }
            this.cache[parentType][section.nodeId] = rootType
            this.cache[rootType][section.nodeId] = section
        }
    }

    processIntoCache = (queryResult) => {
        let result = _.cloneDeep(queryResult)
        for (var key in result) {
            this.processQuerySection(result[key], this.fields.get(key))
        }
        var json = JSON.stringify(this.cache);
        fs.writeFile('cache.json', json, 'utf8', (error) => console.log(error));
        //console.log(util.inspect(result, false, null, true /* enable colors */ ));
    }
    getType = (name) => {
        return this.fields.get(name);
    }
    getByName = (name) => {
        return this.cache[this.fields.get(name)];
    }

}

module.exports = new Cache();
