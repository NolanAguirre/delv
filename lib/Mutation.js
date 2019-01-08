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
      onFetch = _ref.onFetch,
      onSubmit = _ref.onSubmit,
      onResolve = _ref.onResolve,
      onError = _ref.onError,
      refetchQueries = _ref.refetchQueries,
      isDelete = _ref.isDelete;

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

    if (_this.isDelete) {
      _Cache.default.remove(data);
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

  _defineProperty(this, "onError", function (error) {
    if (_this.error) {
      _this.error(error);
    } else {
      throw new Error("Unhandled Error in Delv Mutation component: ".concat(error.message));
    }
  });

  _defineProperty(this, "query", function () {
    _delv.default.query({
      query: _this.mutation,
      variables: _this.variables,
      networkPolicy: 'network-only',
      onFetch: _this.onFetch,
      onResolve: _this.onResolve
    });
  });

  this.mutation = mutation;
  this.submit = onSubmit;
  this.fetch = onFetch;
  this.resolve = onResolve;
  this.error = onError;
  this.refetchQueries = refetchQueries || [];
  this.isDelete = isDelete;
};

var _default = Mutation;
exports.default = _default;