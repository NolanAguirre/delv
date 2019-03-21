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

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var gql = require('graphql-tag');

var util = require('util');

var _ = require('lodash');

var UID = 'id';

var Cache = function Cache() {
  var _this2 = this;

  _classCallCheck(this, Cache);

  _defineProperty(this, "resolver", function (fieldName, root, args, context, info) {
    if (!root || Array.isArray(root) && root.length === 0) {
      return;
    }

    if (info.isLeaf) {
      if (root.hasOwnProperty(fieldName)) {
        return root[fieldName];
      } else {
        throw new Error("Some of the leaf data requested in the query is not in the cache ".concat(fieldName));
      }
    }

    if (fieldName === 'nodes') {
      return Object.values(root);
    }

    var conflict = _this2.keyConflict.get(fieldName);

    var fieldType = _TypeMap.default.get(fieldName);

    if (fieldType.endsWith('Connection')) {
      var childType = _TypeMap.default.guessChildType(fieldType);

      if (!_this2.cache[childType]) {
        return {};
      }

      var rootAccessor = childType;

      if (conflict) {
        rootAccessor = fieldName;
      }

      var ids = root[rootAccessor];

      if (ids instanceof Object) {
        if (!Array.isArray(ids)) {
          ids = Object.keys(ids);
        }

        var intersection = _this2.filterCacheByIds(childType, ids);

        if (args) {
          return _this2.filterCache(intersection, args);
        }

        return intersection;
      }

      if (_this2.cache[childType]) return _this2.cache[childType][ids];
    } else if (_this2.cache[fieldType]) {
      if (_this2.cache[fieldType][_this2.cache[fieldName]]) {
        return _this2.cache[fieldType][_this2.cache[fieldName]];
      }

      if (conflict) {
        return _this2.cache[fieldType][root[fieldName]];
      } else {
        return _this2.cache[fieldType][root[fieldType]];
      }
    }

    return null;
  });

  _defineProperty(this, "checkFilter", function (filter, value) {
    var match = true;

    for (var key in filter) {
      var filterValue = filter[key];

      if (key === 'lessThanOrEqualTo') {
        match = match && new Date(filterValue).getTime() >= new Date(value).getTime();
      } else if (key === 'greaterThanOrEqualTo') {
        match = match && new Date(filterValue).getTime() <= new Date(value).getTime();
      } else if (key === 'notEqualTo') {
        match = match && value != filterValue;
      } else if (key === 'greaterThan') {
        match = match && filterValue < value;
      } else if (key === 'lessThan') {
        match = match && filterValue > value;
      } else {
        console.log('cannot filter correctly');
      }
    }

    return match;
  });

  _defineProperty(this, "filterCacheByIds", function (type, ids) {
    return _.pickBy(_this2.cache[type], function (value, key) {
      return ids.includes(key);
    });
  });

  _defineProperty(this, "filterCache", function (set, args) {
    var returnVal = set;
    var _this = _this2;

    if (args.condition) {
      returnVal = _.pickBy(returnVal, function (value, key) {
        var match = true;

        for (var k in args.condition) {
          if (value[k] !== args.condition[k]) {
            match = false;
          }
        }

        return match;
      });
    }

    if (args.filter) {
      returnVal = _.pickBy(returnVal, function (value, key) {
        var match = true;

        for (var k in args.filter) {
          if (value[k]) {
            if (!_this.checkFilter(args.filter[k], value[k])) {
              match = false;
            }
          } else {
            console.log("Key data ".concat(k, " not found, cannot complete filter"));
          }
        }

        return match;
      });
    }

    return returnVal;
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
    }

    return _TypeMap.default.guessChildType(obj['__typename']);
  });

  _defineProperty(this, "formatObject", function (object, isRoot, parentObject) {
    if (object['__typename'].endsWith('Payload') || object['__typename'] === 'query') {
      for (var key in object) {
        var value = object[key];

        if (key !== '__typename') {
          if (value instanceof Object) {
            _this2.formatObject(value);
          }
        }
      }

      return;
    }

    if (_this2.isLeaf(object)) {
      if (isRoot) {
        _this2.cache[isRoot] = object[UID];
      }

      var _clone = _.cloneDeep(object);

      if (parentObject) {
        var temp = _clone[parentObject.type];

        if (temp) {
          if (Array.isArray(temp)) {
            _clone[parentObject.type] = _toConsumableArray(temp).concat([parentObject.uid]);
          } else {
            _clone[parentObject.type] = [temp, parentObject.uid];
          }
        } else {
          _clone[parentObject.type] = parentObject.uid;
        }
      }

      _this2.updateCacheValue(_clone);

      return object[UID];
    }

    if (object['__typename'].endsWith('Connection')) {
      if (!_this2.cache[_this2.getChildType(object)]) {
        _this2.cache[_this2.getChildType(object)] = {};
      }

      if (parentObject) {
        parentObject['uid'] = parentObject['uid'][0];
      }

      if (object.nodes) {
        return object.nodes.map(function (obj) {
          _this2.formatObject(obj, false, parentObject);

          return obj[UID];
        });
      } else if (object.edges) {
        return object.edges.map(function (obj) {
          _this2.formatObject(obj.node, false, parentObject);

          return obj.node[UID];
        });
      }
    }

    var clone = _.cloneDeep(object);

    if (parentObject) {
      var _temp = clone[parentObject.type];

      if (_temp) {
        if (Array.isArray(_temp)) {
          clone[parentObject.type] = _toConsumableArray(_temp).concat([parentObject.uid]);
        } else {
          clone[parentObject.type] = [_temp, parentObject.uid];
        }
      } else {
        clone[parentObject.type] = parentObject.uid;
      }
    }

    var type = clone['__typename'];

    for (var _key in object) {
      if (_key === '__typename') {
        continue;
      }

      var _value = object[_key];

      if (_TypeMap.default.get(_key) === 'JSON') {
        continue;
      }

      if (_value instanceof Object) {
        var conflict = _this2.keyConflict.get(_key);

        if (conflict) {
          clone[_key] = _this2.formatObject(_value, false, {
            type: conflict,
            uid: [clone[UID]]
          });
        } else {
          clone[_this2.getChildType(_value)] = _this2.formatObject(_value, false, {
            type: type,
            uid: [clone[UID]]
          });
          delete clone[_key];
        }
      }
    }

    _this2.updateCacheValue(clone);

    return clone[UID];
  });

  _defineProperty(this, "updateCacheValue", function (obj) {
    var typename = obj['__typename'];

    if (!_this2.cache[typename]) {
      _this2.cache[typename] = {};
    }

    var cacheVal = _this2.cache[typename][obj[UID]];

    if (cacheVal) {
      if (!_.isEqual(cacheVal, obj)) {
        _CacheEmitter.default.changeType(typename);

        _this2.cache[typename][obj[UID]] = _this2.merge(cacheVal, obj);
      }
    } else {
      _CacheEmitter.default.changeType(typename);

      _this2.cache[typename][obj[UID]] = obj;
    }
  });

  _defineProperty(this, "removeObject", function (obj) {
    var objType = obj['__typename'];
    var objUID = obj[UID];

    _CacheEmitter.default.changeType(objType);

    delete _this2.cache[objType][objUID];

    for (var key in obj) {
      var value = obj[key];

      if (value instanceof Object) {
        var type = value['__typename'];
        var uid = value[UID];

        var conflict = _this2.keyConflict.get(key);

        _CacheEmitter.default.changeType(type);

        if (conflict) {
          _this2.cache[type][uid][conflict] = _this2.cache[type][uid][conflict].filter(function (id) {
            return id != objUID;
          });
        } else {
          _this2.cache[type][uid][objType] = _this2.cache[type][uid][objType].filter(function (id) {
            return id != objUID;
          });
        }
      }
    }
  });

  _defineProperty(this, "remove", function (queryResult) {
    for (var key in queryResult) {
      if (key === '__typename') {
        continue;
      }

      var value = queryResult[key];

      if (value['__typename'].startsWith('Delete') || value['__typename'].startsWith('Remove')) {
        for (var k in value) {
          if (k === '__typename') {
            continue;
          }

          _this2.removeObject(value[k]);
        }
      } else if (value['__typename'].startsWith('Create') || value['__typename'].startsWith('Make')) {
        for (var _k in value) {
          if (_k === '__typename') {
            continue;
          }

          _this2.formatObject(value[_k]);
        }
      }
    }

    _CacheEmitter.default.emitCacheUpdate();
  });

  _defineProperty(this, "processIntoCache", function (queryResult) {
    var result = _.cloneDeep(queryResult);

    for (var key in result) {
      if (key !== '__typename') {
        _this2.formatObject(result[key], key);
      }
    } //console.log('emitting cache update')


    _CacheEmitter.default.emitCacheUpdate();
  });

  _defineProperty(this, "loadQuery", function (query) {
    try {
      return (0, _graphqlAnywhere.default)(_this2.resolver, gql(_templateObject(), query), _this2.cache);
    } catch (error) {
      return {
        error: 'error loading query' + error.message
      };
    }
  });

  _defineProperty(this, "clearCache", function () {
    _this2.cache = {};
  });

  this.cache = {};
  this.emitter = _CacheEmitter.default;
  this.keyConflict = new Map();
  this.keyConflict.set('activityPrerequisitesByActivity', 'activityByActivity');
  this.keyConflict.set('activityByActivity', 'activityPrerequisitesByActivity');
  this.keyConflict.set('activityPrerequisitesByPrerequisite', 'activityByPrerequisite');
  this.keyConflict.set('activityByPrerequisite', 'activityPrerequisitesByPrerequisite');
};

var _default = new Cache();

exports.default = _default;