const Delv = require('../../src/core/delv')
const createDebugSidecar = require('../../src/debug/Diagnostics')
const CacheFirst = require('../../src/networkPolicy/CacheFirst')
const QueryManager = require('../../src/queryManager/QueryManager')
const Storage = require('../../src/cache/storage/InMemoryStore')

const setup = sidecar => {
    let listener
    const data = {user: {id: '1'}}
    const cache = {
        read: jest.fn(() => data),
        write: jest.fn(() => listener && listener(['User'])),
        clear: jest.fn(),
        inspect: () => ({User: {'1': data.user}}),
        subscribe: jest.fn(callback => { listener = callback; return () => { listener = null } })
    }
    const network = {post: jest.fn(() => Promise.resolve({data: {data}}))}
    const client = Delv({cache, network, queryManager: new QueryManager(), networkPolicies: [CacheFirst], sidecar})
    return {client, cache, network, data}
}

test('core works without installing or subscribing to a sidecar', async () => {
    const {client, cache} = setup()
    await expect(client.query({query: '{user{id}}'})).resolves.toEqual({user: {id: '1'}})
    expect(cache.subscribe).not.toHaveBeenCalled()
    expect(client.debug).toBeUndefined()
})

test('sidecar records actual requests, cache reads, writes, emissions and resets', async () => {
    const sidecar = createDebugSidecar()
    const {client, network, data} = setup(sidecar)
    await client.query({query: '{user{id}}'})
    await client.query({query: '{user{id}}'})
    expect(network.post).toHaveBeenCalledTimes(1)
    expect(sidecar.getEvents().map(event => event.kind)).toEqual([
        'cache.read.start', 'cache.read.success',
        'network.request.start', 'network.request.success', 'cache.write.start',
        'cache.types', 'cache.write.success', 'cache.read.start', 'cache.read.success'
    ])
    const inspected = sidecar.inspectCache()
    inspected.User['1'].id = 'changed'
    expect(data.user.id).toBe('1')
    data.user.id = '2'
    expect(sidecar.getEvents().find(event => event.kind === 'cache.read.success').result.user.id).toBe('1')
    client.reset()
    expect(sidecar.getEvents().slice(-1)[0].kind).toBe('cache.clear.success')
})

test('observer hook errors do not change successful results or original failures', async () => {
    const failure = new Error('observer failed')
    const sidecar = {
        connect: () => { throw failure },
        onNetworkRequest: () => ({success: () => { throw failure }, error: () => { throw failure }}),
        onCacheRead: () => { throw failure }
    }
    const {client, network} = setup(sidecar)
    await expect(client.query({query: '{user{id}}'})).resolves.toEqual({user: {id: '1'}})
    expect(client.readCache({query: '{user{id}}'})).toEqual({user: {id: '1'}})
    const original = new Error('offline')
    network.post.mockRejectedValueOnce(original)
    await expect(client.query({query: '{other{id}}'})).rejects.toBe(original)
})

test('retention, clearing, and disposal belong to the sidecar', async () => {
    const sidecar = createDebugSidecar({maxEvents: 2})
    const {client} = setup(sidecar)
    const update = jest.fn()
    const unsubscribe = sidecar.subscribe(update)
    await client.query({query: '{user{id}}'})
    expect(sidecar.getEvents()).toHaveLength(2)
    sidecar.clear()
    expect(sidecar.getEvents()).toEqual([])
    expect(update).toHaveBeenCalled()
    unsubscribe()
    sidecar.dispose()
    client.readCache({query: '{user{id}}'})
    expect(sidecar.getEvents()).toEqual([])
    expect(sidecar.inspectCache()).toEqual({})
})

test('storage inspection includes normalized buckets and absolute query values', () => {
    const store = Storage()
    store.set('1', 'User', {id: '1'})
    store.setAbsolute('query-key', {users: [1]})
    expect(store.inspect()).toEqual({User: {'1': {id: '1'}}, 'query-key': {users: [1]}})
})

test('failed requests are paired with their start and preserve the original rejection', async () => {
    const sidecar = createDebugSidecar()
    const {client, network} = setup(sidecar)
    const error = new Error('offline')
    network.post.mockRejectedValueOnce(error)
    await expect(client.query({query: '{user{id}}'})).rejects.toBe(error)
    const [start, end] = sidecar.getEvents().filter(event => event.kind.startsWith('network.request.'))
    expect(end.kind).toBe('network.request.error')
    expect(end.operationId).toBe(start.operationId)
    expect(end.error.message).toBe('offline')
    expect(end.duration).toBeGreaterThanOrEqual(0)
})
