import gql from 'graphql-tag'

class QueryManager{
    constructor(){
        this.queries = {}
    }

    normalize = (query, variables)  => {
        const ast = gql`${query}`
        const normalized = ast.definitions[0].name && '__' + ast.definitions[0].name.value
        return normalized || `${query}${JSON.stringify(variables)}`.replace(/\s+/g, '')
    }

    add = (query, variables) => {
        const normalized = this.normalizeQuery(query, variables)
        if(!this.includes(null, null, normalized)){
            const id = normalized.substring(0,2) === '__'?normalized:Math.random().toString(36).substr(2, 9)
            this.queries[normalized] = {
                promise:null,
                id
            }
            return id;
        }
        return this.queries[normalized].id
    }

    includes = (query, variables, normalized) => {
         return this.queries[normalized || this.normalizeQuery(query, variables)]
    }

    getPromise = (query, variables) => {
        const normalized = this.normalizeQuery(query, variables)
        if(this.includes(null, null, normalized)){
            return this.queries[normalized].promise
        }
        return null
    }

    setPromise = (query, variables, promise) => {
        const normalized = this.normalizeQuery(query, variables)
        promise.finally(()=>{
            this.queries[normalized].promise = null
        })
        this.queries[normalized].promise = promise
    }
}

export default QueryManager
