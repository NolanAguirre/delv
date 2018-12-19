import Query from './Query'
const gql = require('graphql-tag')
const util = require('util');

class GQLParser {
    constructor() {

    }

    reduce = (query) => {
        function helper(obj) {
            if (obj.selectionSet) {
                let returnValue = {}
                obj.selectionSet.selections.map((newObj) => {
                    if (newObj.name.value == 'nodes') {
                        let helperValue = helper(newObj)
                        returnValue[helperValue.key] = [helperValue.value]
                    } else {
                        let helperValue = helper(newObj)
                        returnValue[helperValue.key] = helperValue.value
                    }
                })
                return {
                    key: obj.name.value,
                    value: returnValue
                }
            } else {
                if(obj.kind === 'FragmentSpread'){
                    return{
                        key: 'Fragment',
                        value: obj.name.value
                    }
                }
                return {
                    key: obj.name.value,
                    value: ""
                }
            }
        }
        function Helper(obj){
            return {[obj.name.value]:helper(obj).value};
        }
        let foo;
        query.definitions.forEach((definition) => {
            foo = Helper(definition)
            console.log(util.inspect(foo, false, null, true /* enable colors */ ))
        })
    }

    getOperations = (query, type) => {
        return query.definitions.filter((definition) => {
            return definition.operation === type
        })
    }

    getName = (query) => {
        let operations = this.getOperations(query, 'query');
        if (operations.length === 1) {
            return operations[0].name && operations[0].name.value
        } else {
            throw new Error('multiple queries are not supported, break up queries into their own file/string')
        }

    }
}

let temp = new GQLParser();

temp.reduce(gql `query foo{
   allActivityCatagories{
    nodes {
      ...temp
      activitiesByType {
        nodes {
          nodeId
          name
          description
          id
          activityPrerequisitesByPrerequisite{
            nodes{
              nodeId
              id
        			activityByPrerequisite{
                nodeId
                id
                activityCatagoryByType{
                  nodeId
                  name
                  id
                }
              }
            }
          }
        }
      }
    }
  }
}

fragment temp on ActivityCatagory{
	name
  id
  nodeId
}
`)
