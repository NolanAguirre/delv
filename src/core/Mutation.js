import Delv from './delv'
import Cache from './Cache'


class Mutation{
    constructor({mutation, refetchQueries, cacheProcess = 'defualt'}){
        this.mutation = mutation
        this.networkPolicy = networkPolicy
        this.cacheProcess = cacheProcess
        this.refetchQueries = refetchQueries || []
    }

    submit = (variables) => {
        return new Promise((resolve, reject) =>{
            Delv.query({
                query: this.mutation,
                variables,
                networkPolicy: 'network-only',
                cacheProcess: this.cacheProcess
            })
            .then((data)=>{
                this.onResolve(data)
                resolve(data)
            })
            .catch((error)=>{
                this.onError(error)
                reject(error)
            })
        })
    }

    onResolve = (data) => {
        this.refetchQueries.forEach((query)=>{
            Delv.query({
                query:query.query,
                networkPolicy:query.networkPolicy || 'network-only',
                cacheProcess:query.cacheProcess || 'default',
                variables:{},
                onResolve:()=>{},
                onFetch:()=>{},
            })
        })
    }

    onError = (error) => {
        console.log('Error occured durring mutation')
    }
}

export default Mutation
