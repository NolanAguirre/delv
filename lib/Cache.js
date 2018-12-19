"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var gql = require('graphql-tag');

var util = require('util');

var Cache = function Cache() {
  var _this = this;

  _classCallCheck(this, Cache);

  _defineProperty(this, "register", function (key, value) {
    _this.data[key] = value;
  });

  _defineProperty(this, "isRegistered", function (key) {
    return _this.data.hasOwnProperty(key);
  });

  _defineProperty(this, "get", function (key) {
    return _this.data[key];
  });

  this.data = {};
};

module.exports = new Cache();