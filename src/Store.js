const gql = require('graphql-tag')
const util = require('util');
const axios = require('axios')
const cache = require('./Cache')
const QueryMap = require('./QueryMap')

class GQLParser {
    constructor() {

    }

    reduce = () => {
        
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

const parser = new GQLParser();

class Query {
    constructor(query) {
        this.GQLQuery = gql `${query}`
        this.query = query
        this.resolved = true;
        this.id = parser.getName(this.GQLQuery) || this.genRandomId();
        this.promise = null;
        this.queryResult = {
            data: null
        }
        this.components = {}
    }

    genRandomId = () => {
        return '_' + Math.random().toString(36).substr(2, 9);
    }

    addComponent = (component) => {
        const id = this.genRandomId()
        this.components[id] = component;
        return id;
    }

    removeComponent = (id) => {
        this.components[id] = null
    }

    forEachComponent = (action) => {
        for (var key in this.components) {
            action(this.components[key])
        }
    }

    updateCache = (newCache) => {
        if (this.queryResult.data != newCache) {
            this.queryResult.data = newCache;
            this.forEachComponent((component) => this.emitCache(component))
        }
    }

    emitCache = (component) => {
        if (component && component.onCache) {
            component.onCache(this.queryResult.data);
        }
    }

    emitFetch = (component, promise) => {
        if (component && component.onFetch) {
            component.onFetch(promise);
        }
    }

    emitResolve = (component) => {
        if (component && component.onResolve) {
            component.onCache(this.queryResult.data);
        }
    }

    emitError = (component, error) => {
        if (component && component.onError) {
            component.onCache(this.queryResult.data);
        }
    }

    httpFetch = (component, variables) => {
        if (this.resolved) {
            this.resolved = false;
            this.promise = axios.post('http://localhost:3005/graphql', {
                query: this.query,
                variables: variables
            })
            this.emitFetch(component, this.promise)
            this.promise.then((response) => {
                this.resloved = true;
                this.updateCache(response)
            }).catch = ((error) => {
                this.resolved = true
                this.emitError(componenet, error)
            })
        }
    }

    fetch = (componentId, variables) => {
        const component = this.components[componentId];
        if (component.networkPolicy === 'cache-only') {
            this.emitCache(component)
        } else if (component.networkPolicy === 'cache-first') {
            if (this.queryResult.data) {
                this.emitCache(component);
            } else {
                this.httpFetch(component, variables)
            }
        } else if (component.networkPolicy === 'network-only') {
            this.httpFetch(component,variables)
        }
    }

    equals = (query) => {
        return gql `${query}` === this.GQLQuery;
    }

}

class QueryManager {
    constructor() {
        this.queries = {};
    }

    contains = (query) => {
        return this.queries[query.id];
    }

    add = (query) => {
        if (!this.contains(query)) {
            this.queries[query.id] = query;
        }
        return query.id
    }

    get = (queryId) => {
        return this.queries[queryId]
    }
}

class GraphQLStore {
    constructor() {
        this.queryMap = new QueryMap();
        this.queryManager = new QueryManager();
    }

    updateCache = () => {

    }

    registerQuery = (query) => {
        return this.queryManager.add(new Query(query));
    }

    bindComponentToQuery = (queryId, component) => {
        return this.queryManager.get(queryId).addComponent(component);
    }

    unbindComponent = (queryId, component) => {
        this.queryManager.get(queryId).removeComponent(component);
    }

    fetchQuery = (queryId, componentId, variables) => {
        this.queryManager.get(queryId).fetch(componentId, variables)
    }

    fetchMutation = (mutation, options) => {

    }


}

module.exports = new GraphQLStore();
