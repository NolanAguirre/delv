class CacheOnly {
    constructor({cache, network, queryManager}){
        this.cache = cache
        this.network = network
        this.queryManager = queryManager
    }
    getName = () => 'cache-only'

    process = ({query, variables, cacheProcess}) => {
        return Promise.resolve().then(() => this.cache.read({cacheProcess, query, variables}))
    }
}



module.exports = CacheOnly
