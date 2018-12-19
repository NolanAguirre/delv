"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var GraphQLStore = require('./Store.js');

module.exports = function Query(props) {
  var _this = this;

  _classCallCheck(this, Query);

  _defineProperty(this, "formatQueryOptions", function () {
    return {
      networkPolicy: _this.networkPolicy,
      onResolve: _this.onResolve,
      onCache: _this.onCache,
      onError: _this.onError,
      onFetch: _this.props.onFetch
    };
  });

  _defineProperty(this, "componentDidMount", function () {
    _this.id = GraphQLStore.bindComponentToQuery(_this.queryId, _this.formatQueryOptions());
    GraphQLStore.fetchQuery(_this.queryId, _this.id, _this.props.variables);
  });

  _defineProperty(this, "componentWillUnmount", function () {
    GraphQLStore.unbindComponent(_this.id);
  });

  _defineProperty(this, "onResolve", function (queryResult) {});

  _defineProperty(this, "onCache", function (cache) {
    if (_this.props.onCache) {
      _this.props.onCache(cache);
    } else {//this.setState({queryResult:cache})
    }
  });

  _defineProperty(this, "onError", function () {});

  _defineProperty(this, "render", function () {});

  //super(props);
  this.props = props;
  this.queryId = GraphQLStore.registerQuery(props.query);
  this.networkPolicy = props.networkPolicy || 'cache-first';
  this.componentDidMount();
};