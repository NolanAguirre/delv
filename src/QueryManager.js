class QueryManager{
    constructor(){
        this.queries = {}
    }

    addTypename = (query) => {
        return query.replace(/{(\n)/g,'{\n__typename\n')
    }

    normalizeQuery = (query, variables)  => {
        return `${query}${JSON.stringify(variables)}`.replace(/(\s)+/g, '')
    }

    add = (query, variables) => {
        const normalized = this.normalizeQuery(query, variables)
        if(!this.includes(null, null, normalized)){
            const id = Math.random().toString(36).substr(2, 9)
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
