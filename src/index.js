import TypeMap from './queryManager/Postgraphile.js'
import TypeMapData from './queryManager/TypeMapData.json'
import Cache from './cache/Cache.js'
import InMemoryStore from './storage/InMemoryStore.js'
import CacheEmitter from './cache/CacheEmitter.js'
import test from './test.json'
import gql from 'graphql-tag'
import util from 'util'
import {parse} from 'graphql/language/parser'

import AxiosWithErrors from './network/AxiosWithErrors.js'
import CacheFirst from './networkPolicy/CacheFirst.js'
import CacheOnly from './networkPolicy/CacheOnly.js'
import NetworkOnly from './networkPolicy/NetworkOnly.js'
import NetworkOnce from './networkPolicy/NetworkOnce.js'


import Query from './cache/policy/Query.js'
import Type from './cache/policy/Type.js'






const typeMap = new TypeMap({typeMap:TypeMapData})

const cache = new Cache({
    storage:new InMemoryStore(),
    emitter:new CacheEmitter(),
    cachePolicies:[Query, Type],
    typeMap
})

const networkConfig = {
    url:'http://localhost:4005/graphql',
    config:()=>{}
}
cache.write({
    cachePolicy:'type',
    data:test
})

let data = cache.read({
    cachePolicy:'type',
    query:`{
  __typename
  allUsers {
    __typename
    edges {
      cursor
      __typename
      node {
        id
        __typename
        lastName
        usersAccountsByUserId {
          __typename
          nodes {
            __typename
            id
            role
          }
        }
      }
    }
  }
}`
})




// const delv = new Delv({
//     cache:cache,
//     network:new AxiosWithErrors(networkConfig),
//     networkPolicies:[CacheFirst, CacheOnly, NetworkOnce, NetworkOnly]
// })

console.log(JSON.stringify(data, null, 2, true))
// console.log(util.inspect(parse(`{
//     allUsers(filter:"foo"){
//         edges{
//             cursor
//             node{
//                 id
//                 name
//             }
//         }
//         nodes{
//             id
//         }
//     }
// }`), false, null, true))
