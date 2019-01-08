const gql = require('graphql-tag')
const util = require('util');
const axios = require('axios')
import cache from './Cache'
import graphql from 'graphql-anywhere'
import Delv from './delv'
var fs = require('fs');
var _ = require('lodash');

Delv.setURL('http://localhost:3005/graphql');

Delv.loadIntrospection();

setTimeout(test, 1000)
// setTimeout(test2, 2000)
// setTimeout(test3, 3000)
const query = `{
  allActivityCatagories {
    nodes {
      nodeId
      id
      name
    }
  }
  allActivities {
    nodes {
      nodeId
      id
      description
      name
      eventsByEventType {
        nodes {
          nodeId
          id
        }
      }
      activityCatagoryByType {
        id
        nodeId
      }
      activityPrerequisitesByActivity {
        nodes {
          id
          nodeId
          activityByPrerequisite {
            name
            id
            nodeId
          }
          activityByActivity {
            name
            id
            nodeId
          }
        }
      }
    }
  }
}`

const query2 = `{
  allActivityCatagories{
    nodes{
      id
      nodeId
    }
  }
}`

const query3 = `{
  allActivityCatagories{
    nodes{
      name
      id
      nodeId
      description
      activitiesByType{
        nodes{
          nodeId
          name
          description
          eventsByEventType{
            nodes{
              nodeId
              id
              dateGroupsByEvent{
                nodes{
                  nodeId
                  price
                  openRegistration
                  closeRegistration
                }
              }
            }
          }
          activityCatagoryByType{
            nodeId
            name
          }
        }
      }
    }
  }
}`

function compare(a,b){
    if(Array.isArray(a) && Array.isArray(b)){
        let temp = true;
        a.forEach((item)=>{
            let flag = false;
            b.forEach((itemTwo)=>{
                if(_.isEqualWith(item, itemTwo, compare)){
                    flag = true;
                }
            })
            temp = temp && flag
        })
        return temp
    }
}

function test() {

    Delv.query({
        query:query,
        networkPolicy:'network-once',
        onResolve: (data) => {
            const resolver = cache.resolver
            fs.writeFile('query.json', JSON.stringify(data), 'utf8', (error) => {
                if (error) {
                    console.log(error)
                }
            });
            const cacheResult = graphql(cache.resolver, gql `${query}`, cache.cache)
            console.log(_.isEqualWith(data, cacheResult, compare));
            fs.writeFile('example.json', JSON.stringify(cacheResult), 'utf8', (error) => {
                if (error) {
                    console.log(error)
                }
            });

        },
        onFetch: () => {}
    })
}
// function test2() {
//     Delv.query(query, {
//         networkPolicy: 'cache-first',
//         onFetch: () => {},
//         resolve: (data) => {
//             fs.writeFile('example.json', JSON.stringify(data), 'utf8', (error) => {
//                 if (error) {
//                     console.log(error)
//                 }
//             });
//             //console.log(_.isEqual(data, cacheResult)
//         }
//     })
// }
//
// function test2() {
//     delv.query(
//         query3, {
//             networkPolicy: 'cache-first',
//             resolve: (data) => {
//                 const resolver = cache.resolver
//                 fs.writeFile('query.json', JSON.stringify(data), 'utf8', (error) => {
//                     if (error) {
//                         console.log(error)
//                     }
//                 });
//                 const cacheResult = graphql(resolver, gql `${query3}`, null)
//                 console.log(_.isEqual(data, cacheResult))
//                 fs.writeFile('example.json', JSON.stringify(cacheResult), 'utf8', (error) => {
//                     if (error) {
//                         console.log(error)
//                     }
//                 });
//             }
//         })
// }
//
// function test3() {
//     delv.query(
//         query2,
//         {
//             networkPolicy: 'cache-first',
//             resolve: (data) => {
//                 const resolver = cache.resolver
//                 fs.writeFile('query.json', JSON.stringify(data), 'utf8', (error) => {
//                     if (error) {
//                         console.log(error)
//                     }
//                 });
//                 const cacheResult = graphql(resolver, gql `${query2}`, null)
//                 console.log(_.isEqual(data, cacheResult))
//                 fs.writeFile('example.json', JSON.stringify(cacheResult), 'utf8', (error) => {
//                     if (error) {
//                         console.log(error)
//                     }
//                 });
//             }
//         }
//     )
// }
