function Delv({cache, queryManager, network, networkPolicies}) {
    const queuedQueries = []

    const init = () => {
        setupNetworkPolicies(networkPolicies)
    }

    const setupNetworkPolicies = (policies) => {
        policies = Object.create(null)
        policies.forEach(process => {
            const policy = new process({
                cache,
                queryManager,
                network
            })
            policies[policy.getName()] = policy
        })
    }

    const query = async ({networkPolicy, query, variables, ...other}) => {
        return await policies[networkPolicy].process({
            ...other,
            query,
            variables
        })
    }

    const reset = () => {
        queryManager.clear();
        cache.clear();
    }
    return {
        init,
        query,
        reset
    }
}

module.exports = Delv
