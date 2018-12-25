import graphql from 'graphql-anywhere'
import typeMap from './TypeMap'
import CacheEmitter from './CacheEmitter';
const gql = require('graphql-tag')
const util = require('util');
var _ = require('lodash');


class Cache {
    constructor() {
        this.cache = {};
    }

    resolver = (fieldName, root, args, context, info) => {
        if (info.isLeaf) {
            if (root.hasOwnProperty(fieldName)) {
                return root[fieldName];
            } else {
                throw new Error('Some of the data requested in the query is not in the cache')
            }
        }
        if (fieldName === 'nodes') {
            return Object.values(root)
        }
        let fieldType = typeMap.get(fieldName);
        if (fieldType) {
            if (fieldType.endsWith('Connection')) {
                fieldType = typeMap.guessChildType(fieldType);
            }
            let connections = root[fieldType]
            if (connections) {
                let ids
                if(connections instanceof Object){
                    if(Array.isArray(connections)){
                        ids = connections;
                    }else{
                        ids = Object.keys(connections);
                    }
                }else{
                    return this.cache[fieldType][connections]
                }

                let nextRoot = this.filterCacheById(fieldType, ids)
                if(args){
                    return this.filterCache(nextRoot, args)
                }
                return nextRoot
            } else {
                throw new Error('Some of the data requested in the query is not in the cache')
            }
        }
        return this.cache[fieldType][root[fieldType]]
    }

    filterCache = (set, args) => {
        if(args.condition){
            return _.pickBy(set, function(value, key) {
                let match = true;
                for(let k in args.condition){
                    if(value[k] !== args.condition[k]){
                        match = false;
                    }
                }
                return match;
            });
        }else{
            return set;
        }
    }

    merge = (oldObj, newObj) => {
        let customizer = customizer = (objValue, srcValue, key, object, source, stack) => {
            if (Array.isArray(objValue)) {
                return _.union(objValue, srcValue);
            }
        }
        return _.mergeWith(oldObj, newObj, customizer);
    }

    formatObject = (object, parentType) => {
        let returnVal = {};
        for (var key in object) {
            let value = object[key]
            if (value instanceof Object) {
                const rootType = typeMap.get(key)
                if (!rootType) {
                    throw new Error(`Line 76: A type was not mapped for field ${rootType}`)
                }
                if (value.nodes) {
                    let nodes = value.nodes.map((node) => {
                        if (node.nodeId) {
                            this.formatObject(node, typeMap.guessChildType(rootType))
                            return node.nodeId;
                        } else {
                            throw new Error('Line 57: query object did not have required field nodeId')
                        }
                    });

                    returnVal[typeMap.guessChildType(rootType)] = nodes
                } else {
                    if (value.nodeId) {
                        this.formatObject(value, rootType)
                        returnVal[rootType] = value.nodeId
                    } else {
                        throw new Error('Line 64: query object did not have required field nodeId')
                    }
                }
            } else {
                returnVal[key] = object[key]
            }
        }
        if (parentType) {
            if (!this.cache[parentType]) {
                this.cache[parentType] = {}
            }
            let cacheVal = this.cache[parentType][object.nodeId]
            if (cacheVal) {
                if (!_.isEqual(cacheVal, returnVal)) {
                    CacheEmitter.changeType(parentType)
                    this.cache[parentType][object.nodeId] = this.merge(cacheVal, returnVal)
                }
            } else {
                CacheEmitter.changeType(parentType)
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
        CacheEmitter.emitCacheUpdate();
    }

    loadQuery = (query) => {
        try {
            return graphql(this.resolver, gql `${query}`, this.cache)
        } catch (error) {
            if (error.message === 'Some of the data requested in the query is not in the cache') {
                return {
                    query: true
                }
            }
            return {}
        }
    }
}


export default new Cache();
