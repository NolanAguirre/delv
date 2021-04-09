import gql from 'graphql-tag'

class QueryManager{
    constructor(){
        this.queries = Object.create(null)
    }

    normalize = (query, variables)  => {
        const ast = gql`${query}`
        const normalized = ast.definitions[0].name && '__' + ast.definitions[0].name.value
        return normalized || `${query}${JSON.stringify(variables)}`.replace(/\s+/g, '')
    }

    _add = (query, variables) => {
        const normalized = this.normalize(query, variables)
        if(!this.includes(null, null, normalized)){
            const id = normalized.substring(0,2) === '__'?normalized:Math.random().toString(36).substr(2, 9)
            this.queries[normalized] = {}
            return this.queries[normalized]
        }
        return this.queries[normalized]
    }

    includes = (query, variables, normalized) => {
         return this.queries[normalized || this.normalizeQuery(query, variables)]
    }


    get = ({id, query, variables}) => {
        if(id){
            return this._getById(id)
        }
        return this._add(query, variables)
    }

    _getById = (id) => {
        return this.queries[id]
    }
}

query:{
    query,
    variables.
    eventEmitter
}



export default QueryManager
