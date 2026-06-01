class NetworkOnce {
    constructor({cache, network, queryManager}){
        this.cache = cache
        this.network = network
        this.queryManager = queryManager
    }
    getName = () => 'network-once'

    process = ({query, variables, cacheProcess, ...other}) => {
        const queryObj = this.queryManager.get({query, variables})
        if(queryObj.isPending){
            return queryObj.promise
        }else if(queryObj.success){
            if(!queryObj.promise){
                queryObj.promise = Promise.resolve().then(() => this.cache.read({cacheProcess, query, variables}))
            }
            return queryObj.promise

        }
        queryObj.isPending = true
        queryObj.promise = this.network.post({query, variables})
        .then((res)=>{
            this.cache.write({cacheProcess, data:res.data, ...other})
            queryObj.isPending = false
            queryObj.success = true
            queryObj.fail = false
            queryObj.promise = null
            return res.data.data
        }).catch((error)=>{
            queryObj.isPending = false
            queryObj.fail = true
            queryObj.promise = null
            throw error
        })
        return queryObj.promise
    }
}



module.exports = NetworkOnce
