"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _delv = _interopRequireDefault(require("./delv"));

var _Cache = _interopRequireDefault(require("./Cache"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Mutation = function Mutation(_ref) {
  var _this = this;

  var mutation = _ref.mutation,
      networkPolicy = _ref.networkPolicy,
      onFetch = _ref.onFetch,
      onSubmit = _ref.onSubmit,
      onResolve = _ref.onResolve,
      refetchQueries = _ref.refetchQueries,
      customCache = _ref.customCache;

  _classCallCheck(this, Mutation);

  _defineProperty(this, "onSubmit", function (event) {
    _this.variables = _this.submit(event);

    if (_this.variables) {
      _this.query();
    }
  });

  _defineProperty(this, "onFetch", function (promise) {
    if (_this.fetch) {
      _this.fetch(promise);
    }
  });

  _defineProperty(this, "onResolve", function (data) {
    if (_this.resolve) {
      _this.resolve(data);
    }

    _this.refetchQueries.forEach(function (query) {
      _delv.default.query({
        query: query,
        networkPolicy: 'network-only',
        variables: {},
        onResolve: function onResolve() {},
        onFetch: function onFetch() {}
      });
    });
  });

  _defineProperty(this, "removeListeners", function () {
    _this.submit = null;
    _this.fetch = null;
    _this.resolve = null;
  });

  _defineProperty(this, "query", function () {
    _delv.default.query({
      query: _this.mutation,
      variables: _this.variables,
      networkPolicy: _this.networkPolicy || 'network-only',
      onFetch: _this.onFetch,
      onResolve: _this.onResolve,
      customCache: _this.customCache
    });
  });

  this.mutation = mutation;
  this.networkPolicy = networkPolicy;
  this.submit = onSubmit;
  this.fetch = onFetch;
  this.resolve = onResolve;
  this.customCache = customCache;
  this.refetchQueries = refetchQueries || [];
};

var _default = Mutation;
exports.default = _default;