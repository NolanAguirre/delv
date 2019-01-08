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
    }

    resolver = (fieldName, root, args, context, info) => {
        if (info.isLeaf) {
            if (root.hasOwnProperty(fieldName)) {
                return root[fieldName];
            } else {
                throw new Error('Some of the leaf data requested in the query is not in the cache ')
            }
        }
        if (fieldName === 'nodes') {
            return Object.values(root)
        }
        let fieldType = typeMap.get(fieldName);
        if (fieldType) {
            if (fieldType.endsWith('Connection')) {
                fieldType = typeMap.guessChildType(fieldType);
                let connections;
                if(fieldName.startsWith('all')){
                    connections = root[fieldType]
                }else{
                    connections = root[fieldName]
                }
                if (connections) {
                    let ids
                    if(connections instanceof Object){
                        if(Array.isArray(connections)){
                            ids = connections;
                        }else{
                            ids = Object.keys(connections);
                        }
                    }
                    let nextRoot = this.filterCacheById(fieldType, ids)
                    if(args){
                        return this.filterCache(nextRoot, args)
                    }
                    return nextRoot
                }
            }else if(this.cache[fieldType][root[fieldType]]){
                return this.cache[fieldType][root[fieldType]]
            } else if(this.cache[fieldType][root[fieldName]]){
                return this.cache[fieldType][root[fieldName]]
            }else {
                throw new Error('Some of the data requested in the query is not in the cache')
            }
        }
        return this.cache[fieldType][root[fieldType]]
    }

    checkFilter = (filter, value) => {
        let match = true;
        for(let key in filter){
            let filterValue = filter[key]
            if(key === 'lessThanOrEqualTo'){
                match = match && new Date(filterValue).getTime() >= new Date(value).getTime();
            }else if(key === 'greaterThanOrEqualTo'){
                match = match && new Date(filterValue).getTime() <= new Date(value).getTime();
            }
        }
        return match
    }

    filterCacheById = (type, ids) => {
        return _.pickBy(this.cache[type], function(value, key) {
            return ids.includes(key)
        });
    }

    filterCache = (set, args) => {
        let returnVal = set;
        if(args.condition){
            returnVal = _.pickBy(returnVal, function(value, key) {
                let match = true;
                for(let k in args.condition){
                    if(value[k] !== args.condition[k]){
                        match = false;
                    }
                }
                return match;
            });
        }
        if(args.filter){
            returnVal = _.pickBy(returnVal,function(value,key){
                let match = true;
                for(let k in args.filter){
                    if(value[k]){
                        if(!this.checkFilter(args.filter[k], value[k])){
                            match = false;
                        }
                    }
                }
                return match;
            })
        }
        return returnVal
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

    formatObject = (object, isRoot, parentObject) => {
        if(object['__typename'].endsWith('Payload') || object['__typename'] === 'query'){
            for(let key in object){
                let value = object[key]
                if(key !== '__typename'){
                    if(value instanceof Object){
                        this.formatObject(value)
                    }
                }
            }
            return;
        }
        if(this.isLeaf(object)){
            if(isRoot){
                this.cache[isRoot] = object[UID]
            }
            let clone = _.cloneDeep(object)
            if(parentObject){
                clone[parentObject.type] = parentObject.uid
            }
            this.updateCacheValue(clone)
            return object[UID]
        }else if(Array.isArray(object)){
            return object.map((obj)=>{
                this.formatObject(obj)
                return obj[UID]
            })
        }else if(object['__typename'].endsWith('Connection')){
            if(parentObject){
                parentObject['uid'] = parentObject['uid'][0]
            }
            if(object.nodes){
                return object.nodes.map((obj) => {
                    this.formatObject(obj, false, parentObject)
                    return obj[UID]
                })
            }else if(object.edges){
                return object.edges.map((obj) => {
                    this.formatObject(obj.node, false, parentObject)
                    return obj.node[UID]
                })
            }
        }else {
            let clone = _.cloneDeep(object)
            if(parentObject){
                let temp = clone[parentObject.type]
                if(temp){
                    if(Array.isArray(temp)){
                        clone[parentObject.type] = [...temp, parentObject.uid]
                    }else{
                        clone[parentObject.type] = [temp, parentObject.uid]
                    }
                }else{
                    clone[parentObject.type] = parentObject.uid
                }
            }
            for(let key in object){
                if(key === '__typename'){
                    continue
                }
                let value = clone[key]
                if(value instanceof Object){
                    let kValue = this.formatObject(value, false, {type:key, uid:[clone[UID]]});
                    //let childType = typeMap.guessChildType(typeMap.get(key))
                    delete clone[key]
                    clone[key] = kValue;
                }
            }
            this.updateCacheValue(clone)
            return clone[UID];
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

    remove = (queryResult) => {

    }

    processIntoCache = (queryResult) => {
        let result = _.cloneDeep(queryResult)
        for(let key in result){
            if(key !== '__typename'){
                this.formatObject(result[key], key)
            }
        }
        //CacheEmitter.emitCacheUpdate();
        fs.writeFile('cache.json', JSON.stringify(this.cache), 'utf8', (error) => {
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
