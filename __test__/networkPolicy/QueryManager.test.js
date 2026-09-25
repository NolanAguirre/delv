const QueryManager = require('../../src/queryManager/QueryManager')

const query = `
query GetUser {
    user {
        id
    }
}
`

describe('QueryManager', () => {
    it('creates initialized query objects', () => {
        const queryManager = new QueryManager()
        const queryObj = queryManager.get({query})

        expect(queryObj).toMatchObject({
            id: expect.any(String),
            normalized: queryManager.normalize(query),
            isPending: false,
            promise: null,
            success: false,
            fail: false
        })
    })

    it('returns the same object for the same normalized query', () => {
        const queryManager = new QueryManager()
        const first = queryManager.get({query})
        const second = queryManager.get({query})

        expect(second).toBe(first)
    })

    it('looks up query objects by id', () => {
        const queryManager = new QueryManager()
        const queryObj = queryManager.get({query})

        expect(queryManager.get({id: queryObj.id})).toBe(queryObj)
    })

    it('normalizes unnamed queries with variables', () => {
        const queryManager = new QueryManager()
        const variables = {id: '1'}
        const normalized = queryManager.normalize('{ user { id } }', variables)

        expect(normalized).toBe('{\n  user {\n    id\n  }\n}\n{"id":"1"}')
    })

    it('shares identity across query formatting changes', () => {
        const manager = new QueryManager()
        expect(manager.get({query: '{user{id}}'})).toBe(
            manager.get({query: '{\n  user { id }\n}'}))
    })

    it('preserves whitespace inside variables', () => {
        const manager = new QueryManager()
        const query = '{ user { id } }'
        expect(manager.get({query, variables: {name: 'A B'}})).not.toBe(
            manager.get({query, variables: {name: 'AB'}}))
    })

    it.each(['AB', 'A  B'])('preserves inline string differences from A B: %s', (name) => {
        const manager = new QueryManager()
        expect(manager.get({query: '{ user(name: "A B") { id } }'})).not.toBe(
            manager.get({query: `{ user(name: "${name}") { id } }`}))
    })

    it('distinguishes same-name queries with different selection fields', () => {
        const manager = new QueryManager()
        const variables = {name: 'A B'}
        expect(manager.get({query: 'query User { user { id } }', variables})).not.toBe(
            manager.get({query: 'query User { user { id name } }', variables}))
    })

    it('removes and clears query objects', () => {
        const queryManager = new QueryManager()
        const queryObj = queryManager.get({query})

        queryManager.remove(query)
        expect(queryManager.get({id: queryObj.id})).toBeUndefined()

        queryManager.get({query})
        queryManager.clear()
        expect(queryManager.includes(null, null, '__GetUser')).toBeUndefined()
    })
})
