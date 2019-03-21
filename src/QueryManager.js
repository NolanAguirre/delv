class QueryManager{
    constructor(){
        this.queries = {}
    }

    addTypename = (query) => {
        return query.replace(/{(\n)/g,'{\n__typename\n')
    }

    normalizeQuery = (query, variables)  => {
        return `${query}${JSON.stringify(variables)}`.replace(/(\s)+/g, '');
    }

    add = (query, variables) => {
        let normalized = this.normalizeQuery(query, variables)
        if(!this.includes(query, variables)){
            this.queries[normalized] = {
                promise:null,
                id: Math.random().toString(36).substr(2, 9)
            }
        }
    }

    includes = (query, variables) => {
         return this.queries[this.normalizeQuery(query, variables)]
    }

    getPromise = (query, variables) => {
        if(this.includes(query,variables)){
            return this.queries[this.normalizeQuery(query, variables)].promise
        }
        return null
    }
    setPromise = (query, variables, promise) => {
        this.queries[this.normalizeQuery(query, variables)].promise = promise
    }

}

export default QueryManager
