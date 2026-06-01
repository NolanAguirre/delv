const gql = require('graphql-tag')

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
            const queryObj = {
                id,
                normalized,
                isPending: false,
                promise: null,
                success: false,
                fail: false
            }
            this.queries[normalized] = queryObj
            this.queries[id] = queryObj
            return this.queries[normalized]
        }
        return this.queries[normalized]
    }

    includes = (query, variables, normalized) => {
         return this.queries[normalized || this.normalize(query, variables)]
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

    remove = (query, variables) => {
        const normalized = this.normalize(query, variables)
        const queryObj = this.queries[normalized]
        if(queryObj){
            delete this.queries[queryObj.id]
            delete this.queries[normalized]
        }
    }

    clear = () => {
        this.queries = Object.create(null)
    }

}

module.exports = QueryManager
