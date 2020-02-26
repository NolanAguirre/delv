import Delv from './delv.js'


class Query {
    constructor({query, variables, networkPolicy, cacheProcess}) {
        this.q = query
        this.variables = variables
        this.id = '_' + Math.random().toString(36).substr(2, 9)
        this.types = []
        this.networkPolicy = networkPolicy
        this.cacheProcess = cacheProcess
        this.resolved = true
    }

    query = () => {
        this.resolved = false
        return Delv.query({
            query: this.q,
            variables: this.variables,
            networkPolicy:this.networkPolicy,
            cacheProcess:this.cacheProcess
        }).then((data)=>{
            this.resolved = true
            return data
        })
    }

    mapTypes = () => {
        this.types = Delv.typeMap.getTypes(this.q)
    }

    addCacheListener = () => {
        Delv.cacheEmitter.on(this.id, this.onCacheUpdate)
    }

    removeCacheListener = () => {
        Delv.cacheEmitter.removeAllListeners(this.id);
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
