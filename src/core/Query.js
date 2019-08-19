import Delv from './delv'
import graphql from 'graphql-anywhere'
import TypeMap from './TypeMap'
import CacheEmitter from './CacheEmitter';
import _ from 'lodash'
import gql from 'graphql-tag'


class Query {
    constructor({query, variables, networkPolicy = 'network-once', cacheProcess = 'type'}) {
        this.q = query
        this.variables = variables
        this.resolved = true
        this.format = format
        this.id = '_' + Math.random().toString(36).substr(2, 9)
        this.types = []
        this.networkPolicy = networkPolicy || 'network-once'
        this.cacheProcess = cacheProcess || 'default'
        if(this.networkPolicy !== 'network-only'){
            this.mapTypes()
        }
        this.checkPolicies()
    }
    
    mapTypes = () => {

    }

    query = () => {
        return Delv.query({
            query: this.q,
            variables: this.variables
        })
    }

    addCacheListener = () => {
        CacheEmitter.on(this.id, this.onCacheUpdate)
    }

    removeCacheListener = () => {
        CacheEmitter.removeAllListeners(this.id);
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
