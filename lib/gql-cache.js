"use strict";

var _graphqlTag = _interopRequireDefault(require("graphql-tag"));

var _util = _interopRequireDefault(require("util"));

var _react = _interopRequireWildcard(require("react"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var axios = require('axios');

var cache = require('./Cache');

module.exports = function betterThanApollo(url) {
  var _this = this;

  _classCallCheck(this, betterThanApollo);

  _defineProperty(this, "loadIntrospection", function () {
    axios.post(_this.url, {
      query: "{\n              __schema {\n                types{\n                  name\n                  fields{\n                    name\n                    type{\n                      name\n                      ofType{\n                        name\n                      }\n                    }\n                  }\n                }\n              }\n          }"
    }).then(function (res) {
      cache.loadIntrospection(res.data.data);
      _this.isReady = true;

      _this.queryQueue.forEach(_this.query);
    }).catch(function (error) {
      throw new Error('Something went wrong while attempting making introspection query ' + error);
    });
  });

  _defineProperty(this, "query", function (_ref) {
    var query = _ref.query,
        options = _ref.options;

    if (_this.isReady) {
      axios.post(_this.url, {
        query: query
      }).then(function (res) {
        cache.processIntoCache(res.data.data);
        return res;
      }).then(function (res) {
        options.resolve(res.data.data);
      }).catch(function (error) {
        throw new Error('error with query' + error);
      });
    } else {
      _this.queryQueue.push({
        query: query,
        options: options
      });
    }
  });

  this.url = url;
  this.isReady = false;
  this.queryQueue = [];
  this.loadIntrospection();
};

var Query =
/*#__PURE__*/
function (_Component) {
  _inherits(Query, _Component);

  function Query(props) {
    _classCallCheck(this, Query);

    return _possibleConstructorReturn(this, _getPrototypeOf(Query).call(this, props));
  }

  return Query;
}(_react.Component);