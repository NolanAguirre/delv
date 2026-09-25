import React from 'react'
import TestRenderer, {act} from 'react-test-renderer'
import Delv, {Delv as NamedDelv, DelvProvider, DelvQuery, useQuery, useMutation, withQuery} from '../../src/react/delv-react'

const query = '{ user { id } }'
const createDelv = require('../../src/core/delv')
const QueryManager = require('../../src/queryManager/QueryManager')
const CacheFirst = require('../../src/networkPolicy/CacheFirst')
const NetworkFirst = require('../../src/networkPolicy/NetworkFirst')

describe('real query policy rendering', () => {
    it.each(['cache-first', 'network-first'])('renders cached %s data synchronously on mount and variable changes', async networkPolicy => {
        const values = {a: {user: {id: 'a'}}, b: {user: {id: 'b'}}}
        const cache = {
            read: ({variables}) => values[variables.id],
            write: ({variables, data}) => { values[variables.id] = data.data }
        }
        const requests = []
        const network = {post: jest.fn(() => new Promise(resolve => requests.push(resolve)))}
        const client = createDelv({cache, network, queryManager: new QueryManager(), networkPolicies: [CacheFirst, NetworkFirst]})
        if(networkPolicy === 'network-first'){
            for(const id of ['a', 'b']){
                const pending = client.query({query, variables: {id}, networkPolicy})
                requests[requests.length - 1]({data: {data: values[id]}})
                await pending
            }
        }
        const renders = []
        const Capture = ({id}) => {
            const result = useQuery({query, variables: {id}, networkPolicy}, client)
            renders.push({id, loading: result.loading, data: result.data})
            return null
        }
        let view
        act(() => { view = TestRenderer.create(<Capture id='a' />) })
        expect(renders.every(result => !result.loading && result.data.user.id === 'a')).toBe(true)
        renders.length = 0
        act(() => { view.update(<Capture id='b' />) })
        expect(renders.every(result => !result.loading && result.data.user.id === 'b')).toBe(true)
        if(networkPolicy === 'cache-first'){
            await act(async () => { requests[1]({data: {data: {user: {id: 'fresh-b'}}}}) })
            expect(renders[renders.length - 1].data.user.id).toBe('fresh-b')
            await act(async () => { requests[0]({data: {data: {user: {id: 'old-a'}}}}) })
            expect(renders[renders.length - 1].data.user.id).toBe('fresh-b')
        }
        await act(async () => {})
        expect(network.post).toHaveBeenCalledTimes(2)
        act(() => { view.unmount() })
    })

    it.each(['cache-first', 'network-first'])('refetch always goes to the network under %s', async networkPolicy => {
        let value = {user: {id: 'cached'}}
        const cache = {read: () => value, write: ({data}) => { value = data.data }}
        const network = {post: jest.fn(() => Promise.resolve({data: {data: {user: {id: `fresh-${network.post.mock.calls.length}`}}}}))}
        const client = createDelv({cache, network, queryManager: new QueryManager(), networkPolicies: [CacheFirst, NetworkFirst]})
        await client.query({query, variables: {id: 'a'}, networkPolicy})
        expect(network.post).toHaveBeenCalledTimes(1)

        let latest
        const Capture = () => {
            latest = useQuery({query, variables: {id: 'a'}, networkPolicy}, client)
            return null
        }
        let view
        await act(async () => { view = TestRenderer.create(<Capture />) })
        expect(network.post).toHaveBeenCalledTimes(1)

        for(const expected of ['fresh-2', 'fresh-3']){
            await act(async () => { await latest.refetch() })
            expect(latest.data.user.id).toBe(expected)
        }
        expect(network.post).toHaveBeenCalledTimes(3)
        act(() => { view.unmount() })
    })
})

const createClient = (impl = {}) => ({
    query: jest.fn(() => Promise.resolve(undefined)),
    refetch: jest.fn(() => Promise.resolve(undefined)),
    mutate: jest.fn(() => Promise.resolve(undefined)),
    readCache: jest.fn(),
    subscribe: jest.fn(() => () => {}),
    getQueryTypes: jest.fn(() => []),
    ...impl
})

describe('Delv.query', () => {
    const User = ({user, label}) => <span>{label}: {user.name}</span>

    it('owns loading, injects formatted data and props, and follows cache updates', async () => {
        let resolve, notify
        const unsubscribe = jest.fn()
        const client = createClient({
            query: jest.fn(() => new Promise((done) => { resolve = done })),
            subscribe: jest.fn((callback) => { notify = callback; return unsubscribe }),
            readCache: jest.fn(() => ({user: {name: 'Grace'}}))
        })
        const onFetch = jest.fn(), onResolve = jest.fn()
        let view
        act(() => {
            view = TestRenderer.create(
                <DelvProvider client={client}>
                    <Delv.query query={query} label='Name' onFetch={onFetch} onResolve={onResolve}
                        formatResult={({user}) => ({user: {...user, name: user.name.toUpperCase()}})}>
                        <User label='Child label' />
                    </Delv.query>
                </DelvProvider>
            )
        })
        expect(NamedDelv).toBe(Delv)
        expect(view.root.findByProps({role: 'status'}).children).toEqual(['Loading…'])
        expect(view.root.findAllByType(User)).toHaveLength(0)
        expect(onFetch).toHaveBeenCalledWith(expect.any(Promise))
        await act(async () => { resolve({user: {name: 'Ada'}}) })
        expect(view.root.findByType(User).props).toEqual({user: {name: 'ADA'}, label: 'Name'})
        expect(onResolve).toHaveBeenCalledWith({user: {name: 'ADA'}})
        act(() => { notify(['User']) })
        expect(view.root.findByType(User).props.user.name).toBe('GRACE')
        expect(onResolve).toHaveBeenCalledTimes(1)
        act(() => { view.unmount() })
        expect(unsubscribe).toHaveBeenCalledTimes(1)
    })

    it('supports custom loading, client override, and variable changes', async () => {
        const requests = []
        const client = createClient({query: jest.fn(() => new Promise((resolve) => requests.push(resolve)))})
        const render = (id) => (
            <Delv.query client={client} query={query} variables={{id}} loading={<p>Please wait</p>}>
                <User />
            </Delv.query>
        )
        let view
        act(() => { view = TestRenderer.create(render('1')) })
        expect(view.toJSON().children).toEqual(['Please wait'])
        await act(async () => { requests[0]({user: {name: 'Ada'}}) })
        act(() => { view.update(render('2')) })
        expect(view.toJSON().children).toEqual(['Please wait'])
        expect(client.query.mock.calls[1][0].variables).toEqual({id: '2'})
        await act(async () => { requests[1]({user: {name: 'Grace'}}) })
        expect(view.root.findByType(User).props.user.name).toBe('Grace')
        act(() => { view.unmount() })
    })

    it('can render its child during loading or hide the wrapper with skip', async () => {
        let resolve
        const client = createClient({query: jest.fn(() => new Promise((done) => { resolve = done }))})
        const Child = () => <span>Ready</span>
        let view
        act(() => {
            view = TestRenderer.create(<Delv.query query={query} client={client} skipLoading><Child /></Delv.query>)
        })
        expect(view.root.findAllByType(Child)).toHaveLength(1)
        act(() => {
            view.update(<Delv.query query={query} client={client} skip><Child /></Delv.query>)
        })
        await act(async () => { resolve({user: {name: 'Ada'}}) })
        expect(view.toJSON()).toBeNull()
        expect(client.query).toHaveBeenCalledTimes(1)
        act(() => { view.unmount() })
    })

    it('shows an error fallback and allows retrying without rendering the data child', async () => {
        const failure = new Error('Offline')
        const client = createClient({
            query: jest.fn().mockRejectedValueOnce(failure),
            refetch: jest.fn().mockResolvedValueOnce({user: {name: 'Ada'}})
        })
        const onError = jest.fn()
        let view
        await act(async () => {
            view = TestRenderer.create(
                <Delv.query query={query} client={client} onError={onError}
                    error={(error, retry) => <button onClick={retry}>{error.message}</button>}>
                    <User />
                </Delv.query>
            )
        })
        expect(onError).toHaveBeenCalledWith(failure)
        expect(view.root.findAllByType(User)).toHaveLength(0)
        expect(view.toJSON().children).toEqual(['Offline'])
        await act(async () => { await view.root.findByType('button').props.onClick() })
        expect(view.root.findByType(User).props.user.name).toBe('Ada')
        act(() => { view.unmount() })
    })

    it('provides a default error state', async () => {
        const client = createClient({query: jest.fn().mockRejectedValue(new Error('Offline'))})
        let view
        await act(async () => {
            view = TestRenderer.create(<Delv.query query={query} client={client}><User /></Delv.query>)
        })
        expect(view.root.findByProps({role: 'alert'}).children).toEqual(['Unable to load data.'])
        act(() => { view.unmount() })
    })
})

const renderQuery = (client, props = {}) => {
    let latest
    const capture = (result) => {
        latest = result
        return null
    }
    let renderer
    act(() => {
        renderer = TestRenderer.create(
            <DelvProvider client={client}>
                <DelvQuery query={query} {...props}>{capture}</DelvQuery>
            </DelvProvider>
        )
    })
    return {
        renderer,
        get: () => latest,
        rerender: (nextProps = {}) => {
            act(() => {
                renderer.update(
                    <DelvProvider client={client}>
                        <DelvQuery query={query} {...nextProps}>{capture}</DelvQuery>
                    </DelvProvider>
                )
            })
        }
    }
}

describe('useQuery / DelvQuery', () => {
    it('throws without a client', () => {
        const Boom = () => {
            useQuery({query})
            return null
        }
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
        expect(() => {
            act(() => {
                TestRenderer.create(<Boom />)
            })
        }).toThrow(/no Delv client/)
        spy.mockRestore()
    })

    it('renders loading then success', async () => {
        let resolveNetwork
        const data = {user: {id: '1'}}
        const client = createClient({
            query: jest.fn(() => new Promise((resolve) => {resolveNetwork = resolve}))
        })

        const view = renderQuery(client)
        expect(view.get().loading).toBe(true)
        expect(view.get().data).toBeUndefined()
        expect(client.query).toHaveBeenCalledWith({
            query,
            variables: undefined,
            networkPolicy: undefined,
            cacheProcess: undefined
        })

        await act(async () => {
            resolveNetwork(data)
        })

        expect(view.get().loading).toBe(false)
        expect(view.get().data).toEqual(data)
        expect(view.get().error).toBeUndefined()
    })

    it('renders an error when the query rejects', async () => {
        const error = new Error('boom')
        const client = createClient({
            query: jest.fn(() => Promise.reject(error))
        })

        const view = renderQuery(client)
        await act(async () => {})

        expect(view.get().loading).toBe(false)
        expect(view.get().error).toBe(error)
        expect(view.get().data).toBeUndefined()
    })

    it('refetches when the query prop changes', async () => {
        const client = createClient({
            query: jest.fn(() => Promise.resolve({user: {id: '1'}}))
        })
        const view = renderQuery(client)
        await act(async () => {})
        expect(client.query).toHaveBeenCalledTimes(1)

        view.rerender({query: '{ user { id name } }'})
        await act(async () => {})

        expect(client.query).toHaveBeenCalledTimes(2)
        expect(client.query.mock.calls[1][0].query).toBe('{ user { id name } }')
    })

    it('does not run the network when skip is set', async () => {
        const client = createClient()
        const view = renderQuery(client, {skip: true})
        await act(async () => {})

        expect(client.query).not.toHaveBeenCalled()
        expect(view.get().loading).toBe(false)
        expect(client.subscribe).not.toHaveBeenCalled()
    })

    it('refreshes from cache when a relevant type changes', async () => {
        let cacheCallback
        const client = createClient({
            query: jest.fn(() => Promise.resolve({user: {id: '1'}})),
            getQueryTypes: jest.fn(() => ['User']),
            readCache: jest.fn(() => ({user: {id: '1', name: 'updated'}})),
            subscribe: jest.fn((cb) => {
                cacheCallback = cb
                return () => {}
            })
        })

        const view = renderQuery(client)
        await act(async () => {})
        expect(view.get().data).toEqual({user: {id: '1'}})

        act(() => {
            cacheCallback(['User'])
        })

        expect(client.readCache).toHaveBeenCalled()
        expect(view.get().data).toEqual({user: {id: '1', name: 'updated'}})
    })

    it('ignores cache updates for unrelated types', async () => {
        let cacheCallback
        const client = createClient({
            query: jest.fn(() => Promise.resolve({user: {id: '1'}})),
            getQueryTypes: jest.fn(() => ['User']),
            readCache: jest.fn(() => ({user: {id: '1', name: 'updated'}})),
            subscribe: jest.fn((cb) => {
                cacheCallback = cb
                return () => {}
            })
        })

        const view = renderQuery(client)
        await act(async () => {})

        act(() => {
            cacheCallback(['Post'])
        })

        expect(client.readCache).not.toHaveBeenCalled()
        expect(view.get().data).toEqual({user: {id: '1'}})
    })

    it('unsubscribes from the cache on unmount', async () => {
        const unsubscribe = jest.fn()
        const client = createClient({
            query: jest.fn(() => Promise.resolve({user: {id: '1'}})),
            subscribe: jest.fn(() => unsubscribe)
        })

        const view = renderQuery(client)
        await act(async () => {})
        expect(unsubscribe).not.toHaveBeenCalled()

        act(() => {
            view.renderer.unmount()
        })
        expect(unsubscribe).toHaveBeenCalledTimes(1)
    })

    it('exposes a refetch function that always forces a network request', async () => {
        const client = createClient({
            query: jest.fn(() => Promise.resolve({user: {id: '1'}})),
            refetch: jest.fn(() => Promise.resolve({user: {id: '1', name: 'fresh'}}))
        })
        const view = renderQuery(client, {variables: {id: '1'}, networkPolicy: 'network-first', cacheProcess: 'query'})
        await act(async () => {})
        expect(client.query).toHaveBeenCalledTimes(1)

        await act(async () => {
            await view.get().refetch({networkPolicy: 'cache-first'})
        })
        expect(client.query).toHaveBeenCalledTimes(1)
        expect(client.refetch).toHaveBeenCalledWith({query, variables: {id: '1'}, cacheProcess: 'query'})
        expect(view.get().data).toEqual({user: {id: '1', name: 'fresh'}})
    })
})

const renderMutation = (client, config = {}) => {
    let latest
    const Capture = () => {
        latest = useMutation(config)
        return null
    }
    let renderer
    act(() => {
        renderer = TestRenderer.create(
            <DelvProvider client={client}>
                <Capture />
            </DelvProvider>
        )
    })
    return {
        renderer,
        get: () => latest
    }
}

describe('useMutation', () => {
    const mutation = 'mutation { createUser { id } }'

    it('starts with loading:false', () => {
        const client = createClient()
        const view = renderMutation(client, {mutation})
        const [, result] = view.get()
        expect(result.loading).toBe(false)
        expect(result.data).toBeUndefined()
        expect(result.error).toBeUndefined()
    })

    it('toggles loading then resolves with data', async () => {
        let resolveMutation
        const data = {createUser: {id: '1'}}
        const client = createClient({
            mutate: jest.fn(() => new Promise((resolve) => {resolveMutation = resolve}))
        })
        const view = renderMutation(client, {mutation})

        let promise
        act(() => {
            promise = view.get()[0]()
        })
        expect(view.get()[1].loading).toBe(true)

        await act(async () => {
            resolveMutation(data)
            await promise
        })

        expect(view.get()[1].loading).toBe(false)
        expect(view.get()[1].data).toEqual(data)
        expect(view.get()[1].error).toBeUndefined()
    })

    it('sets error and rejects on failure', async () => {
        const error = new Error('boom')
        const client = createClient({
            mutate: jest.fn(() => Promise.reject(error))
        })
        const view = renderMutation(client, {mutation})

        await act(async () => {
            await expect(view.get()[0]()).rejects.toThrow('boom')
        })

        expect(view.get()[1].loading).toBe(false)
        expect(view.get()[1].error).toBe(error)
        expect(view.get()[1].data).toBeUndefined()
    })

    it('merges runtime variables into client.mutate', async () => {
        const client = createClient({
            mutate: jest.fn(() => Promise.resolve({createUser: {id: '1'}}))
        })
        const view = renderMutation(client, {mutation, variables: {name: 'default'}})

        await act(async () => {
            await view.get()[0]({variables: {name: 'runtime'}})
        })

        expect(client.mutate).toHaveBeenCalledWith({
            mutation,
            variables: {name: 'runtime'}
        })
    })

    it('calls the latest hook functions from config', async () => {
        const client = createClient({mutate: jest.fn(({optimistic}) => Promise.resolve(optimistic()))})
        let latest
        const Capture = ({label}) => {
            latest = useMutation({mutation, optimistic: () => label}, client)
            return null
        }
        let view
        act(() => { view = TestRenderer.create(<Capture label='first' />) })
        const firstMutate = latest[0]
        act(() => { view.update(<Capture label='second' />) })

        expect(latest[0]).toBe(firstMutate)
        await act(async () => {
            await expect(latest[0]()).resolves.toBe('second')
        })
        act(() => { view.unmount() })
    })

    it('re-renders a cached list with optimistic data before the mutation resolves', async () => {
        const createCache = require('../../src/cache')
        const TypeMap = require('../../src/queryManager/Postgraphile')
        const NetworkOnly = require('../../src/networkPolicy/NetworkOnly')
        const books = 'query Books { allBooks { nodes { id title } } }'
        const createBook = 'mutation CreateBook($title: String) { createBook(input: {book: {title: $title}}) { book { id title } } }'
        const requests = []
        const network = {post: jest.fn(() => new Promise((resolve) => requests.push(resolve)))}
        const client = createDelv({
            cache: createCache(TypeMap({typeMap: require('../cache/__fixtures__/typemap.json')})),
            network,
            queryManager: new QueryManager(),
            networkPolicies: [CacheFirst, NetworkOnly]
        })
        let add
        const Books = () => {
            const {data} = useQuery({query: books})
            const [createBookMutation] = useMutation({
                mutation: createBook,
                optimistic: ({cacheByType, variables}) => cacheByType.write('Book.temp-1', {title: variables.title}),
                update: ({cacheByType}) => cacheByType.delete('Book.temp-1')
            })
            add = createBookMutation
            return data ? data.allBooks.nodes.map((book) => book.title).join(', ') : 'loading'
        }
        let view
        act(() => { view = TestRenderer.create(<DelvProvider client={client}><Books /></DelvProvider>) })
        await act(async () => {
            requests[0]({data: {data: {allBooks: {nodes: [{__typename: 'Book', id: 'b1', title: 'Dune'}]}}}})
        })
        expect(view.toJSON()).toBe('Dune')

        let pending
        act(() => { pending = add({variables: {title: 'Neuromancer'}}) })
        expect(view.toJSON()).toBe('Dune, Neuromancer')

        await act(async () => {
            requests[1]({data: {data: {createBook: {__typename: 'CreateBookPayload',
                book: {__typename: 'Book', id: 'b2', title: 'Neuromancer (1984)'}}}}})
            await pending
        })
        expect(view.toJSON()).toBe('Dune, Neuromancer (1984)')
        expect(client.cacheByType.read('Book.temp-1')).toBeUndefined()
        act(() => { view.unmount() })
    })

    it('throws without a client', () => {
        const Boom = () => {
            useMutation({mutation})
            return null
        }
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
        expect(() => {
            act(() => {
                TestRenderer.create(<Boom />)
            })
        }).toThrow(/no Delv client/)
        spy.mockRestore()
    })
})

describe('withQuery', () => {
    it('injects query results as props', async () => {
        const client = createClient({
            query: jest.fn(() => Promise.resolve({user: {id: '1'}}))
        })
        let received
        const Inner = (props) => {
            received = props
            return null
        }
        const Wrapped = withQuery({query})(Inner)

        await act(async () => {
            TestRenderer.create(
                <DelvProvider client={client}>
                    <Wrapped extra='value' />
                </DelvProvider>
            )
        })

        expect(received.extra).toBe('value')
        expect(received.loading).toBe(false)
        expect(received.data).toEqual({user: {id: '1'}})
        expect(typeof received.refetch).toBe('function')
    })
})

describe('mock loading', () => {
    it.each([
        [undefined, undefined, 'Loading…'],
        ['mock', undefined, 'Mock child'],
        ['mock', <p>Local loading</p>, 'Local loading'],
        ['mock', null, null],
        ['mock', false, null],
        [<p>Global loading</p>, undefined, 'Global loading'],
        [<p>Global loading</p>, 'mock', 'Mock child'],
        [null, undefined, null],
        [undefined, 'mock', 'Mock child']
    ])('resolves global %p and local %p loading settings', (globalLoading, localLoading, expected) => {
        const client = createDelv({
            defaults: {loading: globalLoading},
            cache: {read: () => undefined, getMockResult: () => ({name: 'Mock child'})},
            queryManager: new QueryManager(), networkPolicies: [CacheFirst],
            network: {post: () => new Promise(() => {})}
        })
        const Child = ({name}) => <span>{name}</span>
        let view
        act(() => {
            view = TestRenderer.create(<DelvProvider client={client}>
                <Delv.query query={query} loading={localLoading}><Child /></Delv.query>
            </DelvProvider>)
        })
        expect(view.toJSON() && view.toJSON().children.join('')).toBe(expected)
        act(() => { view.unmount() })
    })

    it('uses the explicit client default and updates local overrides while pending', () => {
        const contextClient = createClient({defaults: {loading: <p>Context loading</p>}})
        const client = createClient({defaults: {loading: 'mock'},
            query: () => new Promise(() => {}), getMockResult: () => ({name: 'Mock child'})})
        const Child = ({name}) => <span>{name}</span>
        const render = loading => <DelvProvider client={contextClient}>
            <Delv.query query={query} client={client} loading={loading}><Child /></Delv.query>
        </DelvProvider>
        let view
        act(() => { view = TestRenderer.create(render(undefined)) })
        expect(view.root.findByType(Child).props.name).toBe('Mock child')
        act(() => { view.update(render(<p>Local loading</p>)) })
        expect(view.toJSON().children).toEqual(['Local loading'])
        act(() => { view.update(render(undefined)) })
        expect(view.root.findByType(Child).props.name).toBe('Mock child')
        act(() => { view.unmount() })
    })

    it('renders a real schema-shaped tree immediately and keeps the child mounted through resolution', async () => {
        const TypeMap = require('../../src/queryManager/Postgraphile')
        const createCache = require('../../src/cache')
        const cache = createCache(TypeMap({typeMap: {}, fields: {
            Query: {users: '[User!]!'}, User: {name: 'String', score: 'Float'}
        }}))
        const write = jest.spyOn(cache, 'write')
        let resolve
        const client = createDelv({cache, queryManager: new QueryManager(), networkPolicies: [CacheFirst],
            network: {post: () => new Promise(done => { resolve = done })}})
        const onResolve = jest.fn(), mounts = jest.fn()
        const Child = ({users}) => {
            React.useEffect(() => { mounts() }, [])
            return <span>{users[0].name}: {users[0].score.toFixed(2)}</span>
        }
        let view
        act(() => {
            view = TestRenderer.create(<DelvProvider client={client}>
                <Delv.query query='{ users { name score } }' loading='mock' onResolve={onResolve}
                    formatResult={data => ({users: data.users})}><Child /></Delv.query>
            </DelvProvider>)
        })
        expect(view.root.findByType(Child).props.users).toEqual([{name: 'Loading', score: 0}])
        expect(write).not.toHaveBeenCalled()
        expect(onResolve).not.toHaveBeenCalled()
        await act(async () => { resolve({data: {data: {users: [{__typename: 'User', name: 'Ada', score: 2.5}]}}}) })
        expect(view.root.findByType(Child).props.users).toEqual([{name: 'Ada', score: 2.5}])
        expect(mounts).toHaveBeenCalledTimes(1)
        expect(onResolve).toHaveBeenCalledTimes(1)
        act(() => { view.unmount() })
    })

    it('regenerates mocks for variable changes and uses the error fallback on rejection', async () => {
        const requests = []
        const client = createClient({
            query: () => new Promise((resolve, reject) => requests.push({resolve, reject})),
            getMockResult: jest.fn(({variables}) => ({name: variables.id}))
        })
        const Child = ({name}) => <span>{name}</span>
        const render = (id, skip = false) => <Delv.query client={client} query={query} variables={{id}} skip={skip}
            loading='mock' error={<p>Failed</p>}><Child /></Delv.query>
        let view
        act(() => { view = TestRenderer.create(render('a')) })
        expect(view.root.findByType(Child).props.name).toBe('a')
        act(() => { view.update(render('b')) })
        expect(view.root.findByType(Child).props.name).toBe('b')
        await act(async () => { requests[1].reject(new Error('failed')) })
        expect(view.toJSON().children).toEqual(['Failed'])
        act(() => { view.update(render('c', true)) })
        expect(view.toJSON()).toBeNull()
        expect(client.getMockResult).toHaveBeenCalledTimes(2)
        act(() => { view.unmount() })
    })
})
