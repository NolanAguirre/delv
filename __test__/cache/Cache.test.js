const Cache = require('../../src/cache')
const TypeMap = require('../../src/queryManager/Postgraphile.js')
const jsonTypeMap = require('./__fixtures__/typemap.json')

let typeMap

const buildResponse = () => ({
    data: {
        allBooks: {
            __typename: 'BooksConnection',
            totalCount: 2,
            pageInfo: { __typename: 'PageInfo', hasNextPage: false },
            edges: [
                {
                    cursor: 'cursor-1',
                    node: {
                        __typename: 'Book',
                        id: 'b1',
                        title: 'Dune',
                        bookAuthorByBookId: {
                            __typename: 'BookAuthor',
                            id: 'ba1',
                            authorByAuthorId: {
                                __typename: 'Author',
                                id: 'a1',
                                name: 'Herbert'
                            }
                        }
                    }
                },
                {
                    cursor: 'cursor-2',
                    node: {
                        __typename: 'Book',
                        id: 'b2',
                        title: 'Hyperion',
                        bookAuthorByBookId: {
                            __typename: 'BookAuthor',
                            id: 'ba2',
                            authorByAuthorId: {
                                __typename: 'Author',
                                id: 'a2',
                                name: 'Simmons'
                            }
                        }
                    }
                }
            ]
        }
    }
})

const readQuery = `
query GetBooks {
    allBooks {
        edges {
            cursor
            node {
                id
                title
                bookAuthorByBookId {
                    id
                    authorByAuthorId {
                        id
                        name
                    }
                }
            }
        }
    }
}
`

beforeAll(() => {
    typeMap = TypeMap({typeMap: jsonTypeMap})
})

describe('Cache unit test', () => {
    it('initialized', () => {
        const cache = Cache(typeMap)
        expect(cache.read).toBeInstanceOf(Function)
        expect(cache.write).toBeInstanceOf(Function)
        expect(cache.clear).toBeInstanceOf(Function)
    })

    it('writes a nested connection without mutating the response', () => {
        const cache = Cache(typeMap)
        const response = buildResponse()
        const snapshot = JSON.parse(JSON.stringify(response))

        cache.write({cacheProcess: 'type', data: response})

        expect(response).toEqual(snapshot)
    })

    it('reads a nested connection back with a matching shape', () => {
        const cache = Cache(typeMap)
        cache.write({cacheProcess: 'type', data: buildResponse()})

        const result = cache.read({cacheProcess: 'type', query: readQuery})

        expect(result).toEqual({
            allBooks: {
                edges: [
                    {
                        cursor: 'cursor-1',
                        node: {
                            id: 'b1',
                            title: 'Dune',
                            bookAuthorByBookId: {
                                id: 'ba1',
                                authorByAuthorId: { id: 'a1', name: 'Herbert' }
                            }
                        }
                    },
                    {
                        cursor: 'cursor-2',
                        node: {
                            id: 'b2',
                            title: 'Hyperion',
                            bookAuthorByBookId: {
                                id: 'ba2',
                                authorByAuthorId: { id: 'a2', name: 'Simmons' }
                            }
                        }
                    }
                ]
            }
        })
    })

    it('applies where on read', () => {
        const cache = Cache(typeMap)
        cache.write({cacheProcess: 'type', data: buildResponse()})

        const query = `
        query GetBooks($where: BookFilter) {
            allBooks(where: $where) {
                nodes {
                    id
                    title
                }
            }
        }
        `
        const result = cache.read({
            cacheProcess: 'type',
            query,
            variables: { where: { title: { _eq: 'Dune' } } }
        })

        expect(result.allBooks.nodes).toEqual([{ id: 'b1', title: 'Dune' }])
    })

    it('applies order_by on read', () => {
        const cache = Cache(typeMap)
        cache.write({cacheProcess: 'type', data: buildResponse()})

        const query = `
        query GetBooks($order_by: BooksOrderBy) {
            allBooks(order_by: $order_by) {
                nodes {
                    id
                    title
                }
            }
        }
        `
        const result = cache.read({
            cacheProcess: 'type',
            query,
            variables: { order_by: { title: 'desc' } }
        })

        expect(result.allBooks.nodes.map((n) => n.id)).toEqual(['b2', 'b1'])
    })

    it('applies first and offset on read', () => {
        const cache = Cache(typeMap)
        cache.write({cacheProcess: 'type', data: buildResponse()})

        const query = `
        query GetBooks($first: Int, $offset: Int) {
            allBooks(first: $first, offset: $offset) {
                nodes {
                    id
                }
            }
        }
        `
        const result = cache.read({
            cacheProcess: 'type',
            query,
            variables: { first: 1, offset: 1 }
        })

        expect(result.allBooks.nodes).toEqual([{ id: 'b2' }])
    })
})
