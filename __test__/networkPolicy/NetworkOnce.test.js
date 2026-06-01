const NetworkOnce = require('../../src/networkPolicy/NetworkOnce')
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
        policy: new NetworkOnce({cache, network, queryManager})
    }
}

describe('NetworkOnce', () => {
    it('fetches and writes on the first call', () => {
        const {cache, network, policy} = createPolicy()
        network.post.mockResolvedValue(response)

        return expect(policy.process({query, variables, cacheProcess: 'type'})).resolves.toEqual(response.data.data)
            .then(() => {
                expect(network.post).toHaveBeenCalledWith({query, variables})
                expect(cache.write).toHaveBeenCalledWith({cacheProcess: 'type', data: response.data})
            })
    })

    it('reads from cache after the first successful network call', () => {
        const {cache, network, policy} = createPolicy()
        const cached = {user: {id: '1', name: 'Nolan'}}
        network.post.mockResolvedValue(response)
        cache.read.mockReturnValue(cached)

        return policy.process({query, variables, cacheProcess: 'type'})
            .then(() => {
                const second = policy.process({query, variables, cacheProcess: 'type'})
                const third = policy.process({query, variables, cacheProcess: 'type'})

                expect(third).toBe(second)
                return expect(second).resolves.toBe(cached)
            })
            .then(() => {
                expect(network.post).toHaveBeenCalledTimes(1)
                expect(cache.read).toHaveBeenCalledTimes(1)
            })
    })

    it('deduplicates in-flight network calls', () => {
        const {network, policy} = createPolicy()
        let resolveNetwork
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
        const {network, policy} = createPolicy()
        const error = new Error('network failed')
        network.post.mockRejectedValue(error)

        return expect(policy.process({query, variables, cacheProcess: 'type'})).rejects.toBe(error)
    })
})
