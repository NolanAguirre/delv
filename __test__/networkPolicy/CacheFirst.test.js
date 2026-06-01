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
    it('returns cache data on hit', () => {
        const {cache, network, policy} = createPolicy()
        const data = {user: {id: '1'}}
        cache.read.mockReturnValue(data)
        const promise = policy.process({query, variables, cacheProcess: 'type'})

        expect(network.post).not.toHaveBeenCalled()
        return expect(promise).resolves.toBe(data)
    })

    it('fetches and writes to cache on miss', () => {
        const {cache, network, policy} = createPolicy()
        const error = new Error('cache miss')
        cache.read.mockImplementation(() => {
            throw error
        })
        network.post.mockResolvedValue(response)

        return expect(policy.process({query, variables, cacheProcess: 'type'})).resolves.toEqual(response.data.data)
            .then(() => {
                expect(network.post).toHaveBeenCalledWith({query, variables})
                expect(cache.write).toHaveBeenCalledWith({cacheProcess: 'type', data: response.data})
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
