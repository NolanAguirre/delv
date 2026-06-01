const Delv = require('../../src/core/delv')

const query = '{ user { id } }'
const variables = {id: '1'}

const makePolicy = (name) => {
    const process = jest.fn(() => Promise.resolve('result'))
    class FakePolicy {
        constructor(deps) {
            this.deps = deps
        }
        getName = () => name
        process = process
    }
    return {FakePolicy, process}
}

const setup = ({defaults, extraPolicies = [], cacheOverrides = {}} = {}) => {
    const cache = {
        read: jest.fn(() => 'cached'),
        clear: jest.fn(),
        subscribe: jest.fn(() => 'unsubscribe'),
        getQueryTypes: jest.fn(() => ['User']),
        ...cacheOverrides
    }
    const queryManager = {clear: jest.fn()}
    const network = {post: jest.fn()}
    const {FakePolicy: CacheFirst, process: cacheFirstProcess} = makePolicy('cache-first')

    const delv = Delv({
        cache,
        queryManager,
        network,
        networkPolicies: [CacheFirst, ...extraPolicies],
        defaults
    })

    return {delv, cache, queryManager, network, cacheFirstProcess}
}

describe('Delv core factory', () => {
    it('routes query() to the registered policy by name', () => {
        const {FakePolicy: NetworkOnly, process: networkOnlyProcess} = makePolicy('network-only')
        const {delv} = setup({extraPolicies: [NetworkOnly]})

        return delv.query({networkPolicy: 'network-only', query, variables}).then((res) => {
            expect(res).toBe('result')
            expect(networkOnlyProcess).toHaveBeenCalledWith({
                query,
                variables,
                cacheProcess: 'type'
            })
        })
    })

    it('applies default networkPolicy and cacheProcess', () => {
        const {delv, cacheFirstProcess} = setup()

        return delv.query({query, variables}).then(() => {
            expect(cacheFirstProcess).toHaveBeenCalledWith({
                query,
                variables,
                cacheProcess: 'type'
            })
        })
    })

    it('honors configured defaults', () => {
        const {FakePolicy: NetworkOnly, process: networkOnlyProcess} = makePolicy('network-only')
        const {delv} = setup({
            extraPolicies: [NetworkOnly],
            defaults: {networkPolicy: 'network-only', cacheProcess: 'query'}
        })

        return delv.query({query, variables}).then(() => {
            expect(networkOnlyProcess).toHaveBeenCalledWith({
                query,
                variables,
                cacheProcess: 'query'
            })
        })
    })

    it('passes through extra args', () => {
        const {delv, cacheFirstProcess} = setup()

        return delv.query({query, variables, pollInterval: 1000}).then(() => {
            expect(cacheFirstProcess).toHaveBeenCalledWith({
                query,
                variables,
                cacheProcess: 'type',
                pollInterval: 1000
            })
        })
    })

    it('throws on an unknown policy name', () => {
        const {delv} = setup()

        return expect(delv.query({networkPolicy: 'nope', query, variables}))
            .rejects.toThrow('Unknown network policy: "nope"')
    })

    it('delegates readCache() to cache.read with resolved cacheProcess', () => {
        const {delv, cache} = setup()

        expect(delv.readCache({query, variables})).toBe('cached')
        expect(cache.read).toHaveBeenCalledWith({cacheProcess: 'type', query, variables})

        delv.readCache({query, variables, cacheProcess: 'query'})
        expect(cache.read).toHaveBeenCalledWith({cacheProcess: 'query', query, variables})
    })

    it('subscribe() delegates when cache supports it', () => {
        const {delv, cache} = setup()
        const callback = jest.fn()

        expect(delv.subscribe(callback)).toBe('unsubscribe')
        expect(cache.subscribe).toHaveBeenCalledWith(callback)
    })

    it('subscribe() returns a no-op when cache lacks subscribe', () => {
        const {delv} = setup({cacheOverrides: {subscribe: undefined}})

        const unsubscribe = delv.subscribe(jest.fn())
        expect(unsubscribe).toBeInstanceOf(Function)
        expect(unsubscribe()).toBeUndefined()
    })

    it('getQueryTypes() delegates when cache supports it', () => {
        const {delv, cache} = setup()

        expect(delv.getQueryTypes(query)).toEqual(['User'])
        expect(cache.getQueryTypes).toHaveBeenCalledWith(query)
    })

    it('getQueryTypes() returns [] when cache lacks getQueryTypes', () => {
        const {delv} = setup({cacheOverrides: {getQueryTypes: undefined}})

        expect(delv.getQueryTypes(query)).toEqual([])
    })

    it('reset() clears the queryManager and cache', () => {
        const {delv, cache, queryManager} = setup()

        delv.reset()
        expect(queryManager.clear).toHaveBeenCalled()
        expect(cache.clear).toHaveBeenCalled()
    })
})
