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

    formatObject = (object, parentType) => {
        let returnVal = {};
        for(var key in object){
            let value = object[key]
            if(value instanceof Object){
                const rootType = this.fields.get(key)
                if(!rootType){
                    throw new Error(`Line 76: A type was not mapped for field ${rootName}`)
                }
                if(value.nodes){
                    let nodes =  value.nodes.map((node)=>{
                        if(node.nodeId){
                            this.formatObject(node, this.guessChildType(rootType))
                            return node.nodeId
                        }else{
                            throw new Error('Line 57: query object did not have required field nodeId')
                        }
                    });

                    returnVal[rootType] = {
                        [this.guessChildType(rootType)]:nodes
                    }
                }else{
                    if(value.nodeId){
                        this.formatObject(value, rootType)
                        returnVal[rootType] = value.nodeId
                    }else{
                        throw new Error('Line 64: query object did not have required field nodeId')
                    }
                }
            }else{
                returnVal[key] = object[key]
            }
        }
        if(parentType){
            if(!this.cache[parentType]){
                this.cache[parentType] = {}
            }
            this.cache[parentType][object.nodeId] = returnVal;
        }
        return returnVal;
    }

    filterCacheById = (type, ids) => {
        return _.pickBy(this.cache[type], function(value, key) {
            return ids.includes(key)
        });
    }

    processQuerySection = (section, rootType) => {
        let isOneToOne = true;
        if(!rootType){
            throw new Error(`Line 76: A type was not mapped for field ${rootName}`)
        }

        for (var key in section) {
            if (Array.isArray(section[key])) {
                isOneToOne = false;
                if (!this.cache[rootType]) {
                    this.cache[rootType] = []
                }
                section[key].forEach((node) => {

                    let childType = this.guessChildType(rootType)
                    this.cache[rootType].push(node.nodeId)
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
