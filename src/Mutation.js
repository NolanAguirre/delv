import Delv from './delv'
import Cache from './Cache'


class Mutation{
    constructor({mutation, networkPolicy, onFetch, onSubmit, onResolve, refetchQueries, customCache}){
        this.mutation = mutation;
        this.networkPolicy = networkPolicy;
        this.submit = onSubmit;
        this.fetch = onFetch;
        this.resolve = onResolve
        this.customCache = customCache
        this.refetchQueries = refetchQueries || []
    }

    onSubmit = (event) => {
        this.variables = this.submit(event);
        if(this.variables){
            this.query()
        }
    }

    onFetch = (promise) => {
        if(this.fetch){
            this.fetch(promise)
        }
    }

    onResolve = (data) => {
        if(this.resolve){
            this.resolve(data)
        }
        this.refetchQueries.forEach((query)=>{
            Delv.query({
                query:query,
                networkPolicy:'network-only',
                variables:{},
                onResolve:()=>{},
                onFetch:()=>{},

            })
        })
    }

    removeListeners = () => {
        this.submit = null
        this.fetch = null
        this.resolve = null
    }

    query = () => {
        Delv.query({
            query: this.mutation,
            variables: this.variables,
            networkPolicy: this.networkPolicy || 'network-only',
            onFetch: this.onFetch,
            onResolve: this.onResolve,
            customCache: this.customCache
        })
    }
}


export default Mutation
