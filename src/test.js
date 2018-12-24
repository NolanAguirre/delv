const gql = require('graphql-tag')
const util = require('util');
const axios = require('axios')
const cache = require('./Cache')
import graphql from 'graphql-anywhere'
import Delv from './j-delv'
var fs = require('fs');
var _ = require('lodash');

new Delv('http://localhost:3005/graphql');
setTimeout(test, 1000)
const query = `{
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
const data = {
    "allActivityCatagories": {
        "nodes": [{
            "name": "Classes",
            "nodeId": "WyJhY3Rpdml0eV9jYXRhZ29yaWVzIiwiMTkyZTQ0MGMtYTRhZC00YTFmLWIxZDktYmZlMTk2ZDhkOGQyIl0=",
            "activitiesByType": {
                "nodes": []
            }
        }, {
            "name": "Summer Camps",
            "nodeId": "WyJhY3Rpdml0eV9jYXRhZ29yaWVzIiwiYzI2M2RiNjQtODY0NS00MjI3LWEzNzUtYTg4MGVmYmJlMjYyIl0=",
            "activitiesByType": {
                "nodes": []
            }
        }, {
            "name": "Labs",
            "nodeId": "WyJhY3Rpdml0eV9jYXRhZ29yaWVzIiwiZjhkNmFlNTUtNTk1ZC00YWI2LTkwMDgtNzIzM2M1NzUwYTZhIl0=",
            "activitiesByType": {
                "nodes": [{
                    "nodeId": "WyJhY3Rpdml0aWVzIiwiMDZkNzFiYTUtMjQ1MC00Mjk2LTg2YzMtMjhmMjNiN2Q2YjBkIl0=",
                    "name": "Labs",
                    "description": "asd",
                    "eventsByEventType": {
                        "nodes": [{
                            "nodeId": "WyJldmVudHMiLCI0ZDcxNjQ5Zi1mYzdjLTQwNzgtYjRkOS04MWNkZGZjMzA0MGYiXQ==",
                            "id": "4d71649f-fc7c-4078-b4d9-81cddfc3040f",
                            "dateGroupsByEvent": {
                                "nodes": [{
                                    "nodeId": "WyJkYXRlX2dyb3VwcyIsIjkwYWY5MjYwLTNiZTgtNGVlYS1hZjllLTM2YzQzODFhZmIyOCJd",
                                    "price": 100,
                                    "openRegistration": "2018-12-12T05:59:38",
                                    "closeRegistration": "2018-12-23T05:59:38"
                                }]
                            }
                        }]
                    },
                    "activityCatagoryByType": {
                        "nodeId": "WyJhY3Rpdml0eV9jYXRhZ29yaWVzIiwiZjhkNmFlNTUtNTk1ZC00YWI2LTkwMDgtNzIzM2M1NzUwYTZhIl0=",
                        "name": "Labs"
                    }
                }, {
                    "nodeId": "WyJhY3Rpdml0aWVzIiwiZjQ1MzU5ZmEtYjVjYS00NTU2LTg1YmYtMWI4MDk2MjY2MDYwIl0=",
                    "name": "New Activityasdas",
                    "description": "asdasd",
                    "eventsByEventType": {
                        "nodes": []
                    },
                    "activityCatagoryByType": {
                        "nodeId": "WyJhY3Rpdml0eV9jYXRhZ29yaWVzIiwiZjhkNmFlNTUtNTk1ZC00YWI2LTkwMDgtNzIzM2M1NzUwYTZhIl0=",
                        "name": "Labs"
                    }
                }]
            }
        }, {
            "name": "Workshops",
            "nodeId": "WyJhY3Rpdml0eV9jYXRhZ29yaWVzIiwiZmRjZGJhZjEtMGVjMy00MTJjLTliZWItZjdhNjU0MTNhZmRkIl0=",
            "activitiesByType": {
                "nodes": []
            }
        }]
    }
}
function test() {
    let json;
    cache.formatObject(data)
    const cacheResult = graphql(resolver, gql`${query}`, null)
    console.log(_.isEqual(data, cacheResult))
    json = JSON.stringify(cacheResult);
    fs.writeFile('example.json', json, 'utf8', (error) => console.log(error));
}

const resolver = (fieldName, root, args, context, info) => {
    if(fieldName === 'nodes'){
        return Object.values(root)
    }
    let fieldType = cache.fields.get(fieldName);
    if(fieldType){
        if(fieldType.endsWith('Connection')){
            if(root === null){
                return cache.cache[cache.guessChildType(fieldType)];
            }
            let connections =  root[fieldType]
            let childType = Object.keys(connections)[0]
            let ids = connections[childType]
            return cache.filterCacheById(childType, ids)
        }
        return cache.cache[fieldType][root[fieldType]]
    }
    if(info.isLeaf){
        return root[fieldName];
    }
};
