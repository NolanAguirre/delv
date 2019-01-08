import gql from 'graphql-tag'
import util from 'util'
import TypeMap from './TypeMap'
import axios from 'axios'
import cache from './Cache'
import QueryManager from './QueryManager'
class Delv {
    setURL = (url) => {
        this.url = url
        this.queries = new QueryManager();
    }

    loadIntrospection = () => {
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
        }).catch((error) => {
            throw new Error('Something went wrong while attempting making introspection query ' + error)
        })
    }

    getAuthToken = () => {
        return null
        return localStorage.getItem('authToken')
    }

    post = (query, variables) => {
        let token = this.getAuthToken();
        let config = {};
        if(token){
            config = {
                headers: {'Authorization': "bearer " + token}
            };
        }
        return axios.post(this.url, {
            query: this.queries.addTypename(query),
            variables
        }, config)
    }

    stripTypenames = (obj) => {
        delete obj['__typename']
        Object.values(obj).forEach((value) => {
            if(value instanceof Object){
                if(Array.isArray(value)){
                    value.forEach((item)=>{
                        if(item instanceof Object){
                            this.stripTypenames(item)
                        }
                    })
                }else{
                    this.stripTypenames(value)
                }
            }
        })
    }

    queryHttp = (query, variables, onFetch, onResolve) => {
        this.queries.add(query, variables)
        onFetch();
        let promise = this.post(query, variables).then((res) => {
            try{
                cache.processIntoCache(res.data.data)
            } catch(error) {
                console.log(`Error occured trying to cach responce data: ${error.message}`)
            }
            this.stripTypenames(res.data.data)
            onResolve(res.data.data)
            this.queries.setPromise(query, variables, null);
        }).catch((error) => {
            throw new Error(`Error occured while making query ${error.message}`);
            return;
        })
        this.queries.setPromise(query, variables, promise)
    }

    query = ({query, variables, networkPolicy, onFetch, onResolve}) => {
        switch(networkPolicy){
            case 'cache-first':
                this.cacheFirst()
                break
            case 'cache-only':
                onResolve(cache.loadQuery(query))
                break
            case 'network-only':
                this.queryHttp(query, variables, onFetch, onResolve)
                break
            case 'network-once':
                this.networkOnce(query, variables, onFetch, onResolve)
                break
        }
    }

    cacheFirst = (query, variables, onFetch, onResolve) => {
        let data = cache.loadQuery(query)
        if (data.data) {
            onResolve(data.data);
        } else {
            this.queryHttp(query, variables, onFetch, onResolve)
        }
    }

    networkOnce = (query, variables, onFetch, onResolve) => {
        if(this.queries.includes(query, variables)){
            let promise = this.queries.getPromise(query.variables)
            if(promise){
                console.log('adding to promise')
                promise.then((res) => {
                    onResolve(res.data.data)
                })
            }else{
                onResolve(cache.loadQuery(query))
            }
        }else{
            this.queryHttp(query, variables, onFetch, onResolve)
        }
    }

}

export default new Delv();
