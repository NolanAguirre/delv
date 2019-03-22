import Delv from './delv'
import graphql from 'graphql-anywhere'
import TypeMap from './TypeMap'
import CacheEmitter from './CacheEmitter';
const gql = require('graphql-tag')
var _ = require('lodash');

const networkPolicies = ['cache-first', 'cache-only', 'network-only', 'network-once']

class Query {
    constructor({query, variables, networkPolicy, onFetch, onResolve, onError, cacheProcess, formatResult}) {
        this.q = query
        this.variables = variables
        this.fetch = onFetch
        this.resolve = onResolve
        this.error = onError
        this.resolved = true
        this.format = formatResult
        this.id = '_' + Math.random().toString(36).substr(2, 9)
        this.types = [];
        this.setupNetworkPolicy(networkPolicy, cacheProcess)
    }

    setupNetworkPolicy = (networkPolicy, cacheProcess) => {
        if(networkPolicies.includes(networkPolicy)){
            if(cacheProcess === 'query' && (networkPolicy === 'cache-first' || networkPolicy === 'cache-only')){
                throw new Error(`Cache process query cannot be used with network policy cache-first or cache-only`)
                //This is because they will not be able to check the cache first, this could change but they wont return any data unless they have already
                //been queried anyway
            }else{
                this.networkPolicy = networkPolicy || 'network-once'
                this.cacheProcess = cacheProcess || 'default'
            }
            if(networkPolicy !== 'network-only'){
                this.mapTypes()
            }
        }else{
            throw new Error(`Network policy not allowed ${networkPolicy}`)
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
        Delv.query({query: this.q,
            variables: this.variables,
            networkPolicy: this.networkPolicy,
            onFetch: this.onFetch,
            onResolve: this.onResolve,
            onError:this.onError,
            cacheProcess:this.cacheProcess})
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
            throw new Error(`Unhandled graphql error recived in Delv query component: ${error.message}`)
        }
    }

    removeListeners = () => {
        this.resolve = null
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
