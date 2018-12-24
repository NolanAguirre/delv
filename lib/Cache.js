"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var gql = require('graphql-tag');

var util = require('util');

var _ = require('lodash');

var pluralize = require('pluralize');

var fs = require('fs');

var blacklistFields = ['node', 'id', 'nodeId', 'nodes', 'edges'];
var blacklistTypes = [null, 'Node', 'Int', 'String', 'Cursor', 'UUID', 'Boolean', 'PageInfo', 'Float', 'Mutation', 'ID', 'Datetime', '__Type', '__Schema', '__Directive', '__EnumValue', '__Field', '__InputValue'];

var Cache = function Cache() {
  var _this = this;

  _classCallCheck(this, Cache);

  _defineProperty(this, "loadIntrospection", function (queryResult) {
    queryResult['__schema'].types.forEach(function (type) {
      if (type.fields && !blacklistTypes.includes(type.name) && !type.name.endsWith('Payload')) {
        type.fields.forEach(function (field) {
          var typeName = field.type.name;

          if (typeName === null) {
            typeName = field.type.ofType.name;
          }

          if (!blacklistTypes.includes(typeName)) {
            _this.fields.set(field.name, typeName);
          }
        });
      }
    });
  });

  _defineProperty(this, "getIds", function (obj) {
    if (obj.nodeId) {
      return {
        nodeId: obj.nodeId
      };
    }

    return obj.nodes.map(function (o) {
      return o.nodeId;
    });
  });

  _defineProperty(this, "guessParentType", function (type) {
    return pluralize(type) + "Connection";
  });

  _defineProperty(this, "guessChildType", function (type) {
    return pluralize.singular(type.slice(0, -10));
  });

  _defineProperty(this, "formatObject", function (object, parentType) {
    var returnVal = {};

    for (var key in object) {
      var value = object[key];

      if (value instanceof Object) {
        (function () {
          var rootType = _this.fields.get(key);

          if (!rootType) {
            throw new Error("Line 76: A type was not mapped for field ".concat(rootName));
          }

          if (value.nodes) {
            var nodes = value.nodes.map(function (node) {
              if (node.nodeId) {
                _this.formatObject(node, _this.guessChildType(rootType));

                return node.nodeId;
              } else {
                throw new Error('Line 57: query object did not have required field nodeId');
              }
            });
            returnVal[rootType] = _defineProperty({}, _this.guessChildType(rootType), nodes);
          } else {
            if (value.nodeId) {
              _this.formatObject(value, rootType);

              returnVal[rootType] = value.nodeId;
            } else {
              throw new Error('Line 64: query object did not have required field nodeId');
            }
          }
        })();
      } else {
        returnVal[key] = object[key];
      }
    }

    if (parentType) {
      if (!_this.cache[parentType]) {
        _this.cache[parentType] = {};
      }

      _this.cache[parentType][object.nodeId] = returnVal;
    }

    return returnVal;
  });

  _defineProperty(this, "filterCacheById", function (type, ids) {
    return _.pickBy(_this.cache[type], function (value, key) {
      return ids.includes(key);
    });
  });

  _defineProperty(this, "processQuerySection", function (section, rootType) {
    var isOneToOne = true;

    if (!rootType) {
      throw new Error("Line 76: A type was not mapped for field ".concat(rootName));
    }

    for (var key in section) {
      if (Array.isArray(section[key])) {
        isOneToOne = false;

        if (!_this.cache[rootType]) {
          _this.cache[rootType] = [];
        }

        section[key].forEach(function (node) {
          var childType = _this.guessChildType(rootType);

          _this.cache[rootType].push(node.nodeId);

          if (!_this.cache[childType]) {
            _this.cache[childType] = {};
          }

          _this.cache[childType][node.nodeId] = _.cloneDeep(node);

          for (var nodeKey in node) {
            if (_typeof(node[nodeKey]) === 'object') {
              _this.cache[childType][node.nodeId][nodeKey] = _this.getIds(node[nodeKey]);

              _this.processQuerySection(node[nodeKey], _this.fields.get(nodeKey));
            }
          }
        });
      }
    }

    if (isOneToOne) {
      var parentType = _this.guessParentType(rootType);

      if (!_this.cache[parentType]) {
        _this.cache[parentType] = {};
      }

      _this.cache[parentType][section.nodeId] = rootType;
      _this.cache[rootType][section.nodeId] = section;
    }
  });

  _defineProperty(this, "processIntoCache", function (queryResult) {
    var result = _.cloneDeep(queryResult);

    for (var key in result) {
      _this.processQuerySection(result[key], _this.fields.get(key));
    }

    var json = JSON.stringify(_this.cache);
    fs.writeFile('cache.json', json, 'utf8', function (error) {
      return console.log(error);
    }); //console.log(util.inspect(result, false, null, true /* enable colors */ ));
  });

  _defineProperty(this, "getType", function (name) {
    return _this.fields.get(name);
  });

  _defineProperty(this, "getByName", function (name) {
    return _this.cache[_this.fields.get(name)];
  });

  this.cache = {};
  this.fields = new Map();
};

module.exports = new Cache();