const QueryRequest = require('../network/QueryRequest')
const NetworkFirst = require('./NetworkFirst')

class NetworkOnce extends NetworkFirst {
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
        queryObj.promise = QueryRequest({cache: this.cache, network: this.network, query, variables})
        .then((res)=>{
            this.cache.write({cacheProcess, data:res.data, query, variables, ...other})
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



module.exports = NetworkOnce
