const gql = require('graphql-tag')
const util = require('util');

class Cache {
    constructor(){
        this.data = {};
    }
    register = (key, value) => {
        this.data[key] = value;
    }

    isRegistered = (key) => {
        return this.data.hasOwnProperty(key);
    }

    get = (key) => {
        return this.data[key]
    }
}
module.exports = new Cache();
