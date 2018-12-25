"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _graphqlAnywhere = _interopRequireDefault(require("graphql-anywhere"));

var _TypeMap = _interopRequireDefault(require("./TypeMap"));

var _CacheEmitter = _interopRequireDefault(require("./CacheEmitter"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _templateObject() {
  var data = _taggedTemplateLiteral(["", ""]);

  _templateObject = function _templateObject() {
    return data;
  };

  return data;
}

function _taggedTemplateLiteral(strings, raw) { if (!raw) { raw = strings.slice(0); } return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var gql = require('graphql-tag');

var util = require('util');

var _ = require('lodash');

var Cache = function Cache() {
  var _this = this;

  _classCallCheck(this, Cache);

  _defineProperty(this, "resolver", function (fieldName, root, args, context, info) {
    if (info.isLeaf) {
      if (root.hasOwnProperty(fieldName)) {
        return root[fieldName];
      } else {
        throw new Error('Some of the data requested in the query is not in the cache');
      }
    }

    if (fieldName === 'nodes') {
      return Object.values(root);
    }

    var fieldType = _TypeMap.default.get(fieldName);

    if (fieldType) {
      if (fieldType.endsWith('Connection')) {
        fieldType = _TypeMap.default.guessChildType(fieldType);
      }

      var connections = root[fieldType];

      if (connections) {
        var ids;

        if (connections instanceof Object) {
          if (Array.isArray(connections)) {
            ids = connections;
          } else {
            ids = Object.keys(connections);
          }
        } else {
          return _this.cache[fieldType][connections];
        }

        var nextRoot = _this.filterCacheById(fieldType, ids);

        if (args) {
          return _this.filterCache(nextRoot, args);
        }

        return nextRoot;
      } else {
        throw new Error('Some of the data requested in the query is not in the cache');
      }
    }

    return _this.cache[fieldType][root[fieldType]];
  });

  _defineProperty(this, "filterCache", function (set, args) {
    if (args.condition) {
      return _.pickBy(set, function (value, key) {
        var match = true;

        for (var k in args.condition) {
          if (value[k] !== args.condition[k]) {
            match = false;
          }
        }

        return match;
      });
    } else {
      return set;
    }
  });

  _defineProperty(this, "merge", function (oldObj, newObj) {
    var customizer = customizer = function customizer(objValue, srcValue, key, object, source, stack) {
      if (Array.isArray(objValue)) {
        return _.union(objValue, srcValue);
      }
    };

    return _.mergeWith(oldObj, newObj, customizer);
  });

  _defineProperty(this, "formatObject", function (object, parentType) {
    var returnVal = {};

    for (var key in object) {
      var value = object[key];

      if (value instanceof Object) {
        (function () {
          var rootType = _TypeMap.default.get(key);

          if (!rootType) {
            throw new Error("Line 76: A type was not mapped for field ".concat(rootType));
          }

          if (value.nodes) {
            var nodes = value.nodes.map(function (node) {
              if (node.nodeId) {
                _this.formatObject(node, _TypeMap.default.guessChildType(rootType));

                return node.nodeId;
              } else {
                throw new Error('Line 57: query object did not have required field nodeId');
              }
            });
            returnVal[_TypeMap.default.guessChildType(rootType)] = nodes;
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

      var cacheVal = _this.cache[parentType][object.nodeId];

      if (cacheVal) {
        if (!_.isEqual(cacheVal, returnVal)) {
          _CacheEmitter.default.changeType(parentType);

          _this.cache[parentType][object.nodeId] = _this.merge(cacheVal, returnVal);
        }
      } else {
        _CacheEmitter.default.changeType(parentType);

        _this.cache[parentType][object.nodeId] = returnVal;
      }
    }
  });

  _defineProperty(this, "filterCacheById", function (type, ids) {
    return _.pickBy(_this.cache[type], function (value, key) {
      return ids.includes(key);
    });
  });

  _defineProperty(this, "processIntoCache", function (queryResult) {
    var result = _.cloneDeep(queryResult);

    _this.formatObject(result);

    _CacheEmitter.default.emitCacheUpdate();
  });

  _defineProperty(this, "loadQuery", function (query) {
    try {
      return (0, _graphqlAnywhere.default)(_this.resolver, gql(_templateObject(), query), _this.cache);
    } catch (error) {
      if (error.message === 'Some of the data requested in the query is not in the cache') {
        return {
          query: true
        };
      }

      return {};
    }
  });

  this.cache = {};
};

var _default = new Cache();

exports.default = _default;