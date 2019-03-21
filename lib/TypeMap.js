"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _TypeMapData = _interopRequireDefault(require("./TypeMapData"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var pluralize = require('pluralize');

var blacklistFields = ['node', 'id', 'nodeId', 'nodes', 'edges'];
var blacklistTypes = [null, 'Node', 'Int', 'String', 'Cursor', 'UUID', 'Boolean', 'PageInfo', 'Float', 'Mutation', 'ID', 'Datetime', '__Type', '__Schema', '__Directive', '__EnumValue', '__Field', '__InputValue'];

var TypeMap = function TypeMap() {
  var _this = this;

  _classCallCheck(this, TypeMap);

  _defineProperty(this, "loadTypes", function () {
    for (var key in _TypeMapData.default) {
      var value = _TypeMapData.default[key];

      _this.map.set(key, value);
    }
  });

  _defineProperty(this, "loadIntrospection", function (queryResult) {
    //for development
    queryResult['__schema'].types.forEach(function (type) {
      if (type.fields && !blacklistTypes.includes(type.name) && !type.name.endsWith('Payload')) {
        type.fields.forEach(function (field) {
          var typeName = field.type.name;

          if (typeName === null) {
            typeName = field.type.ofType.name;
          }

          if (!blacklistTypes.includes(typeName)) {
            _this.map.set(field.name, typeName);
          }
        });
      }
    });
    var exportData = {};

    _this.map.forEach(function (value, key) {
      exportData[key] = value;
    });

    console.log(JSON.stringify(exportData));
  });

  _defineProperty(this, "get", function (name) {
    return _this.map.get(name);
  });

  _defineProperty(this, "guessParentType", function (type) {
    if (type.endsWith('Connection')) {
      return type;
    }

    return pluralize(type) + "Connection";
  });

  _defineProperty(this, "guessChildType", function (type) {
    if (type.endsWith('Connection')) {
      return pluralize.singular(type.slice(0, -10));
    }

    return type;
  });

  this.map = new Map();
};

var _default = new TypeMap();

exports.default = _default;