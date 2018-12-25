import gql from 'graphql-tag'
import util from 'util'
import TypeMap from './TypeMap'
import axios from 'axios'
import cache from './Cache'

class Delv {
    setURL = (url) => {
        this.url = url
        this.queries = [];
    }

    registerMount = (mount) => {
        //this.mount = mount
        this.loadIntrospection()
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
            //this.mount.isReady();
        }).catch((error) => {
            throw new Error('Something went wrong while attempting making introspection query ' + error)
        })
    }

    post = (query, options) => {
        options.onFetch();
        axios.post(this.url, {
            query
        }).then((res) => {
            cache.processIntoCache(res.data.data)
            return res;
        }).then((res) => {
            options.resolve(res.data.data)
        }).catch((error) => {
            throw new Error('error with query ' + error.message);
            return;
        })
    }

    normalizeQuery = (query, variable)  => {
        return `${query}${JSON.stringify(variable)}`.replace(/(\s)+/g, '');
    }

    query = (query, options) => {
        if (options.networkPolicy === 'cache-first') {
            try {
                let data = cache.loadQuery(query)
                if (data.data) {
                    options.resolve(data.data);
                } else {
                    this.post(query, options)
                }
            } catch (error) {
                console.log(error)
                return;
            }
        } else if (options.networkPolicy === 'cache-only') {
            options.resolve(cache.loadQuery(query));
        } else if (options.networkPolicy === 'network-only') {
            this.post(query, options)
        } else if (options.networkPolicy === 'network-once') {
            let normalized = this.normalizeQuery(query, options.variable)
            if(this.queries.includes(normalized)){
                options.resolve(cache.loadQuery(query));
            }else{
                this.queries.push(normalized);
                this.post(query, options)
            }
        }
    }
}

export default new Delv();
