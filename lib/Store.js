"use strict";

function _templateObject2() {
  var data = _taggedTemplateLiteral(["", ""]);

  _templateObject2 = function _templateObject2() {
    return data;
  };

  return data;
}

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

var axios = require('axios');

var cache = require('./Cache');

var QueryMap = require('./QueryMap');

var GQLParser = function GQLParser() {
  var _this = this;

  _classCallCheck(this, GQLParser);

  _defineProperty(this, "reduce", function () {});

  _defineProperty(this, "getOperations", function (query, type) {
    return query.definitions.filter(function (definition) {
      return definition.operation === type;
    });
  });

  _defineProperty(this, "getName", function (query) {
    var operations = _this.getOperations(query, 'query');

    if (operations.length === 1) {
      return operations[0].name && operations[0].name.value;
    } else {
      throw new Error('multiple queries are not supported, break up queries into their own file/string');
    }
  });
};

var parser = new GQLParser();

var Query = function Query(_query) {
  var _this2 = this;

  _classCallCheck(this, Query);

  _defineProperty(this, "genRandomId", function () {
    return '_' + Math.random().toString(36).substr(2, 9);
  });

  _defineProperty(this, "addComponent", function (component) {
    var id = _this2.genRandomId();

    _this2.components[id] = component;
    return id;
  });

  _defineProperty(this, "removeComponent", function (id) {
    _this2.components[id] = null;
  });

  _defineProperty(this, "forEachComponent", function (action) {
    for (var key in _this2.components) {
      action(_this2.components[key]);
    }
  });

  _defineProperty(this, "updateCache", function (newCache) {
    if (_this2.queryResult.data != newCache) {
      _this2.queryResult.data = newCache;

      _this2.forEachComponent(function (component) {
        return _this2.emitCache(component);
      });
    }
  });

  _defineProperty(this, "emitCache", function (component) {
    if (component && component.onCache) {
      component.onCache(_this2.queryResult.data);
    }
  });

  _defineProperty(this, "emitFetch", function (component, promise) {
    if (component && component.onFetch) {
      component.onFetch(promise);
    }
  });

  _defineProperty(this, "emitResolve", function (component) {
    if (component && component.onResolve) {
      component.onCache(_this2.queryResult.data);
    }
  });

  _defineProperty(this, "emitError", function (component, error) {
    if (component && component.onError) {
      component.onCache(_this2.queryResult.data);
    }
  });

  _defineProperty(this, "httpFetch", function (component, variables) {
    if (_this2.resolved) {
      _this2.resolved = false;
      _this2.promise = axios.post('http://localhost:3005/graphql', {
        query: _this2.query,
        variables: variables
      });

      _this2.emitFetch(component, _this2.promise);

      _this2.promise.then(function (response) {
        _this2.resloved = true;

        _this2.updateCache(response);
      }).catch = function (error) {
        _this2.resolved = true;

        _this2.emitError(componenet, error);
      };
    }
  });

  _defineProperty(this, "fetch", function (componentId, variables) {
    var component = _this2.components[componentId];

    if (component.networkPolicy === 'cache-only') {
      _this2.emitCache(component);
    } else if (component.networkPolicy === 'cache-first') {
      if (_this2.queryResult.data) {
        _this2.emitCache(component);
      } else {
        _this2.httpFetch(component, variables);
      }
    } else if (component.networkPolicy === 'network-only') {
      _this2.httpFetch(component, variables);
    }
  });

  _defineProperty(this, "equals", function (query) {
    return gql(_templateObject(), query) === _this2.GQLQuery;
  });

  this.GQLQuery = gql(_templateObject2(), _query);
  this.query = _query;
  this.resolved = true;
  this.id = parser.getName(this.GQLQuery) || this.genRandomId();
  this.promise = null;
  this.queryResult = {
    data: null
  };
  this.components = {};
};

var QueryManager = function QueryManager() {
  var _this3 = this;

  _classCallCheck(this, QueryManager);

  _defineProperty(this, "contains", function (query) {
    return _this3.queries[query.id];
  });

  _defineProperty(this, "add", function (query) {
    if (!_this3.contains(query)) {
      _this3.queries[query.id] = query;
    }

    return query.id;
  });

  _defineProperty(this, "get", function (queryId) {
    return _this3.queries[queryId];
  });

  this.queries = {};
};

var GraphQLStore = function GraphQLStore() {
  var _this4 = this;

  _classCallCheck(this, GraphQLStore);

  _defineProperty(this, "updateCache", function () {});

  _defineProperty(this, "registerQuery", function (query) {
    return _this4.queryManager.add(new Query(query));
  });

  _defineProperty(this, "bindComponentToQuery", function (queryId, component) {
    return _this4.queryManager.get(queryId).addComponent(component);
  });

  _defineProperty(this, "unbindComponent", function (queryId, component) {
    _this4.queryManager.get(queryId).removeComponent(component);
  });

  _defineProperty(this, "fetchQuery", function (queryId, componentId, variables) {
    _this4.queryManager.get(queryId).fetch(componentId, variables);
  });

  _defineProperty(this, "fetchMutation", function (mutation, options) {});

  this.queryMap = new QueryMap();
  this.queryManager = new QueryManager();
};

module.exports = new GraphQLStore();