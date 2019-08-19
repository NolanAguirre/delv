
export default {
    name:'cache-first',
    policy:({
        query,
        variables,
        cacheProcess,
        cache,
        network,
        queryManager
    }) => {
        try{
            return cache.read(query, variables, cacheProcess)
        } catch(error) {
            queryManager.add(query, variables)
            return network.post({query, variables})
        }
    }
}
