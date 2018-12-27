"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _graphqlTag = _interopRequireDefault(require("graphql-tag"));

var _util = _interopRequireDefault(require("util"));

var _TypeMap = _interopRequireDefault(require("./TypeMap"));

var _axios = _interopRequireDefault(require("axios"));

var _Cache = _interopRequireDefault(require("./Cache"));

var _QueryManager = _interopRequireDefault(require("./QueryManager"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Delv = function Delv() {
  var _this = this;

  _classCallCheck(this, Delv);

  _defineProperty(this, "setURL", function (url) {
    _this.url = url;
    _this.queries = new _QueryManager.default();
  });

  _defineProperty(this, "loadIntrospection", function () {
    _axios.default.post(_this.url, {
      query: "{\n              __schema {\n                types{\n                  name\n                  fields{\n                    name\n                    type{\n                      name\n                      ofType{\n                        name\n                      }\n                    }\n                  }\n                }\n              }\n          }"
    }).then(function (res) {
      _TypeMap.default.loadIntrospection(res.data.data);
    }).catch(function (error) {
      throw new Error('Something went wrong while attempting making introspection query ' + error);
    });
  });

  _defineProperty(this, "getAuthToken", function () {
    return null;
    return localStorage.getItem('authToken');
  });

  _defineProperty(this, "post", function (query, variables) {
    var token = _this.getAuthToken();

    var config = {};

    if (token) {
      config = {
        headers: {
          'Authorization': "bearer " + token
        }
      };
    }

    return _axios.default.post(_this.url, {
      query: _this.queries.addTypename(query),
      variables: variables
    }, config);
  });

  _defineProperty(this, "queryHttp", function (query, variables, onFetch, onResolve) {
    _this.queries.add(query, variables);

    onFetch();

    var promise = _this.post(query, variables).then(function (res) {
      try {
        _Cache.default.processIntoCache(res.data.data);
      } catch (error) {
        console.log("Error occured trying to cach responce data: ".concat(error.message));
      }

      onResolve(res.data.data);

      _this.queries.setPromise(query, variables, null);
    }).catch(function (error) {
      throw new Error("Error occured while making query ".concat(error.message));
      return;
    });

    _this.queries.setPromise(query, variables, promise);
  });

  _defineProperty(this, "query", function (_ref) {
    var query = _ref.query,
        variables = _ref.variables,
        networkPolicy = _ref.networkPolicy,
        onFetch = _ref.onFetch,
        onResolve = _ref.onResolve;

    switch (networkPolicy) {
      case 'cache-first':
        _this.cacheFirst();

        break;

      case 'cache-only':
        onResolve(_Cache.default.loadQuery(query));
        break;

      case 'network-only':
        _this.queryHttp(query, variables, onFetch, onResolve);

        break;

      case 'network-once':
        _this.networkOnce(query, variables, onFetch, onResolve);

        break;
    }
  });

  _defineProperty(this, "cacheFirst", function (query, variables, onFetch, onResolve) {
    var data = _Cache.default.loadQuery(query);

    if (data.data) {
      onResolve(data.data);
    } else {
      _this.queryHttp(query, variables, onFetch, onResolve);
    }
  });

  _defineProperty(this, "networkOnce", function (query, variables, onFetch, onResolve) {
    if (_this.queries.includes(query, variables)) {
      var promise = _this.queries.getPromise(query.variables);

      if (promise) {
        console.log('adding to promise');
        promise.then(function (res) {
          onResolve(res.data.data);
        });
      } else {
        onResolve(_Cache.default.loadQuery(query));
      }
    } else {
      _this.queryHttp(query, variables, onFetch, onResolve);
    }
  });
};

var _default = new Delv();

exports.default = _default;