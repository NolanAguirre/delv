import Delv from './delv'
import graphql from 'graphql-anywhere'
import TypeMap from './TypeMap'
import CacheEmitter from './CacheEmitter';
const gql = require('graphql-tag')
var _ = require('lodash');

class Query {
    constructor({query, variables, networkPolicy, onFetch, onResolve, onError, formatResult}) {
        this.q = query
        this.variables = variables
        this.networkPolicy = networkPolicy || 'network-once'
        this.fetch = onFetch
        this.resolve = onResolve
        this.error = onError
        this.resolved = true
        this.format = formatResult
        this.id = '_' + Math.random().toString(36).substr(2, 9)
        this.types = [];
        if(networkPolicy != 'network-no-cache' && networkPolicy != 'cache-by-query'){
            this.mapTypes()
        }
    }

    mapTypes = () => {
        const resolver = (fieldName, root, args, context, info) => {
            if (!info.isLeaf && fieldName != 'nodes') {
                this.types.push(TypeMap.guessChildType(TypeMap.get(fieldName)))
            }
            return {}
        }
        graphql(resolver, gql `${this.q}`, null)
    }

    addCacheListener = () => {
        CacheEmitter.on(this.id, this.onCacheUpdate)
    }

    removeCacheListener = () => {
        CacheEmitter.removeAllListeners(this.id);
    }

    query = () => {
        Delv.query({query: this.q, variables: this.variables, networkPolicy: this.networkPolicy, onFetch: this.onFetch, onResolve: this.onResolve, onError:this.onError})
    }

    onFetch = (promise) => {
        this.resolved = false;
        if(this.fetch){
            this.fetch(promise)
        }
    }

    onResolve = (data) => {
        if(this.resolve){
            if(this.format){
                this.resolve(this.format(data))
            }else{
                this.resolve(data)
            }
        }
        this.resolved = true;
    }

    onError = (error) => {
        if(this.error){
            this.error(error)
        }else{
            throw new Error(`Unhandled Error in Delv Query component: ${error.message}`)
        }
    }
    removeListeners = () => {
        this.submit = null
        this.fetch = null
        this.resolve = null
    }

    onCacheUpdate = (types) => {
        if (this.resolved) {
            let includesType = this.types.some(r => types.includes(r))
            if (includesType) {
                this.query();
            }
        }
    }
}

export default Query
