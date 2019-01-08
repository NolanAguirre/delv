import Delv from './delv'
import Cache from './Cache'


class Mutation{
    constructor({mutation, onFetch, onSubmit, onResolve, onError, refetchQueries, isDelete}){
        this.mutation = mutation;
        this.submit = onSubmit;
        this.fetch = onFetch;
        this.resolve = onResolve
        this.error = onError
        this.refetchQueries = refetchQueries || []
        this.isDelete = isDelete
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
        if(this.isDelete){
            Cache.remove(data)
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

    onError = (error) => {
        if(this.error){
            this.error(error)
        }else{
            throw new Error(`Unhandled Error in Delv Mutation component: ${error.message}`)
        }
    }
    
    query = () => {
        Delv.query({
            query: this.mutation,
            variables: this.variables,
            networkPolicy: 'network-only',
            onFetch: this.onFetch,
            onResolve: this.onResolve
        })
    }

}


export default Mutation
