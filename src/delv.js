
import util from 'util'
import TypeMap from './TypeMap'
import axios from 'axios'
import cache from './Cache'
import QueryManager from './QueryManager'
axios.defaults.withCredentials = true;

class Delv {
    constructor() {
        this.queries = new QueryManager();
        TypeMap.loadTypes();
        this.isReady = true
        this.queuedQueries = []
    }
    config = ({url, handleError}) => {
        this.url = url
        this.handleError = handleError
        //this.loadIntrospection() //development purposes
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
            this.queryHttp(query.options, query.skipCache, query.returnRes)
        })
    }

    post = (query, variables) => {
        return axios.post(this.url, {
            query: query,
            variables
        })
    }

    queryHttp = ({query, variables, onFetch, onResolve, onError, customCache}, skipCache, returnRes) => {
        if(!this.isReady){
            this.queuedQueries.push({options:{query, variables, onFetch, onResolve, onError, customCache}, skipCache, returnRes})
        }
        this.queries.add(query, variables) //TODO add typenames on only some queries
        let promise = this.post(this.queries.addTypename(query), variables).then((res) => {
            this.queries.setPromise(query, variables, null);
            if(skipCache){
                onResolve(res.data)
                return res;
            }else{
                try{
                    if(customCache){
                        customCache(cache, res.data.data)
                    }else{
                        cache.processIntoCache(res.data.data)
                    }
                } catch(error) {
                    console.trace()
                    console.log(`Error occured trying to cach responce data: ${error.message}`)
                }
                if(returnRes){
                    onResolve(res.data.data)
                }else{
                    onResolve(cache.loadQuery(query))
                }
                return res;
            }

        })
        //.catch((error) => {
            //throw new Error(`Error occured while making query ${error.message}`);
        //    return;
        //})
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
                this.queryHttp(options, false, true) // query, variables, onFetch, onResolve, onError
                break
            case 'network-no-cache':
                this.queryHttp(options, true)
                break
            case 'network-once':
                this.networkOnce(options)
                break
            case 'cache-by-query':
                this.cacheByQuery(options)
                break
        }
    }

    cacheByQuery = (options) => {
        let query = this.queries.includes(options.query, options.variables)
        if(query){
            options.onResolve(cache.cache[query.id])
        }else{
            this.queries.add(options.query, options.variables)
            query = this.queries.includes(options.query, options.variables)
            this.queryHttp({...options, customCache:(cache, data)=>{
                cache.cache[query.id] = data;
            }}, false, true)
        }
    }

    cacheFirst = (options) => {
        let data = cache.loadQuery(options.query)
        if (data.data) {
            options.onResolve(data.data);
        } else {
            this.queryHttp(options) // query, variables, onFetch, onResolve, onError
        }
    }

    networkOnce = ({query, variables, onFetch, onResolve, onError, customCache}) => {
        if(this.queries.includes(query, variables)){
            let promise = this.queries.getPromise(query, variables)
            if(promise){
                promise.then((res) => {
                    onResolve(res.data.data)
                    return res;
                })
            }else{
                onResolve(cache.loadQuery(query))
            }
        }else{
            this.queryHttp({query, variables, onFetch, onResolve, onError, customCache})
        }
    }

    clearCache = () => {
        this.queries = new QueryManager();
        cache.clearCache();
    }

}

export default new Delv();
