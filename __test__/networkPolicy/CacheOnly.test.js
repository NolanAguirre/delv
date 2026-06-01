const CacheOnly = require('../../src/networkPolicy/CacheOnly')
const QueryManager = require('../../src/queryManager/QueryManager')

const query = '{ user { id } }'

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
        policy: new CacheOnly({cache, network, queryManager})
    }
}

describe('CacheOnly', () => {
    it('returns cache data', () => {
        const {cache, network, policy} = createPolicy()
        const data = {user: {id: '1'}}
        cache.read.mockReturnValue(data)

        expect(network.post).not.toHaveBeenCalled()
        return expect(policy.process({query, cacheProcess: 'type'})).resolves.toBe(data)
    })

    it('rejects when cache read fails', () => {
        const {cache, policy} = createPolicy()
        const error = new Error('cache miss')
        cache.read.mockImplementation(() => {
            throw error
        })

        return expect(policy.process({query, cacheProcess: 'type'})).rejects.toBe(error)
    })
})
