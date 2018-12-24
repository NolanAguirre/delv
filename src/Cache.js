const gql = require('graphql-tag')
const util = require('util');
import graphql from 'graphql-anywhere'
var _ = require('lodash');
var pluralize = require('pluralize')
var fs = require('fs');

const blacklistFields = ['node', 'id', 'nodeId', 'nodes', 'edges']

const blacklistTypes = [null, 'Node', 'Int', 'String', 'Cursor', 'UUID', 'Boolean', 'PageInfo', 'Float', 'Mutation', 'ID', 'Datetime', '__Type',  '__Schema', '__Directive', '__EnumValue', '__Field', '__InputValue']

class Cache {
    constructor() {
        this.cache = {};
        this.fields = new Map();
        this.queries = {};
    }

    resolver = (fieldName, root, args, context, info) => {
        if(info.isLeaf){
            if(root.hasOwnProperty(fieldName)){
                return root[fieldName];
            }else{
                throw new Error('Some of the data requested in the query is not in the cache')
            }
        }
        if(fieldName === 'nodes'){
            return Object.values(root)
        }
        let fieldType = this.fields.get(fieldName);
        if(fieldType){
            if(fieldType.endsWith('Connection')){
                if(root === null){
                    let temp = this.cache[this.guessChildType(fieldType)];
                    if(temp){
                        return temp;
                    }else{
                        throw new Error('Some of the data requested in the query is not in the cache')
                    }
                }
                let connections =  root[fieldType]
                if(connections){
                    let childType = Object.keys(connections)[0]
                    let ids = connections[childType]
                    return this.filterCacheById(childType, ids)
                }else{
                    throw new Error('Some of the data requested in the query is not in the cache')
                }
            }
            return this.cache[fieldType][root[fieldType]]
        }

        return {};
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
    }

    guessParentType = (type) => {
        return pluralize(type) + "Connection"
    }

    guessChildType = (type) => {
        return pluralize.singular(type.slice(0,-10))
    }

    customizer = (objValue, srcValue, key, object, source, stack) => {
        if(Array.isArray(objValue)){
            return _.union(objValue, srcValue);
        }
    }

    merge = (oldObj, newObj) => {
        return _.mergeWith(oldObj, newObj, this.customizer);
    }

    formatObject = (object, parentType) => {
        let returnVal = {};
        for(var key in object){
            let value = object[key]
            if(value instanceof Object){
                const rootType = this.fields.get(key)
                if(!rootType){
                    throw new Error(`Line 76: A type was not mapped for field ${rootType}`)
                }
                if(value.nodes){
                    let nodes = value.nodes.map((node)=>{
                        if(node.nodeId){
                            this.formatObject(node, this.guessChildType(rootType))
                            return node.nodeId;
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
            let cacheVal = this.cache[parentType][object.nodeId]
            if(cacheVal){
                this.cache[parentType][object.nodeId] = this.merge(cacheVal, returnVal)
            }else{
                this.cache[parentType][object.nodeId] = returnVal;
            }
        }
    }

    filterCacheById = (type, ids) => {
        return _.pickBy(this.cache[type], function(value, key) {
            return ids.includes(key)
        });
    }

    processIntoCache = (queryResult) => {
        let result = _.cloneDeep(queryResult)
        this.formatObject(result)
        var json = JSON.stringify(this.cache);
        fs.writeFile('cache.json', json, 'utf8', (error) => console.log(error));
    }

    loadQuery = (query) => {
        try{
            return {data:graphql(this.resolver, gql`${query}`, null)}
        } catch(error){
            if(error.message === 'Some of the data requested in the query is not in the cache'){
                return {query:true}
            }
            return error
        }
    }
}

module.exports = new Cache();
