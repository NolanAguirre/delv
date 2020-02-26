class CacheOnly {
    constructor({cache, network, queryManager}){
        this.cache = cache
        this.network = network
        this.queryManager = queryManager
    }
    getName = () => 'cache-only'

    process = ({query, variables, cacheProcess}) => {
        return this.cache.read({cacheProcess, query, variables})
    }
}



export default CacheOnly
