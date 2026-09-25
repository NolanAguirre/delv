const {parse, print} = require('graphql')

const stableVariables = value => {
    if(Array.isArray(value)) return value.map(stableVariables)
    if(value && typeof value === 'object'){
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = stableVariables(value[key])
            return result
        }, {})
    }
    return value
}

module.exports = (query, variables) => {
    const varsKey = variables && Object.keys(variables).length ? JSON.stringify(stableVariables(variables)) : ''
    return print(parse(query)) + varsKey
}
