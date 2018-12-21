"use strict";

var _graphqlAnywhere = _interopRequireDefault(require("graphql-anywhere"));

var _gqlCache = _interopRequireDefault(require("./gql-cache"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _templateObject2() {
  var data = _taggedTemplateLiteral(["", ""]);

  _templateObject2 = function _templateObject2() {
    return data;
  };

  return data;
}

function _templateObject() {
  var data = _taggedTemplateLiteral(["{\n  allActivityCatagories{\n    nodes{\n      name\n      nodeId\n      activitiesByType{\n        nodes{\n          nodeId\n          name\n          description\n          eventsByEventType{\n            nodes{\n              nodeId\n              id\n              dateGroupsByEvent{\n                nodes{\n                  nodeId\n                  price\n                  openRegistration\n                  closeRegistration\n                }\n              }\n            }\n          }\n          activityCatagoryByType{\n            nodeId\n            name\n          }\n        }\n      }\n    }\n  }\n}"]);

  _templateObject = function _templateObject() {
    return data;
  };

  return data;
}

function _taggedTemplateLiteral(strings, raw) { if (!raw) { raw = strings.slice(0); } return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var gql = require('graphql-tag');

var util = require('util');

var axios = require('axios');

var cache = require('./Cache');

var fs = require('fs');

var _ = require('lodash');

var resolver = function resolver(fieldName, root, args, context, info) {
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
  if (fieldName === 'nodes') {
    var nodes = [];

    for (var key in root) {
      nodes.push(cache.cache[root[key]][key]);
    }

    return nodes;
  } else if (info.isLeaf) {
    return root[fieldName];
  } else if (Array.isArray(root[fieldName])) {
    if (root[fieldName].length > 0) {
      return cache.getByName(fieldName);
    } else {
      console.log(root);
      console.log(fieldName);
      console.log(root[fieldName]);
      return cache.getByName(fieldName);
    }
  } else if (_typeof(root[fieldName]) === 'object' && root[fieldName] != {}) {
    return cache.getByName(fieldName)[fieldName.nodeId];
  }

  return cache.getByName(fieldName);
};

var apollo = new _gqlCache.default('http://localhost:3005/graphql');
var query = gql(_templateObject());
apollo.query({
  query: "{\n  allActivityCatagories{\n    nodes{\n      name\n      nodeId\n      activitiesByType{\n        nodes{\n          nodeId\n          name\n          description\n          eventsByEventType{\n            nodes{\n              nodeId\n              id\n              dateGroupsByEvent{\n                nodes{\n                  nodeId\n                  price\n                  openRegistration\n                  closeRegistration\n                }\n              }\n            }\n          }\n          activityCatagoryByType{\n            nodeId\n            name\n          }\n        }\n      }\n    }\n  }\n}",
  options: {
    resolve: function resolve(data) {
      var json = JSON.stringify(data);
      fs.writeFile('query.json', json, 'utf8', function (error) {
        return console.log(error);
      });
      var cacheResult = (0, _graphqlAnywhere.default)(resolver, gql(_templateObject2(), query), cache);
      console.log(_.isEqual(data, cacheResult));
      json = JSON.stringify(cacheResult);
      fs.writeFile('example.json', json, 'utf8', function (error) {
        return console.log(error);
      });
    }
  }
});