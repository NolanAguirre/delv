import React from 'react'
import TestRenderer, {act} from 'react-test-renderer'
import {DelvProvider, DelvQuery, useQuery, withQuery} from '../../src/react/delv-react'

const query = '{ user { id } }'

const createClient = (impl = {}) => ({
    query: jest.fn(() => Promise.resolve(undefined)),
    readCache: jest.fn(),
    subscribe: jest.fn(() => () => {}),
    getQueryTypes: jest.fn(() => []),
    ...impl
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

    it('exposes a refetch function that re-runs the query', async () => {
        const client = createClient({
            query: jest.fn(() => Promise.resolve({user: {id: '1'}}))
        })
        const view = renderQuery(client)
        await act(async () => {})
        expect(client.query).toHaveBeenCalledTimes(1)

        await act(async () => {
            await view.get().refetch()
        })
        expect(client.query).toHaveBeenCalledTimes(2)
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
