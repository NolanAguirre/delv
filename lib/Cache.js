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

var fs = require('fs');

var UID = 'nodeId';

var Cache = function Cache() {
  var _this = this;

  _classCallCheck(this, Cache);

  _defineProperty(this, "resolver", function (fieldName, root, args, context, info) {
    if (info.isLeaf) {
      if (root.hasOwnProperty(fieldName)) {
        return root[fieldName];
      } else {
        throw new Error('Some of the leaf data requested in the query is not in the cache');
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
    //TODO handle args.filter
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

  _defineProperty(this, "isLeaf", function (obj) {
    for (var key in obj) {
      if (obj[key] instanceof Object) {
        return false;
      }
    }

    return true;
  });

  _defineProperty(this, "getChildType", function (obj) {
    if (Array.isArray(obj)) {
      if (obj.length > 0) {
        return obj[0]['__typename'];
      }
    } else {
      return _TypeMap.default.guessChildType(obj['__typename']);
    }
  });

  _defineProperty(this, "formatObject", function (object) {
    if (_this.isLeaf(object)) {
      _this.updateCacheValue(object);

      return object[UID];
    } else if (Array.isArray(object)) {
      return object.map(function (obj) {
        _this.formatObject(obj);

        return obj[UID];
      });
    } else if (object['__typename'].endsWith('Connection')) {
      if (object.nodes) {
        return object.nodes.map(function (obj) {
          _this.formatObject(obj);

          return obj[UID];
        });
      } else if (object.edges) {
        return object.edges.map(function (obj) {
          _this.formatObject(obj.node);

          return obj.node[UID];
        });
      }
    } else {
      var clone = _.cloneDeep(object);

      for (var key in clone) {
        var value = clone[key];

        if (value instanceof Object) {
          delete clone[key];
          clone[_this.getChildType(value)] = _this.formatObject(value);
        }
      }

      _this.updateCacheValue(clone);

      return clone.nodeId;
    }
  });

  _defineProperty(this, "updateCacheValue", function (obj) {
    var typename = obj['__typename'];

    if (!_this.cache[typename]) {
      _this.cache[typename] = {};
    }

    var cacheVal = _this.cache[typename][obj[UID]];

    if (cacheVal) {
      if (!_.isEqual(cacheVal, obj)) {
        _CacheEmitter.default.changeType(typename);

        _this.cache[typename][obj[UID]] = _this.merge(cacheVal, obj);
      }
    } else {
      _CacheEmitter.default.changeType(typename);

      _this.cache[typename][obj[UID]] = obj;
    }
  });

  _defineProperty(this, "filterCacheById", function (type, ids) {
    return _.pickBy(_this.cache[type], function (value, key) {
      return ids.includes(key);
    });
  });

  _defineProperty(this, "processIntoCache", function (queryResult) {
    var result = _.cloneDeep(queryResult);

    Object.values(result).forEach(function (obj) {
      if (obj instanceof Object) {
        _this.formatObject(obj);
      }
    });

    _CacheEmitter.default.emitCacheUpdate();

    fs.writeFile('example.json', JSON.stringify(_this.cache), 'utf8', function (error) {
      if (error) {
        console.log(error);
      }
    });
  });

  _defineProperty(this, "loadQuery", function (query) {
    try {
      return (0, _graphqlAnywhere.default)(_this.resolver, gql(_templateObject(), query), _this.cache);
    } catch (error) {
      return {
        error: error.message
      };
    }
  });

  _defineProperty(this, "clearCache", function () {
    _this.cache = {};
  });

  this.cache = {}; //{(\n)
};

var _default = new Cache();

exports.default = _default;