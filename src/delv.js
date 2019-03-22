import util from 'util'
import TypeMap from './TypeMap'
import axios from 'axios'
import cache from './Cache'
import QueryManager from './QueryManager'
axios.defaults.withCredentials = true;

class Delv {
    constructor() {
        this.queries = new QueryManager()
        this.isReady = false
        this.queuedQueries = []
    }
    config = ({url, handleError, development}) => {
        this.url = url
        this.handleError = handleError
        if(development){
            this.loadIntrospection()
        }else{
            this.isReady = true
            TypeMap.loadTypes()
        }
    }

    loadIntrospection = () => { //development purposes
        axios.post(this.url, {
            query: `{
              __schema {
                types{
                  name
                  fields{
                    name
                    type{
                      name
                      ofType{
                        name
                      }
                    }
                  }
                }
              }
          }`
        }).then((res) => {
            TypeMap.loadIntrospection(res.data.data);
            this.onReady();
        }).catch((error) => {
            throw new Error('Something went wrong while attempting making introspection query ' + error)
        })
    }

    onReady = () => {
        this.isReady = true;
        this.queuedQueries.forEach((query)=>{
            this.queryHttp(query)
        })
        this.queuedQueries = undefined
    }

    getCacheData = (query, variables, queryId, cacheProcess) => {
        switch(cacheProcess){ //update, delete and skip all return the raw res data, they are used for mutations and are mainly made via network-only
            case 'default':
                return cache.loadQuery(query, variables)
            case 'query':
                return cache.loadByQuery(queryId)
            default:
                return false
        }
    }

    post = (query, variables) => {
        return axios.post(this.url, {
            query: query,
            variables
        })
    }

    queryHttp = ({query, variables, onFetch, onResolve, onError, cacheProcess}) => {
        if(!this.isReady){
            this.queuedQueries.push({query, variables, onFetch, onResolve, onError, cacheProcess})
        }
        const queryId = this.queries.add(query, variables) //TODO add typenames on only some queries
        let promise = this.post(this.queries.addTypename(query), variables).then((res) => {
            if(res.data.errors){
                onError(res.data.errors)
            }else{
                try{
                    switch(cacheProcess){
                        case 'default':
                            cache.processIntoCache(res.data.data)
                            break
                        case 'query':
                            //cache.processByQuery
                            break
                        case 'update':
                            //cache.processUpdate
                            break
                        case 'delete':
                            //cache.processDelete
                            break
                        case 'skip':
                            //do nothing
                            break
                        default:
                            cacheProcess(cache, res.data.data)
                    }
                } catch(error) {
                    //TODO improve error message to highlight what went wrong
                    console.trace()
                    console.log(`Error occured trying to cache responce data: ${error.message}`)
                }
            }
            return res;
        }).then((res) => {
            if(!res.data.errors){
                try{
                    const data = this.getCacheData(query, variables, queryId, cacheProcess)
                    if(data){
                        onResolve(data)
                    }else{
                        onResolve(res.data.data)
                    }
                }catch(error){
                    console.trace()
                    console.log('Error occured while tryin.g to load data from query'error.message)
                    onResolve(res.data.data)
                }
            }
            return res
        }).catch((error) => {
            throw new Error(`Error occured while http request ${error.message}`);
            return
        })
        onFetch(promise);
        this.queries.setPromise(query, variables, promise)
    }

    query = (options) => { // query, variables, networkPolicy, onFetch, onResolve, onError
        switch(options.networkPolicy){
            case 'cache-first':
                this.cacheFirst(options)
                break
            case 'cache-only':
                options.onResolve(cache.loadQuery(options.query))
                break
            case 'network-only':
                this.queryHttp(options) // query, variables, onFetch, onResolve, onError
                break
            case 'network-once':
                this.networkOnce(options)
                break
        }
    }

    cacheFirst = (options) => {
        let cacheData = this.getCacheData(options.query, options.variables, null, options.cacheProcess)
        if (cacheData.data) {
            options.onResolve(cacheData.data);
        } else {
            this.queryHttp(options)
        }
    }

    networkOnce = ({query, variables, onFetch, onResolve, onError, cacheProcess}) => {
        const storedQuery = this.queries.includes(query, variables)
        if(storedQuery){
            if(storedQuery.promise){
                storedQuery.promise.then((res) => {
                    onResolve(res.data.data)
                    return res;
                })
            }else{
                const cacheData = this.getCacheData(query, variables, storedQuery.id, cacheProcess)
                onResolve(cacheData)
            }
        }else{
            this.queryHttp({query, variables, onFetch, onResolve, onError, cacheProcess})
        }
    }

    clearCache = () => {
        this.queries = new QueryManager();
        cache.clearCache();
    }

}

export default new Delv();
