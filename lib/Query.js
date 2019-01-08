"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _delv = _interopRequireDefault(require("./delv"));

var _graphqlAnywhere = _interopRequireDefault(require("graphql-anywhere"));

var _TypeMap = _interopRequireDefault(require("./TypeMap"));

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

var _ = require('lodash');

var Query = function Query(_ref) {
  var _this = this;

  var query = _ref.query,
      variables = _ref.variables,
      networkPolicy = _ref.networkPolicy,
      onFetch = _ref.onFetch,
      onResolve = _ref.onResolve,
      onError = _ref.onError;

  _classCallCheck(this, Query);

  _defineProperty(this, "mapTypes", function () {
    var resolver = function resolver(fieldName, root, args, context, info) {
      if (!info.isLeaf && fieldName != 'nodes') {
        _this.types.push(_TypeMap.default.guessChildType(_TypeMap.default.get(fieldName)));
      }

      return {};
    };

    (0, _graphqlAnywhere.default)(resolver, gql(_templateObject(), _this.q), null);
  });

  _defineProperty(this, "addCacheListener", function () {
    CacheEmitter.on(_this.id, _this.onCacheUpdate);
  });

  _defineProperty(this, "removeCacheListener", function () {
    CacheEmitter.removeAllListeners(_this.id);
  });

  _defineProperty(this, "query", function () {
    _delv.default.query({
      query: _this.q,
      variables: _this.variables,
      networkPolicy: _this.networkPolicy,
      onFetch: _this.onFetch,
      onResolve: _this.onResolve,
      onError: _this.onError
    });
  });

  _defineProperty(this, "onFetch", function (promise) {
    _this.resolved = false;

    if (_this.fetch) {
      _this.fetch(promise);
    }
  });

  _defineProperty(this, "onResolve", function (data) {
    if (_this.resolve) {
      _this.resolve(data);
    }

    _this.resolved = true;
  });

  _defineProperty(this, "onError", function (error) {
    if (_this.error) {
      _this.error(error);
    } else {
      throw new Error("Unhandled Error in Delv Query component: ".concat(error.message));
    }
  });

  _defineProperty(this, "onCacheUpdate", function (types) {
    if (_this.resolved) {
      var includesType = _this.types.some(function (r) {
        return types.includes(r);
      });

      if (includesType) {
        _this.query();
      }
    }
  });

  this.q = query;
  this.variables = variables;
  this.networkPolicy = networkPolicy || 'network-once';
  this.fetch = onFetch;
  this.resolve = onResolve;
  this.error = onError;
  this.resolved = true;
  this.id = '_' + Math.random().toString(36).substr(2, 9);
  this.types = [];
  this.mapTypes();
};

var _default = Query;
exports.default = _default;