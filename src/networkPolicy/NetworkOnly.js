export default {
    name:'network-only',
    policy:({
        query,
        variables,
        network,
        queryManager
    }) => {
        queryManager.add(query, variables)
        return network.post({query, variables})
    }    
}
