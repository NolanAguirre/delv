import gql from 'graphql-tag'
import util from 'util'
import React, {Component} from 'react'
const axios = require('axios')
const cache = require('./Cache')

module.exports = class Delv {
    constructor(url) {
        this.url = url;
        this.isReady = false
        this.queryQueue = [];
        this.loadIntrospection();
    }

    loadIntrospection = () => {
        axios.post(this.url, {query: `{
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
          }`}).then((res) => {
            cache.loadIntrospection(res.data.data);
            this.isReady = true;
            this.queryQueue.forEach((query) => {
                this.query(query.query, query.options)
            });
        }).catch((error) => {
            throw new Error('Something went wrong while attempting making introspection query ' + error)
        })
    }

    post = (query, options) => {
        axios.post(this.url, {query}).then((res) => {
            cache.processIntoCache(res.data.data)
            return res;
        }).then((res) => {
            options.resolve(res.data.data)
        }).catch((error) => {
            throw new Error('error with query ' + error.message);
            return;
        })
    }

    query = (query, options) => {
        if (this.isReady) {
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
                try {
                    let data = cache.loadQuery(query)
                    if (data.data) {
                        options.resolve(data.data);
                    } else {
                        options.resolve({})
                    }
                } catch (error) {
                    console.log(error)
                    return;
                }
            } else if (options.networkPolicy === 'network-only') {
                this.post(query, options)
            }
        } else {
            this.queryQueue.push({query, options});
        }
    }
}

class Query extends Component {
    constructor(props) {
        super(props);
    }
}
