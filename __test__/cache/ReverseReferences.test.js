const Cache = require('../../src/cache')
const TypeMap = require('../../src/queryManager/Postgraphile')

const map = {
    Query: {allLibraries: 'Library', allBooks: 'Book'},
    Library: {books: 'Book'},
    Book: {libraryById: 'Library'}
}
const query = `{ allLibraries { nodes {
    id name books { nodes { id title libraryById { id name } } }
} } }`
const setup = () => {
    const cache = Cache(TypeMap({typeMap: map}))
    cache.write({cacheProcess: 'type', query, data: {data: {
        allLibraries: {nodes: [{__typename: 'Library', id: 'l1', name: 'Library',
            books: {nodes: [{__typename: 'Book', id: 'b1', title: 'Bravo'}]}}]}
    }}})
    return cache
}
const createBook = (cache, id, title) => {
    const data = {data: {createBook: {__typename: 'CreateBookPayload',
        book: {__typename: 'Book', id, title,
            libraryById: {__typename: 'Library', id: 'l1'}}}}}
    const snapshot = JSON.parse(JSON.stringify(data))
    cache.write({cacheProcess: 'type', data})
    expect(data).toEqual(snapshot)
}
const books = (cache, selection = query) => cache.read({cacheProcess: 'type', query: selection})
    .allLibraries.nodes[0].books.nodes

describe('reverse references', () => {
    it('adds a created book to its cached library without returning the library collection', () => {
        const cache = setup()
        const changes = jest.fn()
        cache.subscribe((types) => changes(types))
        createBook(cache, 'b2', 'Alpha')
        createBook(cache, 'b2', 'Alpha updated')
        expect(books(cache)).toEqual([
            {id: 'b1', title: 'Bravo', libraryById: {id: 'l1', name: 'Library'}},
            {id: 'b2', title: 'Alpha updated', libraryById: {id: 'l1', name: 'Library'}}
        ])
        expect(changes).toHaveBeenLastCalledWith(expect.arrayContaining(['Library', 'Book']))
    })

    it('builds a reverse collection even when it has never been selected', () => {
        const cache = Cache(TypeMap({typeMap: map}))
        createBook(cache, 'b1', 'Bravo')
        createBook(cache, 'b2', 'Alpha')
        expect(books(cache).map((book) => book.id)).toEqual(['b1', 'b2'])
    })

    it.each(['orderBy: TITLE_ASC', 'order_by: {title: asc}'])(
        'rebuilds an ordered slice after creation using %s', (ordering) => {
            const cache = setup()
            createBook(cache, 'b2', 'Delta')
            const page = `{ allLibraries { nodes { books(${ordering}, first: 1, offset: 1) {
                nodes { id title }
            } } } }`
            expect(books(cache, page)).toEqual([{id: 'b2', title: 'Delta'}])
            createBook(cache, 'b3', 'Alpha')
            expect(books(cache, page)).toEqual([{id: 'b1', title: 'Bravo'}])
        }
    )

    it('merges an empty nested collection and preserves explicit null relationships', () => {
        const cache = setup()
        cache.write({cacheProcess: 'type', data: {data: {
            library: {__typename: 'Library', id: 'l1', books: {nodes: []}}
        }}})
        createBook(cache, 'b2', 'Alpha')
        expect(books(cache).map((book) => book.id)).toEqual(['b1', 'b2'])
        cache.write({cacheProcess: 'type', data: {data: {
            library: {__typename: 'Library', id: 'l1', books: {nodes: [
                {__typename: 'Book', id: 'b2', title: 'Alpha', libraryById: null}
            ]}}
        }}})
        expect(books(cache).find((book) => book.id === 'b2').libraryById).toBeNull()
    })

    it('keeps every condition slice of a nested collection', () => {
        const cache = Cache(TypeMap({typeMap: map}))
        const shelf = (archived) => `{ allLibraries { nodes {
            id books(condition: {archived: ${archived}}) { nodes { id archived } }
        } } }`
        const write = (archived, nodes) => cache.write({cacheProcess: 'type', query: shelf(archived), data: {data: {
            allLibraries: {nodes: [{__typename: 'Library', id: 'l1', books: {nodes}}]}
        }}})
        write(false, [{__typename: 'Book', id: 'b1', archived: false}])
        write(true, [])
        expect(books(cache, shelf(false))).toEqual([{id: 'b1', archived: false}])
        expect(books(cache, shelf(true))).toEqual([])
        write(true, [{__typename: 'Book', id: 'b2', archived: true}])
        expect(books(cache, shelf(false))).toEqual([{id: 'b1', archived: false}])
        expect(books(cache, shelf(true))).toEqual([{id: 'b2', archived: true}])
    })

    it('handles finite selections that revisit the same entity', () => {
        const cache = setup()
        cache.write({cacheProcess: 'type', data: {data: {
            book: {__typename: 'Book', id: 'b2', title: 'Alpha', libraryById: {
                __typename: 'Library', id: 'l1', books: {nodes: [
                    {__typename: 'Book', id: 'b1', title: 'Bravo'},
                    {__typename: 'Book', id: 'b2', title: 'Alpha'}
                ]}
            }}
        }}})
        expect(books(cache).map((book) => book.id)).toEqual(['b1', 'b2'])
    })
})
