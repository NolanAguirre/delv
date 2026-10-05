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
    it('shares one membership per root field across queries and variables, including empty results', () => {
        const cache = Cache(typeMap)
        const query = 'query Books { allBooks { nodes { id } } }'
        const other = 'query Books { allBooks(first: 1) { nodes { id } } }'
        cache.write({cacheProcess: 'type', query, variables: {a: 1, b: 2}, data: {
            data: {allBooks: {nodes: []}}
        }})
        expect(cache.read({cacheProcess: 'type', query, variables: {b: 2, a: 1}}))
            .toEqual({allBooks: {nodes: []}})
        cache.write({cacheProcess: 'type', query: other, variables: {a: 1, b: 2}, data: {
            data: {allBooks: {nodes: [{__typename: 'Book', id: 'b1'}]}}
        }})
        expect(cache.read({cacheProcess: 'type', query, variables: {b: 2, a: 1}}))
            .toEqual({allBooks: {nodes: [{id: 'b1'}]}})
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

    it('replays a collection query membership and keeps rows a refetch omits', () => {
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
            .toEqual([{ id: 'b1', title: 'Dune' }, { id: 'b2', title: 'Hyperion' }])
    })

    it('applies each read\'s first to the shared membership', () => {
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

    it('keeps every condition slice of a root list', () => {
        const cache = Cache(typeMap)
        const query = `query Books($archived: Boolean) {
            allBooks(condition: {archived: $archived}) { nodes { id archived } }
        }`
        const write = (archived, nodes) => cache.write({cacheProcess: 'type', query, variables: {archived}, data: {
            data: {allBooks: {nodes}}
        }})
        const read = (archived) => cache.read({cacheProcess: 'type', query, variables: {archived}}).allBooks.nodes
        write(false, [{__typename: 'Book', id: 'b1', archived: false}])
        write(true, [])
        expect(read(false)).toEqual([{id: 'b1', archived: false}])
        expect(read(true)).toEqual([])
        write(true, [{__typename: 'Book', id: 'b2', archived: true}])
        expect(read(false)).toEqual([{id: 'b1', archived: false}])
        expect(read(true)).toEqual([{id: 'b2', archived: true}])
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
        'pages the merged membership in memory: %s', (selection) => {
            const cache = Cache(typeMap)
            const query = `query Page($first: Int, $offset: Int) {
                allBooks(first: $first, offset: $offset) { ${selection} }
            }`
            const connection = (ids) => {
                const nodes = ids.map((id) => ({__typename: 'Book', id}))
                return selection.startsWith('edges') ? {edges: nodes.map((node) => ({node}))} : {nodes}
            }
            const expected = (ids) => (selection.startsWith('edges')
                ? {edges: ids.map((id) => ({node: {id}}))}
                : {nodes: ids.map((id) => ({id}))})
            const write = (variables, ids) => cache.write({cacheProcess: 'type', query, variables, data: {
                data: {allBooks: connection(ids)}
            }})
            const read = (variables) => cache.read({cacheProcess: 'type', query, variables}).allBooks

            write({first: 2, offset: 0}, ['b1', 'b2'])
            write({first: 2, offset: 2}, ['b3', 'b4'])
            expect(read({first: 2, offset: 0})).toEqual(expected(['b1', 'b2']))
            expect(read({first: 2, offset: 2})).toEqual(expected(['b3', 'b4']))

            // Only delete mutations remove rows, so an empty refetch keeps the page.
            write({first: 2, offset: 2}, [])
            expect(read({first: 2, offset: 2})).toEqual(expected(['b3', 'b4']))
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

describe('Cache list fields', () => {
    const listTypeMap = () => TypeMap({typeMap: {
        Query: { assetById: 'Asset', allAssetTags: 'AssetTag' },
        Asset: { tags: 'AssetTag', tagConnection: 'AssetTag' },
        AssetTag: {},
        __fieldTypes: {
            Query: { assetById: 'Asset', allAssetTags: '[AssetTag!]!' },
            Asset: { id: 'UUID!', tags: '[AssetTag!]!', tagConnection: 'AssetTagsConnection!' },
            AssetTag: { id: 'String!', category: 'String!', name: 'String!', score: 'Float!' }
        }
    }})

    const tags = [
        { __typename: 'AssetTag', id: 't1', category: 'style', name: 'noir', score: 0.9 },
        { __typename: 'AssetTag', id: 't2', category: 'subject', name: 'city', score: 0.8 },
        { __typename: 'AssetTag', id: 't3', category: 'style', name: 'grain', score: 0.4 }
    ]

    const assetQuery = `
    query AssetTags($id: UUID!) {
        assetById(id: $id) {
            id
            tags {
                id
                category
                name
                score
            }
        }
    }
    `

    const writeAsset = (cache, assetTags, query = assetQuery) => {
        cache.write({cacheProcess: 'type', query, variables: {id: 'a1'}, data: {
            data: { assetById: { __typename: 'Asset', id: 'a1', tags: assetTags } }
        }})
    }

    it('reads a nested list field back as a list, not a single node', () => {
        const cache = Cache(listTypeMap())
        writeAsset(cache, tags)

        const result = cache.read({cacheProcess: 'type', query: assetQuery, variables: {id: 'a1'}})

        expect(result.assetById.tags).toEqual(tags.map(({__typename, ...tag}) => tag))
    })

    it('reads an empty nested list field back as an empty list', () => {
        const cache = Cache(listTypeMap())
        writeAsset(cache, [])

        const result = cache.read({cacheProcess: 'type', query: assetQuery, variables: {id: 'a1'}})

        expect(result.assetById.tags).toEqual([])
    })

    it('applies arguments to a nested list field', () => {
        const cache = Cache(listTypeMap())
        const query = `
        query AssetTags($id: UUID!) {
            assetById(id: $id) {
                id
                tags(condition: {category: "style"}, orderBy: SCORE_ASC) {
                    id
                }
            }
        }
        `
        writeAsset(cache, tags, query)

        const result = cache.read({cacheProcess: 'type', query, variables: {id: 'a1'}})

        expect(result.assetById.tags).toEqual([{ id: 't3' }, { id: 't1' }])
    })

    it('keeps a connection-typed field readable through nodes', () => {
        const cache = Cache(listTypeMap())
        const query = `
        query AssetTags($id: UUID!) {
            assetById(id: $id) {
                id
                tagConnection {
                    nodes {
                        id
                    }
                }
            }
        }
        `
        cache.write({cacheProcess: 'type', query, variables: {id: 'a1'}, data: {
            data: { assetById: { __typename: 'Asset', id: 'a1', tagConnection: {
                __typename: 'AssetTagsConnection', nodes: tags
            } } }
        }})

        const result = cache.read({cacheProcess: 'type', query, variables: {id: 'a1'}})

        expect(result.assetById.tagConnection).toEqual({ nodes: [{ id: 't1' }, { id: 't2' }, { id: 't3' }] })
    })

    it('reads a root list field back as a list from recorded membership and the type bucket', () => {
        const cache = Cache(listTypeMap())
        const query = 'query Tags { allAssetTags { id name } }'
        cache.write({cacheProcess: 'type', query, data: { data: { allAssetTags: tags.slice(0, 2) } }})

        expect(cache.read({cacheProcess: 'type', query}).allAssetTags)
            .toEqual([{ id: 't1', name: 'noir' }, { id: 't2', name: 'city' }])

        cache.write({cacheProcess: 'type', data: { data: { allAssetTags: tags } }})
        const filtered = 'query StyleTags { allAssetTags(condition: {category: "style"}, first: 1) { id } }'

        expect(cache.read({cacheProcess: 'type', query: filtered}).allAssetTags).toEqual([{ id: 't1' }])
    })
})
