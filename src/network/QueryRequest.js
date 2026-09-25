// Cache the enriched response, but resolve callers with their original selection.
const QueryRequest = async ({cache, network, query, variables}) => {
    const prepared = cache.prepareQuery ? cache.prepareQuery({query, variables}) : null
    const response = await network.post({query: prepared ? prepared.query : query, variables})
    const data = response.data.data
    return {
        ...response,
        connectionSource: {data, selectionQuery: prepared ? prepared.query : query},
        data: {...response.data, data: prepared ? prepared.normalize(data) : data},
        result: prepared ? prepared.project(data) : data
    }
}
module.exports = QueryRequest
