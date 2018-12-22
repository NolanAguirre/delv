"use strict";

var _graphqlAnywhere = _interopRequireDefault(require("graphql-anywhere"));

var _gqlCache = _interopRequireDefault(require("./gql-cache"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _templateObject() {
  var data = _taggedTemplateLiteral(["", ""]);

  _templateObject = function _templateObject() {
    return data;
  };

  return data;
}

function _taggedTemplateLiteral(strings, raw) { if (!raw) { raw = strings.slice(0); } return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var gql = require('graphql-tag');

var util = require('util');

var axios = require('axios');

var cache = require('./Cache');

var fs = require('fs');

var _ = require('lodash');

new _gqlCache.default('http://localhost:3005/graphql');
setTimeout(test, 1000);
var query = "{\n  allActivityCatagories{\n    nodes{\n      name\n      nodeId\n      activitiesByType{\n        nodes{\n          nodeId\n          name\n          description\n          eventsByEventType{\n            nodes{\n              nodeId\n              id\n              dateGroupsByEvent{\n                nodes{\n                  nodeId\n                  price\n                  openRegistration\n                  closeRegistration\n                }\n              }\n            }\n          }\n          activityCatagoryByType{\n            nodeId\n            name\n          }\n        }\n      }\n    }\n  }\n}";
var data = {
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
};

function test() {
  var json;
  cache.formatObject(data);
  var cacheResult = (0, _graphqlAnywhere.default)(resolver, gql(_templateObject(), query), null);
  console.log(_.isEqual(data, cacheResult));
  json = JSON.stringify(cacheResult);
  fs.writeFile('example.json', json, 'utf8', function (error) {
    return console.log(error);
  });
}

var resolver = function resolver(fieldName, root, args, context, info) {
  if (fieldName === 'nodes') {
    return Object.values(root);
  }

  var fieldType = cache.fields.get(fieldName);

  if (fieldType) {
    if (fieldType.endsWith('Connection')) {
      if (root === null) {
        return cache.cache[cache.guessChildType(fieldType)];
      }

      var connections = root[fieldType];
      var childType = Object.keys(connections)[0];
      var ids = connections[childType];
      console.log(ids);
      console.log();
      console.log(cache.filterCacheById(childType, ids));
      console.log('----------------------------');
      return cache.filterCacheById(childType, ids);
    }

    return cache.cache[fieldType][root[fieldType]];
  }

  if (info.isLeaf) {
    return root[fieldName];
  }
}; //
// const apollo = new betterThanApollo('http://localhost:3005/graphql')
// const query = gql`{
//   allActivityCatagories{
//     nodes{
//       name
//       nodeId
//       activitiesByType{
//         nodes{
//           nodeId
//           name
//           description
//           eventsByEventType{
//             nodes{
//               nodeId
//               id
//               dateGroupsByEvent{
//                 nodes{
//                   nodeId
//                   price
//                   openRegistration
//                   closeRegistration
//                 }
//               }
//             }
//           }
//           activityCatagoryByType{
//             nodeId
//             name
//           }
//         }
//       }
//     }
//   }
// }`
//
// apollo.query({query: `{
//   allActivityCatagories{
//     nodes{
//       name
//       nodeId
//       activitiesByType{
//         nodes{
//           nodeId
//           name
//           description
//           eventsByEventType{
//             nodes{
//               nodeId
//               id
//               dateGroupsByEvent{
//                 nodes{
//                   nodeId
//                   price
//                   openRegistration
//                   closeRegistration
//                 }
//               }
//             }
//           }
//           activityCatagoryByType{
//             nodeId
//             name
//           }
//         }
//       }
//     }
//   }
// }`,options:{
// resolve:(data)=>{
//     var json = JSON.stringify(data);
//     fs.writeFile('query.json', json, 'utf8', (error) => console.log(error));
//     const cacheResult = graphql(resolver, gql`${query}`, cache)
//     console.log(_.isEqual(data, cacheResult))
//     json = JSON.stringify(cacheResult);
//     fs.writeFile('example.json', json, 'utf8', (error) => console.log(error));
// }}})