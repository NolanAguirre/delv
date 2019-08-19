export default {
    name:'network-once',
    policy:({
        query,
        variables,
        cacheProcess,
        cache,
        network,
        queryManager
    }) => {
        const storedQuery = queryManager.get(query, variables)
        if(!storedQuery) {
            queryManager.add(query, variables)
            return network.post({query, variables})
        }
        return cache.read({query, variables, cacheProcess})
    }
}
