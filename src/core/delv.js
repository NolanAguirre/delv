import TypeMap from './TypeMap'
import cache from './Cache'
import QueryManager from './QueryManager'

class Delv {
    constructor({cache, queryManager, network, networkPolicies}) {
        this.cache = cache
        this.queryManager = queryManager
        this.network = network
        this.networkPolicies = networkPolicies({query:network.query, cache:this.cache})
        this.queuedQueries = []
    }

    query = ({networkPolicy, ...other}}) => {
        return this.networkPolicies[networkPolicy]({
            ...other,
            network:this.network,
            cache:this.cache,
            queryManager:this.queryManager
        }).then((data) => {
            this.cache[cacheProcess](other)
            return data
        }).catch((error) => {
            throw error
        })
    }

    reset = () => {
        this.queryManager.clear();
        this.cache.clear();
    }
}

export default new Delv();
