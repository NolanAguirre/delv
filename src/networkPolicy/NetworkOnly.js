class NetworkOnce {
    constructor({cache, network, queryManager}){
        this.cache = cache
        this.network = network
        this.queryManager = queryManager
    }
    getName = () => 'network-only'

    process = ({query, variables, cacheProcess, ...other}) => {
        const queryObj = this.queryManager.get({query, variables})
        if(queryObj.isPending){
            return queryObj.promise
        }
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

export default NetworkOnce
