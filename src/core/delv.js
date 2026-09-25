const {observe, call} = require('./observe')
const NetworkOnly = require('../networkPolicy/NetworkOnly')

const Delv = ({cache, queryManager, network, networkPolicies, defaults = {}, sidecar, reverseReferences, mutationActions}) => {
    if(cache.configureReverseReferences) cache.configureReverseReferences(reverseReferences)
    if(cache.configureMutationActions) cache.configureMutationActions(mutationActions)
    const sourceCache = cache
    call(sidecar, 'connect', {
        inspectCache: () => sourceCache.inspect ? sourceCache.inspect() : sourceCache.toString(),
        subscribe: callback => sourceCache.subscribe ? sourceCache.subscribe(callback) : () => {}
    })
    cache = observe(cache, sidecar, {read: 'onCacheRead', write: 'onCacheWrite', clear: 'onCacheClear'})
    network = observe(network, sidecar, {post: 'onNetworkRequest'})
    const registeredPolicies = Object.create(null)
    const defaultNetworkPolicy = defaults.networkPolicy || 'cache-first'
    const defaultCacheProcess = defaults.cacheProcess || 'type'

    const init = () => {
        setupNetworkPolicies(networkPolicies)
    }

    const setupNetworkPolicies = (policies) => {
        policies.forEach((PolicyClass) => {
            const options = {
                cache,
                queryManager,
                network
            }
            const policy = PolicyClass.prototype ? new PolicyClass(options) : PolicyClass(options)
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

    const networkOnly = () => registeredPolicies['network-only'] || new NetworkOnly({cache, network, queryManager})

    const refetch = async ({query, variables, cacheProcess}) => networkOnly().process({
        query,
        variables,
        cacheProcess: cacheProcess || defaultCacheProcess
    })

    const helpers = sourceCache.helpers ? sourceCache.helpers() : {}
    let optimisticCount = 0

    const mutate = async ({mutation, variables, refetchQueries = [], networkPolicy, cacheProcess, optimistic, update, ...other}) => {
        const optimisticId = optimistic && cache.applyOptimistic ? `optimistic:${++optimisticCount}` : undefined
        const pending = networkOnly().process({
            query: mutation,
            variables,
            cacheProcess: cacheProcess || defaultCacheProcess,
            ...other
        })
        if(optimisticId){
            cache.applyOptimistic(optimisticId, optimistic, {mutation, variables})
        }
        let data
        try{
            data = await pending
        }catch(error){
            if(optimisticId) cache.rollbackOptimistic(optimisticId)
            throw error
        }
        if(optimisticId) cache.discardOptimistic(optimisticId)
        if(update){
            const run = () => update({...helpers, result: data, mutation, variables})
            try{
                if(cache.batch) cache.batch(run)
                else run()
            }catch(error){
                console.error('delv: mutation update hook failed.', error)
            }
        }
        await Promise.all(refetchQueries.map((entry) => {
            const refetchPolicyName = entry.networkPolicy || 'network-only'
            const refetchPolicy = registeredPolicies[refetchPolicyName]
            if(!refetchPolicy){
                return Promise.resolve()
            }
            return Promise.resolve()
                .then(() => refetchPolicy.process({
                    query: entry.query,
                    variables: entry.variables,
                    cacheProcess: entry.cacheProcess || defaultCacheProcess
                }))
                .catch(() => {})
        }))
        return data
    }

    const readCache = ({query, variables, cacheProcess}) => {
        return cache.read({
            cacheProcess: cacheProcess || defaultCacheProcess,
            query,
            variables
        })
    }

    const getCachedResult = ({networkPolicy, cacheProcess, ...options}) => {
        const policy = registeredPolicies[networkPolicy || defaultNetworkPolicy]
        if(!policy || !policy.getCachedResult) return undefined
        try {
            return policy.getCachedResult({...options, cacheProcess: cacheProcess || defaultCacheProcess})
        } catch {
            return undefined
        }
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
        defaults: {...defaults},
        getSchemaIssues: () => sourceCache.getSchemaIssues ? sourceCache.getSchemaIssues() : [],
        query,
        refetch,
        mutate,
        readCache,
        getCachedResult,
        getMockResult: (options) => {
            if(!cache.getMockResult) throw new Error('delv: mock loading requires a cache with a type map')
            return cache.getMockResult(options)
        },
        subscribe,
        getQueryTypes,
        reset,
        cache: helpers.cache,
        cacheByType: helpers.cacheByType
    }
}

module.exports = Delv
