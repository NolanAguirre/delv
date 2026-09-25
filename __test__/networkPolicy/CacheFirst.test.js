const CacheFirst = require('../../src/networkPolicy/CacheFirst')
const QueryManager = require('../../src/queryManager/QueryManager')

const query = '{ user { id } }'
const variables = {id: '1'}
const response = {data: {data: {user: {id: '1'}}}}

const createPolicy = () => {
    const cache = {
        read: jest.fn(),
        write: jest.fn(),
        clear: jest.fn()
    }
    const network = {
        post: jest.fn()
    }
    const queryManager = new QueryManager()

    return {
        cache,
        network,
        queryManager,
        policy: new CacheFirst({cache, network, queryManager})
    }
}

describe('CacheFirst', () => {
    it('fetches on the first request even when the cache has data', () => {
        const {cache, network, policy} = createPolicy()
        cache.read.mockReturnValue({user: {id: 'stale'}})
        network.post.mockResolvedValue(response)

        return expect(policy.process({query, variables, cacheProcess: 'type'})).resolves.toEqual(response.data.data)
            .then(() => {
                expect(network.post).toHaveBeenCalledWith({query, variables})
                expect(cache.write).toHaveBeenCalledWith({cacheProcess: 'type', data: response.data, query, variables,
                    connectionSource: {data: response.data.data, selectionQuery: query}})
            })
    })

    it('serves the cache on subsequent requests after a successful fetch', () => {
        const {cache, network, policy} = createPolicy()
        const cached = {user: {id: '1'}}
        network.post.mockResolvedValue(response)
        cache.read.mockReturnValue(cached)

        return policy.process({query, variables, cacheProcess: 'type'}).then(() => {
            expect(network.post).toHaveBeenCalledTimes(1)
            const second = policy.process({query, variables, cacheProcess: 'type'})
            expect(network.post).toHaveBeenCalledTimes(1)
            return expect(second).resolves.toBe(cached)
        })
    })

    it('does not refetch a completed query until reset', () => {
        const {cache, network, policy} = createPolicy()
        network.post.mockResolvedValue(response)
        cache.read.mockImplementation(() => {
            throw new Error('cache miss')
        })

        return policy.process({query, variables, cacheProcess: 'type'}).then(() => {
            expect(network.post).toHaveBeenCalledTimes(1)
            return policy.process({query, variables, cacheProcess: 'type'}).then(() => {
                expect(network.post).toHaveBeenCalledTimes(1)
            })
        })
    })

    it('deduplicates in-flight network calls', () => {
        const {cache, network, policy} = createPolicy()
        let resolveNetwork
        cache.read.mockImplementation(() => {
            throw new Error('cache miss')
        })
        network.post.mockReturnValue(new Promise((resolve) => {
            resolveNetwork = resolve
        }))

        const first = policy.process({query, variables, cacheProcess: 'type'})
        const second = policy.process({query, variables, cacheProcess: 'type'})

        expect(second).toBe(first)
        expect(network.post).toHaveBeenCalledTimes(1)

        resolveNetwork(response)
        return expect(first).resolves.toEqual(response.data.data)
    })

    it('rejects network errors', () => {
        const {cache, policy, network} = createPolicy()
        const error = new Error('network failed')
        cache.read.mockImplementation(() => {
            throw new Error('cache miss')
        })
        network.post.mockRejectedValue(error)

        return expect(policy.process({query, variables, cacheProcess: 'type'})).rejects.toBe(error)
    })
})
