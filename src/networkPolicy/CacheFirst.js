class CacheFirst {
    constructor({cache, network, queryManager}){
        this.cache = cache
        this.network = network
        this.queryManager = queryManager
    }
    getName = () => 'cache-first'

    process = async ({query, variables, queryId, cacheProcess}) => {
        const queryObj = this.queryManager.get({query, variables})
        if(queryObj.isPending){
            return queryObj.promise
        }
        try{
            return this.cache.read({cacheProcess, query, variables})
        } catch {
            queryObj.isPending = true
            this.network.post({query, variables})
            .then((res)=>{
                this.cache.write({cacheProcess, data:res.data, ...other})
                queryObj.isPending = false
                queryObj.success = true
                return res.data.data
            }).catch((error)=>{
                queryObj.isPending = false
                queryObj.fail = true
                return error
            })
            return queryObj.promise
        }
    }
}



export default CacheFirst
