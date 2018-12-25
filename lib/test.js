"use strict";

var _graphqlAnywhere = _interopRequireDefault(require("graphql-anywhere"));

var _delv = _interopRequireDefault(require("./delv"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var gql = require('graphql-tag');

var util = require('util');

var axios = require('axios');

var cache = require('./Cache');

var fs = require('fs');

var _ = require('lodash');

_delv.default.setURL('http://localhost:3005/graphql');

_delv.default.loadIntrospection();

setTimeout(test, 1000);
setTimeout(test2, 2000); // setTimeout(test3, 3000)

var query = "{\n  allActivityCatagories{\n    nodes{\n      name\n      nodeId\n      activitiesByType{\n        nodes{\n          nodeId\n          name\n          description\n          eventsByEventType{\n            nodes{\n              nodeId\n              id\n              dateGroupsByEvent{\n                nodes{\n                  nodeId\n                  price\n                  openRegistration\n                  closeRegistration\n                }\n              }\n            }\n          }\n          activityCatagoryByType{\n            nodeId\n            name\n          }\n        }\n      }\n    }\n  }\n}";
var query2 = "{\n  allActivityCatagories{\n    nodes{\n      id\n      nodeId\n    }\n  }\n}";
var query3 = "{\n  allActivityCatagories{\n    nodes{\n      name\n      id\n      nodeId\n      description\n      activitiesByType{\n        nodes{\n          nodeId\n          name\n          description\n          eventsByEventType{\n            nodes{\n              nodeId\n              id\n              dateGroupsByEvent{\n                nodes{\n                  nodeId\n                  price\n                  openRegistration\n                  closeRegistration\n                }\n              }\n            }\n          }\n          activityCatagoryByType{\n            nodeId\n            name\n          }\n        }\n      }\n    }\n  }\n}";

function test() {
  _delv.default.query(query, {
    networkPolicy: 'cache-first',
    onFetch: function onFetch() {},
    resolve: function resolve(data) {
      var resolver = cache.resolver;
      fs.writeFile('query.json', JSON.stringify(data), 'utf8', function (error) {
        if (error) {
          console.log(error);
        }
      }); //const cacheResult = graphql(resolver, gql `${query}`, cache.cache)
      // console.log(_.isEqual(data, cacheResult))
      // fs.writeFile('example.json', JSON.stringify(cacheResult), 'utf8', (error) => {
      //     if (error) {
      //         console.log(error)
      //     }
      // });
    }
  });
}

function test2() {
  _delv.default.query(query, {
    networkPolicy: 'cache-first',
    onFetch: function onFetch() {},
    resolve: function resolve(data) {
      fs.writeFile('example.json', JSON.stringify(data), 'utf8', function (error) {
        if (error) {
          console.log(error);
        }
      }); //console.log(_.isEqual(data, cacheResult)
    }
  });
} //
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