import graphql from 'graphql-anywhere'
import typeMap from './TypeMap'
import CacheEmitter from './CacheEmitter';
const gql = require('graphql-tag')
const util = require('util');
var _ = require('lodash');
var fs = require('fs');

let UID = 'nodeId'

class Cache {
    constructor() {
        this.cache = {};
        //{(\n)
    }

    resolver = (fieldName, root, args, context, info) => {
        if (info.isLeaf) {
            if (root.hasOwnProperty(fieldName)) {
                return root[fieldName];
            } else {
                throw new Error('Some of the leaf data requested in the query is not in the cache')
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
                if (connections instanceof Object) {
                    if (Array.isArray(connections)) {
                        ids = connections;
                    } else {
                        ids = Object.keys(connections);
                    }
                } else {
                    return this.cache[fieldType][connections]
                }

                let nextRoot = this.filterCacheById(fieldType, ids)
                if (args) {
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
        //TODO handle args.filter
        if (args.condition) {
            return _.pickBy(set, function(value, key) {
                let match = true;
                for (let k in args.condition) {
                    if (value[k] !== args.condition[k]) {
                        match = false;
                    }
                }
                return match;
            });
        } else {
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

    isLeaf = (obj) => {
        for (let key in obj) {
            if (obj[key] instanceof Object) {
                return false;
            }
        }
        return true;
    }

    getChildType = (obj) => {
        if(Array.isArray(obj)){
            if(obj.length > 0){
                return obj[0]['__typename']
            }
        }else{
            return typeMap.guessChildType(obj['__typename'])
        }
    }

    formatObject = (object) => {
        if(this.isLeaf(object)){
            this.updateCacheValue(object)
            return object[UID]
        }else if(Array.isArray(object)){
            return object.map((obj)=>{
                this.formatObject(obj)
                return obj[UID]
            })
        }else if(object['__typename'].endsWith('Connection')){
            if(object.nodes){
                return object.nodes.map((obj) => {
                    this.formatObject(obj)
                    return obj[UID]
                })
            }else if(object.edges){
                return object.edges.map((obj) => {
                    this.formatObject(obj.node)
                    return obj.node[UID]
                })
            }
        }else {
            let clone = _.cloneDeep(object)
            for(let key in clone){
                let value = clone[key]
                if(value instanceof Object){
                    delete clone[key]
                    clone[this.getChildType(value)] = this.formatObject(value);
                }
            }
            this.updateCacheValue(clone)
            return clone.nodeId;
        }
    }

    updateCacheValue = (obj) => {
        let typename = obj['__typename']
        if (!this.cache[typename]) {
            this.cache[typename] = {}
        }
        let cacheVal = this.cache[typename][obj[UID]]
        if (cacheVal) {
            if (!_.isEqual(cacheVal, obj)) {
                CacheEmitter.changeType(typename)
                this.cache[typename][obj[UID]] = this.merge(cacheVal, obj)
            }
        } else {
            CacheEmitter.changeType(typename)
            this.cache[typename][obj[UID]] = obj;
        }
    }

    filterCacheById = (type, ids) => {
        return _.pickBy(this.cache[type], function(value, key) {
            return ids.includes(key)
        });
    }

    processIntoCache = (queryResult) => {
        let result = _.cloneDeep(queryResult)
        Object.values(result).forEach((obj)=>{
            if(obj instanceof Object){
                this.formatObject(obj)
            }
        })
        CacheEmitter.emitCacheUpdate();
        fs.writeFile('example.json', JSON.stringify(this.cache), 'utf8', (error) => {
            if (error) {
                console.log(error)
            }
        });
    }

    loadQuery = (query) => {
        try {
            return graphql(this.resolver, gql `${query}`, this.cache)
        } catch (error) {
            return {
                error: error.message
            }
        }
    }

    clearCache = () => {
        this.cache = {};
    }
}

export default new Cache();
