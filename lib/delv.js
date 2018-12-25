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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Delv = function Delv() {
  var _this = this;

  _classCallCheck(this, Delv);

  _defineProperty(this, "setURL", function (url) {
    _this.url = url;
    _this.queries = [];
  });

  _defineProperty(this, "registerMount", function (mount) {
    //this.mount = mount
    _this.loadIntrospection();
  });

  _defineProperty(this, "loadIntrospection", function () {
    _axios.default.post(_this.url, {
      query: "{\n              __schema {\n                types{\n                  name\n                  fields{\n                    name\n                    type{\n                      name\n                      ofType{\n                        name\n                      }\n                    }\n                  }\n                }\n              }\n          }"
    }).then(function (res) {
      _TypeMap.default.loadIntrospection(res.data.data); //this.mount.isReady();

    }).catch(function (error) {
      throw new Error('Something went wrong while attempting making introspection query ' + error);
    });
  });

  _defineProperty(this, "post", function (query, options) {
    options.onFetch();

    _axios.default.post(_this.url, {
      query: query
    }).then(function (res) {
      _Cache.default.processIntoCache(res.data.data);

      return res;
    }).then(function (res) {
      options.resolve(res.data.data);
    }).catch(function (error) {
      throw new Error('error with query ' + error.message);
      return;
    });
  });

  _defineProperty(this, "normalizeQuery", function (query, variable) {
    return "".concat(query).concat(JSON.stringify(variable)).replace(/(\s)+/g, '');
  });

  _defineProperty(this, "query", function (query, options) {
    if (options.networkPolicy === 'cache-first') {
      try {
        var data = _Cache.default.loadQuery(query);

        if (data.data) {
          options.resolve(data.data);
        } else {
          _this.post(query, options);
        }
      } catch (error) {
        console.log(error);
        return;
      }
    } else if (options.networkPolicy === 'cache-only') {
      options.resolve(_Cache.default.loadQuery(query));
    } else if (options.networkPolicy === 'network-only') {
      _this.post(query, options);
    } else if (options.networkPolicy === 'network-once') {
      var normalized = _this.normalizeQuery(query, options.variable);

      if (_this.queries.includes(normalized)) {
        options.resolve(_Cache.default.loadQuery(query));
      } else {
        _this.queries.push(normalized);

        _this.post(query, options);
      }
    }
  });
};

var _default = new Delv();

exports.default = _default;