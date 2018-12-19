"use strict";

var _Query = _interopRequireDefault(require("./Query"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _templateObject() {
  var data = _taggedTemplateLiteral(["query foo{\n   allActivityCatagories{\n    nodes {\n      ...temp\n      activitiesByType {\n        nodes {\n          nodeId\n          name\n          description\n          id\n          activityPrerequisitesByPrerequisite{\n            nodes{\n              nodeId\n              id\n        \t\t\tactivityByPrerequisite{\n                nodeId\n                id\n                activityCatagoryByType{\n                  nodeId\n                  name\n                  id\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n}\n\nfragment temp on ActivityCatagory{\n\tname\n  id\n  nodeId\n}\n"]);

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

var GQLParser = function GQLParser() {
  var _this = this;

  _classCallCheck(this, GQLParser);

  _defineProperty(this, "reduce", function (query) {
    function helper(obj) {
      if (obj.selectionSet) {
        var returnValue = {};
        obj.selectionSet.selections.map(function (newObj) {
          if (newObj.name.value == 'nodes') {
            var helperValue = helper(newObj);
            returnValue[helperValue.key] = [helperValue.value];
          } else {
            var _helperValue = helper(newObj);

            returnValue[_helperValue.key] = _helperValue.value;
          }
        });
        return {
          key: obj.name.value,
          value: returnValue
        };
      } else {
        if (obj.kind === 'FragmentSpread') {
          return {
            key: 'Fragment',
            value: obj.name.value
          };
        }

        return {
          key: obj.name.value,
          value: ""
        };
      }
    }

    function Helper(obj) {
      return _defineProperty({}, obj.name.value, helper(obj).value);
    }

    var foo;
    query.definitions.forEach(function (definition) {
      foo = Helper(definition);
      console.log(util.inspect(foo, false, null, true
      /* enable colors */
      ));
    });
  });

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

var temp = new GQLParser();
temp.reduce(gql(_templateObject()));