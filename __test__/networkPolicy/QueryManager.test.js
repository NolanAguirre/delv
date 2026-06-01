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
            id: '__GetUser',
            normalized: '__GetUser',
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

        expect(normalized).toBe('{user{id}}{"id":"1"}')
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
