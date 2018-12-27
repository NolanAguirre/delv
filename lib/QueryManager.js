"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var QueryManager = function QueryManager() {
  var _this = this;

  _classCallCheck(this, QueryManager);

  _defineProperty(this, "addTypename", function (query) {
    return query.replace(/{(\n)/g, '{\n__typename');
  });

  _defineProperty(this, "normalizeQuery", function (query, variables) {
    return "".concat(query).concat(JSON.stringify(variables)).replace(/(\s)+/g, '');
  });

  _defineProperty(this, "add", function (query, variables) {
    var normalized = _this.normalizeQuery(query, variables);

    if (!_this.includes(query, variables)) {
      _this.queries[normalized] = {
        promise: null
      };
    }
  });

  _defineProperty(this, "includes", function (query, variables) {
    return _this.queries[_this.normalizeQuery(query, variables)];
  });

  _defineProperty(this, "getPromise", function (query, variables) {
    if (_this.includes(query, variables)) {
      return _this.queries[_this.normalizeQuery(query, variables)].promise;
    }

    return null;
  });

  _defineProperty(this, "setPromise", function (query, variables, promise) {
    _this.queries[_this.normalizeQuery(query, variables)].promise = promise;
  });

  this.queries = {};
};

var _default = QueryManager;
exports.default = _default;