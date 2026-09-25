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
    it('uses full query identity and stable variables for collection membership, including empty results', () => {
        const cache = Cache(typeMap)
        const query = 'query Books { allBooks { nodes { id } } }'
        const other = 'query Books { allBooks(first: 1) { nodes { id } } }'
        cache.write({cacheProcess: 'type', query, variables: {a: 1, b: 2}, data: {
            data: {allBooks: {nodes: []}}
        }})
        cache.write({cacheProcess: 'type', query: other, variables: {a: 1, b: 2}, data: {
            data: {allBooks: {nodes: [{__typename: 'Book', id: 'b1'}]}}
        }})
        expect(cache.read({cacheProcess: 'type', query, variables: {b: 2, a: 1}}))
            .toEqual({allBooks: {nodes: []}})
        expect(cache.read({cacheProcess: 'type', query: other, variables: {b: 2, a: 1}}))
            .toEqual({allBooks: {nodes: [{id: 'b1'}]}})
    })

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

    it('reads a nested to-many connection back as a connection, not a bare list', () => {
        const cache = Cache(typeMap)
        cache.write({cacheProcess: 'type', data: {
            data: {
                allAuthors: {
                    __typename: 'AuthorsConnection',
                    nodes: [
                        {
                            __typename: 'Author',
                            id: 'a1',
                            bookAuthorByAuthorId: {
                                __typename: 'BookAuthorsConnection',
                                nodes: [
                                    { __typename: 'BookAuthor', id: 'ba1' },
                                    { __typename: 'BookAuthor', id: 'ba2' }
                                ]
                            }
                        }
                    ]
                }
            }
        }})

        const query = `
        query GetAuthors {
            allAuthors {
                nodes {
                    id
                    bookAuthorByAuthorId {
                        nodes {
                            id
                        }
                    }
                }
            }
        }
        `
        const result = cache.read({cacheProcess: 'type', query})

        expect(result).toEqual({
            allAuthors: {
                nodes: [
                    {
                        id: 'a1',
                        bookAuthorByAuthorId: {
                            nodes: [{ id: 'ba1' }, { id: 'ba2' }]
                        }
                    }
                ]
            }
        })
    })

    it('replays a collection query membership so refetches drop removed rows', () => {
        const cache = Cache(typeMap)
        const query = `
        query GetBooks {
            allBooks {
                nodes {
                    id
                    title
                }
            }
        }
        `
        cache.write({cacheProcess: 'type', query, data: {
            data: {
                allBooks: {
                    __typename: 'BooksConnection',
                    nodes: [
                        { __typename: 'Book', id: 'b1', title: 'Dune' },
                        { __typename: 'Book', id: 'b2', title: 'Hyperion' }
                    ]
                }
            }
        }})

        expect(cache.read({cacheProcess: 'type', query}).allBooks.nodes)
            .toEqual([{ id: 'b1', title: 'Dune' }, { id: 'b2', title: 'Hyperion' }])

        cache.write({cacheProcess: 'type', query, data: {
            data: {
                allBooks: {
                    __typename: 'BooksConnection',
                    nodes: [
                        { __typename: 'Book', id: 'b1', title: 'Dune' }
                    ]
                }
            }
        }})

        expect(cache.read({cacheProcess: 'type', query}).allBooks.nodes)
            .toEqual([{ id: 'b1', title: 'Dune' }])
    })

    it('scopes collection membership by variables', () => {
        const cache = Cache(typeMap)
        const query = `
        query GetBooks($first: Int) {
            allBooks(first: $first) {
                nodes {
                    id
                }
            }
        }
        `
        cache.write({cacheProcess: 'type', query, variables: {first: 1}, data: {
            data: { allBooks: { __typename: 'BooksConnection', nodes: [ { __typename: 'Book', id: 'b1' } ] } }
        }})
        cache.write({cacheProcess: 'type', query, variables: {first: 2}, data: {
            data: { allBooks: { __typename: 'BooksConnection', nodes: [ { __typename: 'Book', id: 'b1' }, { __typename: 'Book', id: 'b2' } ] } }
        }})

        expect(cache.read({cacheProcess: 'type', query, variables: {first: 1}}).allBooks.nodes).toEqual([{ id: 'b1' }])
        expect(cache.read({cacheProcess: 'type', query, variables: {first: 2}}).allBooks.nodes).toEqual([{ id: 'b1' }, { id: 'b2' }])
    })

    it('applies a condition on read', () => {
        const cache = Cache(typeMap)
        cache.write({cacheProcess: 'type', data: {
            data: {
                allUsers: {
                    __typename: 'UsersConnection',
                    nodes: [
                        { __typename: 'User', id: 'u1', role: 'admin' },
                        { __typename: 'User', id: 'u2', role: 'member' }
                    ]
                }
            }
        }})

        const query = `
        query GetUsers($condition: UserCondition) {
            allUsers(condition: $condition) {
                nodes {
                    id
                    role
                }
            }
        }
        `
        const result = cache.read({
            cacheProcess: 'type',
            query,
            variables: { condition: { role: 'admin' } }
        })

        expect(result.allUsers.nodes).toEqual([{ id: 'u1', role: 'admin' }])
    })

    it('appends created ids to recorded membership and evicts deleted ids', () => {
        const cache = Cache(typeMap)
        const query = `
        query GetBooks {
            allBooks {
                nodes {
                    id
                    title
                }
            }
        }
        `
        cache.write({cacheProcess: 'type', query, data: {
            data: {
                allBooks: {
                    __typename: 'BooksConnection',
                    nodes: [
                        { __typename: 'Book', id: 'b1', title: 'Dune' },
                        { __typename: 'Book', id: 'b2', title: 'Hyperion' }
                    ]
                }
            }
        }})

        const changed = []
        cache.subscribe((types) => { types.forEach((type) => changed.push(type)) })

        // create* appends the new entity to every recorded Book collection
        cache.write({cacheProcess: 'type', query: `
        mutation CreateBook($book: BookInput!) {
            createBook(input: {book: $book}) {
                book {
                    id
                    title
                }
            }
        }
        `, data: {
            data: {
                createBook: {
                    __typename: 'CreateBookPayload',
                    book: { __typename: 'Book', id: 'b3', title: 'Neuromancer' }
                }
            }
        }})

        expect(cache.read({cacheProcess: 'type', query}).allBooks.nodes)
            .toEqual([{ id: 'b1', title: 'Dune' }, { id: 'b2', title: 'Hyperion' }, { id: 'b3', title: 'Neuromancer' }])
        expect(changed).toContain('Book')

        // delete* evicts the entity from the bucket and every recorded collection
        cache.write({cacheProcess: 'type', query: `
        mutation DeleteBook($id: UUID!) {
            deleteBookById(input: {id: $id}) {
                book {
                    id
                }
            }
        }
        `, data: {
            data: {
                deleteBookById: {
                    __typename: 'DeleteBookPayload',
                    book: { __typename: 'Book', id: 'b1' }
                }
            }
        }})

        expect(cache.read({cacheProcess: 'type', query}).allBooks.nodes)
            .toEqual([{ id: 'b2', title: 'Hyperion' }, { id: 'b3', title: 'Neuromancer' }])
    })

    it.each(['nodes { id }', 'edges { node { id } }'])(
        'replays a server page without applying its offset again: %s', (selection) => {
            const cache = Cache(typeMap)
            const query = `query Page($first: Int, $offset: Int) {
                allBooks(first: $first, offset: $offset) { ${selection} }
            }`
            const variables = {first: 2, offset: 2}
            const nodes = [
                {__typename: 'Book', id: 'b3'},
                {__typename: 'Book', id: 'b4'}
            ]
            const connection = selection.startsWith('edges')
                ? {edges: nodes.map((node) => ({node}))}
                : {nodes}
            cache.write({cacheProcess: 'type', query, variables, data: {
                data: {allBooks: connection}
            }})

            const expected = selection.startsWith('edges')
                ? {edges: [{node: {id: 'b3'}}, {node: {id: 'b4'}}]}
                : {nodes: [{id: 'b3'}, {id: 'b4'}]}
            expect(cache.read({cacheProcess: 'type', query, variables}).allBooks)
                .toEqual(expected)

            // A refetch can authoritatively replace the page with an empty one.
            cache.write({cacheProcess: 'type', query, variables, data: {
                data: {allBooks: selection.startsWith('edges') ? {edges: []} : {nodes: []}}
            }})
            expect(cache.read({cacheProcess: 'type', query, variables}).allBooks)
                .toEqual(selection.startsWith('edges') ? {edges: []} : {nodes: []})
        }
    )

    it('applies first and offset when reading an unpaginated type bucket', () => {
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
