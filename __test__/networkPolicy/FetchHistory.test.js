const Delv = require('../../src/core/delv')
const QueryManager = require('../../src/queryManager/QueryManager')
const CacheFirst = require('../../src/networkPolicy/CacheFirst')
const NetworkFirst = require('../../src/networkPolicy/NetworkFirst')
const NetworkOnly = require('../../src/networkPolicy/NetworkOnly')

const query = 'query Users { users { id } }'
const setup = () => {
    let value
    const cache = {
        read: jest.fn(() => value),
        write: jest.fn(({data}) => { value = data.data }),
        clear: jest.fn(() => { value = undefined })
    }
    const requests = []
    const network = {post: jest.fn(() => new Promise((resolve, reject) => requests.push({resolve, reject})))}
    const client = Delv({cache, network, queryManager: new QueryManager(), networkPolicies: [CacheFirst, NetworkFirst, NetworkOnly]})
    return {cache, network, client, requests}
}

describe.each(['network-first', 'cache-first'])('%s fetch history', networkPolicy => {
    it.each([{users: []}, {users: null}, null])('records successful empty results: %p', async data => {
        const {client, requests, network, cache} = setup()
        const options = {query, networkPolicy}
        const first = client.query(options)
        requests[0].resolve({data: {data}})
        await expect(first).resolves.toEqual(data)
        expect(client.getCachedResult(options)).toEqual(data)
        await expect(client.query(options)).resolves.toEqual(data)
        expect(network.post).toHaveBeenCalledTimes(1)
        cache.write({data: {data: {users: [{id: 'updated'}]}}})
        await expect(client.query(options)).resolves.toEqual({users: [{id: 'updated'}]})
        client.reset()
        const next = client.query(options)
        expect(network.post).toHaveBeenCalledTimes(2)
        requests[1].resolve({data: {data}})
        await next
    })

    it('deduplicates across policies and variable key order, and retries failures', async () => {
        const {client, requests, network} = setup()
        const first = client.query({query, networkPolicy, variables: {a: 1, filter: {x: 2, y: 3}}})
        const second = client.query({query, networkPolicy: 'cache-first', variables: {filter: {y: 3, x: 2}, a: 1}})
        expect(network.post).toHaveBeenCalledTimes(1)
        requests[0].reject(new Error('offline'))
        await expect(first).rejects.toThrow('offline')
        await expect(second).rejects.toThrow('offline')
        const retry = client.query({query, networkPolicy, variables: {a: 1, filter: {x: 2, y: 3}}})
        expect(network.post).toHaveBeenCalledTimes(2)
        requests[1].resolve({data: {data: {users: []}}})
        await retry
    })

    it('fetches distinct selections and variables separately', async () => {
        const {client, requests, network} = setup()
        const promises = [
            client.query({query, networkPolicy, variables: {id: 1}}),
            client.query({query, networkPolicy, variables: {id: 2}}),
            client.query({query: 'query Users { users { id name } }', networkPolicy, variables: {id: 1}})
        ]
        expect(network.post).toHaveBeenCalledTimes(3)
        requests.forEach(request => request.resolve({data: {data: {users: []}}}))
        await Promise.all(promises)
    })

    it('does not let a pre-reset request repopulate cache or history', async () => {
        const {client, requests, network, cache} = setup()
        const first = client.query({query, networkPolicy})
        client.reset()
        requests[0].resolve({data: {data: {users: []}}})
        await first
        expect(cache.write).not.toHaveBeenCalled()
        const second = client.query({query, networkPolicy})
        expect(network.post).toHaveBeenCalledTimes(2)
        requests[1].resolve({data: {data: {users: []}}})
        await second
    })
})

it('delivers cached and fresh results to every cache-first caller', async () => {
    const {client, cache, requests, network} = setup()
    const cached = {users: [{id: 'cached'}]}
    const fresh = {users: []}
    cache.write({data: {data: cached}})
    const firstResult = jest.fn(), secondResult = jest.fn()
    const first = client.query({query, onResult: firstResult})
    const second = client.query({query, onResult: secondResult})
    expect(firstResult.mock.calls).toEqual([[cached]])
    expect(secondResult.mock.calls).toEqual([[cached]])
    expect(network.post).toHaveBeenCalledTimes(1)
    requests[0].resolve({data: {data: fresh}})
    await Promise.all([first, second])
    expect(firstResult.mock.calls).toEqual([[cached], [fresh]])
    expect(secondResult.mock.calls).toEqual([[cached], [fresh]])
})

it('network-first ignores cached data before success and propagates failures', async () => {
    const {client, cache, requests} = setup()
    cache.write({data: {data: {users: []}}})
    const options = {query, networkPolicy: 'network-first'}
    expect(client.getCachedResult(options)).toBeUndefined()
    const promise = client.query(options)
    requests[0].reject(new Error('offline'))
    await expect(promise).rejects.toThrow('offline')
})
