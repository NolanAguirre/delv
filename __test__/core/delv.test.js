const Delv = require('../../src/core/delv')
const QueryManager = require('../../src/queryManager/QueryManager')
const NetworkOnly = require('../../src/networkPolicy/NetworkOnly')
const CacheFirst = require('../../src/networkPolicy/CacheFirst')
const NetworkOnce = require('../../src/networkPolicy/NetworkOnce')

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

    it('refetch() always uses network-only and ignores a policy override', () => {
        const {FakePolicy: NetworkOnly, process: networkOnlyProcess} = makePolicy('network-only')
        const {delv, cacheFirstProcess} = setup({extraPolicies: [NetworkOnly]})

        return delv.refetch({networkPolicy: 'cache-first', query, variables, cacheProcess: 'query'}).then((res) => {
            expect(res).toBe('result')
            expect(cacheFirstProcess).not.toHaveBeenCalled()
            expect(networkOnlyProcess).toHaveBeenCalledWith({query, variables, cacheProcess: 'query'})
        })
    })

    it('refetch() hits the network even when network-only is not registered', async () => {
        const network = {post: jest.fn(() => Promise.resolve({data: {data: {user: {id: '1'}}}}))}
        const cache = {write: jest.fn(), read: jest.fn(() => ({user: {id: 'cached'}}))}
        const delv = Delv({cache, network, queryManager: new QueryManager(), networkPolicies: [CacheFirst]})

        await delv.query({query, variables})
        await delv.refetch({query, variables})
        await delv.refetch({query, variables})
        expect(network.post).toHaveBeenCalledTimes(3)
        expect(cache.write).toHaveBeenCalledTimes(3)
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

describe('Delv.mutate', () => {
    it.each([NetworkOnly, CacheFirst, NetworkOnce])(
        'executes concurrent identical mutations independently with %p', async (Policy) => {
            const requests = []
            const network = {post: jest.fn(() => new Promise((resolve, reject) => {
                requests.push({resolve, reject})
            }))}
            const cache = {write: jest.fn(), read: jest.fn()}
            const delv = Delv({cache, network, queryManager: new QueryManager(), networkPolicies: [Policy]})
            const args = {
                mutation: 'mutation Increment { increment { id count } }',
                variables: {id: '1'},
                networkPolicy: new Policy({}).getName()
            }
            const first = delv.mutate(args)
            const second = delv.mutate(args)
            expect(network.post).toHaveBeenCalledTimes(2)

            const data = {increment: {id: '1', count: 2}}
            requests[1].resolve({data: {data}})
            await expect(second).resolves.toEqual(data)
            const error = new Error('first mutation failed')
            requests[0].reject(error)
            await expect(first).rejects.toBe(error)
            expect(cache.write).toHaveBeenCalledTimes(1)

            const third = delv.mutate(args)
            expect(network.post).toHaveBeenCalledTimes(3)
            requests[2].resolve({data: {data}})
            await expect(third).resolves.toEqual(data)
            expect(cache.write).toHaveBeenCalledTimes(2)
            expect(cache.read).not.toHaveBeenCalled()
        }
    )

    const mutation = 'mutation { createUser { id } }'

    it('routes to network-only by default', () => {
        const {FakePolicy: NetworkOnly, process: networkOnlyProcess} = makePolicy('network-only')
        const {delv} = setup({extraPolicies: [NetworkOnly]})

        return delv.mutate({mutation, variables}).then(() => {
            expect(networkOnlyProcess).toHaveBeenCalledWith({
                query: mutation,
                variables,
                cacheProcess: 'type'
            })
        })
    })

    it('keeps mutations network-only despite an explicit cache policy', () => {
        const {FakePolicy: NetworkOnly, process: networkOnlyProcess} = makePolicy('network-only')
        const {delv, cacheFirstProcess} = setup({extraPolicies: [NetworkOnly]})

        return delv.mutate({mutation, variables, networkPolicy: 'cache-first'}).then(() => {
            expect(cacheFirstProcess).not.toHaveBeenCalled()
            expect(networkOnlyProcess).toHaveBeenCalledWith({
                query: mutation,
                variables,
                cacheProcess: 'type'
            })
        })
    })

    it('passes the resolved cacheProcess', () => {
        const {FakePolicy: NetworkOnly, process: networkOnlyProcess} = makePolicy('network-only')
        const {delv} = setup({extraPolicies: [NetworkOnly]})

        return delv.mutate({mutation, variables, cacheProcess: 'query'}).then(() => {
            expect(networkOnlyProcess).toHaveBeenCalledWith({
                query: mutation,
                variables,
                cacheProcess: 'query'
            })
        })
    })

    it('returns the mutation data', () => {
        const {FakePolicy: NetworkOnly} = makePolicy('network-only')
        const {delv} = setup({extraPolicies: [NetworkOnly]})

        return delv.mutate({mutation, variables}).then((res) => {
            expect(res).toBe('result')
        })
    })

    it('runs each refetchQueries entry through the right policy', () => {
        const {FakePolicy: NetworkOnly, process: networkOnlyProcess} = makePolicy('network-only')
        const {delv, cacheFirstProcess} = setup({extraPolicies: [NetworkOnly]})
        const refetchQuery = '{ users { id } }'

        return delv.mutate({
            mutation,
            variables,
            refetchQueries: [
                {query: refetchQuery, variables: {}},
                {query: refetchQuery, variables: {page: 2}, networkPolicy: 'cache-first', cacheProcess: 'query'}
            ]
        }).then(() => {
            expect(networkOnlyProcess).toHaveBeenCalledWith({
                query: refetchQuery,
                variables: {},
                cacheProcess: 'type'
            })
            expect(cacheFirstProcess).toHaveBeenCalledWith({
                query: refetchQuery,
                variables: {page: 2},
                cacheProcess: 'query'
            })
        })
    })

    it('ignores the query policy override for mutations', () => {
        const {FakePolicy: NetworkOnly} = makePolicy('network-only')
        const {delv} = setup({extraPolicies: [NetworkOnly]})

        return expect(delv.mutate({mutation, variables, networkPolicy: 'nope'}))
            .resolves.toBe('result')
    })

    it('does not reject when a refetch fails', () => {
        const process = jest.fn(() => Promise.resolve('result'))
        class NetworkOnly {
            getName = () => 'network-only'
            process = process
        }
        const refetchQuery = '{ users { id } }'
        // second call (the refetch) rejects
        process
            .mockImplementationOnce(() => Promise.resolve('result'))
            .mockImplementationOnce(() => Promise.reject(new Error('refetch failed')))

        const {delv} = setup({extraPolicies: [NetworkOnly]})

        return delv.mutate({
            mutation,
            variables,
            refetchQueries: [{query: refetchQuery, variables: {}}]
        }).then((res) => {
            expect(res).toBe('result')
        })
    })
})

describe('Delv.mutate optimistic and update hooks', () => {
    const mutation = 'mutation CreateBook { createBook(input: {}) { book { id title } } }'

    const setupHooks = () => {
        const order = []
        const requests = []
        const network = {post: jest.fn(() => {
            order.push('post')
            return new Promise((resolve, reject) => requests.push({resolve, reject}))
        })}
        const helpers = {cache: 'raw', cacheByType: 'byType', typeMap: 'typeMap'}
        const cache = {
            write: jest.fn(() => order.push('write')),
            applyOptimistic: jest.fn(() => order.push('optimistic')),
            rollbackOptimistic: jest.fn(() => order.push('rollback')),
            discardOptimistic: jest.fn(() => order.push('discard')),
            batch: jest.fn((fn) => fn()),
            helpers: () => helpers
        }
        const delv = Delv({cache, network, queryManager: new QueryManager(), networkPolicies: [CacheFirst]})
        return {delv, cache, network, requests, order, helpers}
    }

    it('applies the optimistic hook after the request is dispatched and before the response', async () => {
        const {delv, cache, requests, order} = setupHooks()
        const optimistic = jest.fn()

        const pending = delv.mutate({mutation, variables, optimistic})

        expect(order).toEqual(['post', 'optimistic'])
        const [optimisticId, hook, context] = cache.applyOptimistic.mock.calls[0]
        expect(hook).toBe(optimistic)
        expect(context).toEqual({mutation, variables})
        requests[0].resolve({data: {data: {createBook: {book: {id: 'b1'}}}}})
        await pending
        expect(cache.write.mock.calls[0][0]).not.toHaveProperty('optimisticId')
        expect(cache.discardOptimistic).toHaveBeenCalledWith(optimisticId)
        expect(cache.rollbackOptimistic).not.toHaveBeenCalled()
        expect(optimistic).not.toHaveBeenCalled()
        expect(order).toEqual(['post', 'optimistic', 'write', 'discard'])
    })

    it('passes the result and helpers to update inside one cache batch', async () => {
        const {delv, cache, requests, helpers} = setupHooks()
        const update = jest.fn()

        const pending = delv.mutate({mutation, variables, update})
        expect(update).not.toHaveBeenCalled()
        requests[0].resolve({data: {data: {createBook: {book: {id: 'b1'}}}}})
        await pending

        expect(cache.applyOptimistic).not.toHaveBeenCalled()
        expect(cache.discardOptimistic).not.toHaveBeenCalled()
        expect(cache.batch).toHaveBeenCalledTimes(1)
        expect(update).toHaveBeenCalledWith({...helpers, result: {createBook: {book: {id: 'b1'}}}, mutation, variables})
    })

    it('rolls back the optimistic layer and rethrows when the mutation rejects', async () => {
        const {delv, cache, requests} = setupHooks()
        const update = jest.fn()

        const pending = delv.mutate({mutation, variables, optimistic: () => {}, update})
        const error = new Error('denied')
        requests[0].reject(error)

        await expect(pending).rejects.toBe(error)
        expect(cache.rollbackOptimistic).toHaveBeenCalledWith(cache.applyOptimistic.mock.calls[0][0])
        expect(cache.discardOptimistic).not.toHaveBeenCalled()
        expect(cache.write).not.toHaveBeenCalled()
        expect(update).not.toHaveBeenCalled()
    })

    it('logs update hook errors instead of rejecting a successful mutation', async () => {
        const {delv, requests} = setupHooks()
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

        const pending = delv.mutate({mutation, variables, update: () => { throw new Error('bad update') }})
        requests[0].resolve({data: {data: {createBook: {book: {id: 'b1'}}}}})

        await expect(pending).resolves.toEqual({createBook: {book: {id: 'b1'}}})
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('update hook failed'), expect.any(Error))
        spy.mockRestore()
    })

    it('shows optimistic data in a real cache until the mutation settles', async () => {
        const createCache = require('../../src/cache')
        const TypeMap = require('../../src/queryManager/Postgraphile')
        const books = 'query Books { allBooks { nodes { id title } } }'
        const responses = [
            {data: {data: {allBooks: {nodes: [{__typename: 'Book', id: 'b1', title: 'Dune'}]}}}}
        ]
        const requests = []
        const network = {post: jest.fn(() => responses.length
            ? Promise.resolve(responses.shift())
            : new Promise((resolve, reject) => requests.push({resolve, reject})))}
        const delv = Delv({
            cache: createCache(TypeMap({typeMap: require('../cache/__fixtures__/typemap.json')})),
            network,
            queryManager: new QueryManager(),
            networkPolicies: [CacheFirst]
        })
        const titles = () => delv.readCache({query: books}).allBooks.nodes.map((book) => book.title)
        await delv.query({query: books})

        const created = delv.mutate({
            mutation,
            optimistic: ({cacheByType}) => cacheByType.write('Book.temp-1', {title: 'Pending'}),
            update: ({cacheByType, result}) => {
                cacheByType.delete('Book.temp-1')
                cacheByType.update(`Book.${result.createBook.book.id}`, {title: 'Updated'})
            }
        })
        expect(titles()).toEqual(['Dune', 'Pending'])
        requests[0].resolve({data: {data: {createBook: {__typename: 'CreateBookPayload', book: {__typename: 'Book', id: 'b2', title: 'Neuromancer'}}}}})
        await created
        expect(titles()).toEqual(['Dune', 'Updated'])

        const failed = delv.mutate({
            mutation,
            optimistic: ({cacheByType}) => cacheByType.delete('Book.b1')
        })
        expect(titles()).toEqual(['Updated'])
        requests[1].reject(new Error('denied'))
        await expect(failed).rejects.toThrow('denied')
        expect(titles()).toEqual(['Dune', 'Updated'])
        expect(delv.cacheByType.read('Book.b1').title).toBe('Dune')
    })
})
