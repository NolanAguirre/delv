const Delv = ({cache, queryManager, network, networkPolicies, defaults = {}}) => {
    const registeredPolicies = Object.create(null)
    const defaultNetworkPolicy = defaults.networkPolicy || 'cache-first'
    const defaultCacheProcess = defaults.cacheProcess || 'type'

    const init = () => {
        setupNetworkPolicies(networkPolicies)
    }

    const setupNetworkPolicies = (policies) => {
        policies.forEach((PolicyClass) => {
            const policy = new PolicyClass({
                cache,
                queryManager,
                network
            })
            registeredPolicies[policy.getName()] = policy
        })
    }

    const query = async ({networkPolicy, query, variables, cacheProcess, ...other}) => {
        const policyName = networkPolicy || defaultNetworkPolicy
        const policy = registeredPolicies[policyName]
        if(!policy){
            throw new Error(`Unknown network policy: "${policyName}"`)
        }
        return policy.process({
            query,
            variables,
            cacheProcess: cacheProcess || defaultCacheProcess,
            ...other
        })
    }

    const readCache = ({query, variables, cacheProcess}) => {
        return cache.read({
            cacheProcess: cacheProcess || defaultCacheProcess,
            query,
            variables
        })
    }

    const subscribe = (callback) => {
        if(!cache.subscribe){
            return () => {}
        }
        return cache.subscribe(callback)
    }

    const getQueryTypes = (query) => {
        if(!cache.getQueryTypes){
            return []
        }
        return cache.getQueryTypes(query)
    }

    const reset = () => {
        queryManager.clear()
        cache.clear()
    }

    init()

    return {
        query,
        readCache,
        subscribe,
        getQueryTypes,
        reset
    }
}

module.exports = Delv
