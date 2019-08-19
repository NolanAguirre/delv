export default {
    name:'cache-only',
    policy:({
        query,
        variables,
        cacheProcess
    }) => {
        return cache.read(query, variables, cacheProcess)
    }
}
