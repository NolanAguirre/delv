const QueryRequest = require('../network/QueryRequest')

class NetworkOnly {
    constructor({cache, network, queryManager}){
        this.cache = cache
        this.network = network
        this.queryManager = queryManager
    }
    getName = () => 'network-only'

    process = (options) => this.fetch(options)

    fetch = ({query, variables, cacheProcess, ...other}) => {
        const queryObj = this.queryManager.get({query, variables})
        if(queryObj.isPending){
            return queryObj.promise
        }
        queryObj.isPending = true
        queryObj.promise = QueryRequest({cache: this.cache, network: this.network, query, variables})
        .then((res)=>{
            // Reset invalidates outstanding query writes as well as fetch history.
            if(!queryObj.isMutation && this.queryManager.includes(query, variables) !== queryObj){
                return res.result
            }
            this.cache.write({cacheProcess, data:res.data, query, variables, connectionSource: res.connectionSource, ...other})
            queryObj.isPending = false
            queryObj.success = true
            queryObj.fail = false
            queryObj.promise = null
            return res.result
        }).catch((error)=>{
            queryObj.isPending = false
            queryObj.fail = true
            queryObj.promise = null
            throw error
        })
        return queryObj.promise
    }
}

module.exports = NetworkOnly
