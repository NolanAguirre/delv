const NetworkFirst = require('./NetworkFirst')

class CacheFirst extends NetworkFirst {
    getName = () => 'cache-first'

    getCachedResult = ({query, variables, cacheProcess}) => {
        if(this.queryManager.get({query, variables}).isMutation) return undefined
        try {
            return this.cache.read({query, variables, cacheProcess})
        } catch {
            return undefined
        }
    }

    // Deliver a synchronous snapshot while the promise represents the final result.
    process = ({onResult, ...options}) => {
        const cached = this.getCachedResult(options)
        if(cached !== undefined && onResult) onResult(cached)
        const {query, variables} = options
        const completed = this.queryManager.get({query, variables}).success
        const promise = completed ? Promise.resolve(cached) : this.fetch(options)
        if(!onResult || completed) return promise
        return promise.then(data => {
            onResult(data)
            return data
        })
    }
}

module.exports = CacheFirst
