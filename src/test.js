const gql = require('graphql-tag')
const util = require('util');
const axios = require('axios')
const cache = require('./Cache')
import graphql from 'graphql-anywhere'
import betterThanApollo from './gql-cache'
var fs = require('fs');
var _ = require('lodash');

const resolver = (fieldName, root, args, context, info) => {
    // if(info.isLeaf){
    //     return root[fieldName];
    // }else if(fieldName === 'nodes' && Object.keys(root) > 0){
    //     if(false && root.args){
    //         //filter data
    //     }else{
    //         let nodes = [];
    //         for(var key in root){
    //             nodes.push(cache.cache[root[key]][key])
    //         }
    //         return nodes;
    //     }
    // }else if(root[fieldName] instanceof Object){
    //     if(!Array.isArray(root[fieldName])){
    //         return cache.getByName(fieldName)[root[fieldName].nodeId]
    //     }
    // }
    if(fieldName === 'nodes'){
        let nodes = [];
           for(var key in root){
               nodes.push(cache.cache[root[key]][key])
           }
        return nodes;
    }else if(info.isLeaf){
        return root[fieldName];
    }else if(Array.isArray(root[fieldName])){
        if(root[fieldName].length > 0){
            return cache.getByName(fieldName)
        }else{
            return cache.getByName(fieldName)
        }
    }else if(typeof root[fieldName] === 'object' && root[fieldName] != {}){
        return cache.getByName(fieldName)[fieldName.nodeId]
    }
    return cache.getByName(fieldName);
};

const apollo = new betterThanApollo('http://localhost:3005/graphql')
const query = gql`{
  allActivityCatagories{
    nodes{
      name
      nodeId
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

apollo.query({query: `{
  allActivityCatagories{
    nodes{
      name
      nodeId
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
}`,options:{
resolve:(data)=>{
    var json = JSON.stringify(data);
    fs.writeFile('query.json', json, 'utf8', (error) => console.log(error));
    const cacheResult = graphql(resolver, gql`${query}`, cache)
    console.log(_.isEqual(data, cacheResult))
    json = JSON.stringify(cacheResult);
    fs.writeFile('example.json', json, 'utf8', (error) => console.log(error));
}}})
