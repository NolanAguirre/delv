const Delv = require('./delv')
const Cache = require('./Cache')


function Mutation({mutation, refetchQueries, cacheProcess = 'defualt'}){
    const submit = (variables) => {
        return new Promise((resolve, reject) =>{
            Delv.query({
                query: mutation,
                variables,
                networkPolicy: 'network-only',
                cacheProcess
            })
            .then((data)=>{
                onResolve(data)
                resolve(data)
            })
            .catch((error)=>{
                onError(error)
                reject(error)
            })
        })
    }

    const onResolve = (data) => {
        refetchQueries.forEach((query)=>{
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

    const onError = (error) => {
        console.log('Error occured durring mutation')
    }

    return {
        submit
    }
}

module.exports = Mutation
