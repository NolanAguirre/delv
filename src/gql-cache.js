import gql from 'graphql-tag'
import util from 'util'
import React, {
    Component
} from 'react'
const axios = require('axios')
const cache = require('./Cache')

module.exports = class betterThanApollo {
    constructor(url) {
        this.url = url;
        this.isReady = false
        this.queryQueue = [];
        this.loadIntrospection();
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
            cache.loadIntrospection(res.data.data);
            this.isReady = true;
            this.queryQueue.forEach(this.query);
        }).catch((error) => {
            throw new Error('Something went wrong while attempting making introspection query ' + error)
        })
    }

    query = ({
        query,
        options
    }) => {
        if (this.isReady) {
            axios.post(this.url, {
                query
            }).then((res) => {
                cache.processIntoCache(res.data.data)
                return res;
            }).then((res) => {
                options.resolve(res.data.data)
            }).catch((error) => {
                throw new Error('error with query' + error);
            })
        } else {
            this.queryQueue.push({
                query,
                options
            });
        }
    }
}


class Query extends Component {
    constructor(props) {
        super(props);
    }
}
