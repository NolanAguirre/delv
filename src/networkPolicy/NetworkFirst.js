const NetworkOnly = require('./NetworkOnly')

class NetworkFirst extends NetworkOnly {
    getName = () => 'network-first'

    getCachedResult = ({query, variables, cacheProcess}) => {
        if(!this.queryManager.get({query, variables}).success) return undefined
        return this.cache.read({query, variables, cacheProcess})
    }

    process = (options) => {
        const {query, variables} = options
        if(this.queryManager.get({query, variables}).success){
            return Promise.resolve().then(() => this.getCachedResult(options))
        }
        return this.fetch(options)
    }
}

module.exports = NetworkFirst
