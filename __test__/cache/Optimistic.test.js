const createCache = require('../../src/cache')
const TypeMap = require('../../src/queryManager/Postgraphile.js')
const jsonTypeMap = require('./__fixtures__/typemap.json')

const BOOKS = 'query Books { allBooks { nodes { id title } } }'
const AUTHORS = 'query Authors { allAuthors { nodes { id name } } }'
const UPDATE_BOOK = 'mutation UpdateBook { updateBookById(input: {}) { book { id title } } }'

const writeBooks = (cache, nodes) => cache.write({cacheProcess: 'type', query: BOOKS, data: {data: {allBooks: {
    __typename: 'BooksConnection',
    nodes: nodes.map((node) => ({__typename: 'Book', ...node}))
}}}})

const updateBook = (cache, book) => cache.write({cacheProcess: 'type', query: UPDATE_BOOK, data: {data: {
    updateBookById: {__typename: 'UpdateBookPayload', book: {__typename: 'Book', ...book}}
}}})

const setup = () => {
    const cache = createCache(TypeMap({typeMap: jsonTypeMap}))
    writeBooks(cache, [{id: 'b1', title: 'Dune'}, {id: 'b2', title: 'Hyperion'}])
    const emits = []
    cache.subscribe((types) => emits.push([...types]))
    const books = () => cache.read({cacheProcess: 'type', query: BOOKS}).allBooks.nodes
    const {cache: raw, cacheByType} = cache.helpers()
    return {cache, raw, cacheByType, emits, books}
}

describe('optimistic writes', () => {
    it('shows optimistic data on read and emits once', () => {
        const {cache, emits, books} = setup()

        cache.applyOptimistic('o1', ({cacheByType}) => {
            cacheByType.write('Book.temp-1', {title: 'Pending'})
            cacheByType.update('Book.b1', {title: 'Dune (edited)'})
        })

        expect(books()).toEqual([
            {id: 'b1', title: 'Dune (edited)'}, {id: 'b2', title: 'Hyperion'}, {id: 'temp-1', title: 'Pending'}
        ])
        expect(emits).toEqual([['Book']])
    })

    it('passes helpers, type map, and caller context to the hook', () => {
        const {cache} = setup()
        const optimistic = jest.fn()

        cache.applyOptimistic('o1', optimistic, {mutation: UPDATE_BOOK, variables: {a: 1}})

        expect(optimistic).toHaveBeenCalledTimes(1)
        expect(optimistic).toHaveBeenCalledWith(expect.objectContaining({
            cache: expect.any(Object),
            cacheByType: expect.any(Object),
            typeMap: expect.any(Object),
            mutation: UPDATE_BOOK,
            variables: {a: 1}
        }))
    })

    it('runs the hook once and lets later writes land on top of it', () => {
        const {cache, books} = setup()
        const optimistic = jest.fn(({cacheByType}) => cacheByType.update('Book.b1', {title: 'Optimistic'}))
        cache.applyOptimistic('o1', optimistic)

        writeBooks(cache, [{id: 'b1', title: 'Server'}, {id: 'b2', title: 'Hyperion'}])

        expect(optimistic).toHaveBeenCalledTimes(1)
        expect(books()[0]).toEqual({id: 'b1', title: 'Server'})
    })

    it('leaves the cache to the mutation response on success', () => {
        const {cache, books} = setup()
        cache.applyOptimistic('o1', ({cacheByType}) => cacheByType.update('Book.b1', {title: 'Optimistic'}))

        updateBook(cache, {id: 'b1', title: 'Saved'})
        cache.discardOptimistic('o1')
        cache.rollbackOptimistic('o1')

        expect(books()[0]).toEqual({id: 'b1', title: 'Saved'})
    })

    it('rolls back on failure, including a cache miss for a bucket the hook created', () => {
        const {cache, books} = setup()
        const authors = () => cache.read({cacheProcess: 'type', query: AUTHORS}).allAuthors.nodes
        expect(authors).toThrow('delv cache miss')

        cache.applyOptimistic('o1', ({cacheByType, cache: raw}) => {
            cacheByType.write('Book.temp-1', {title: 'Pending'})
            cacheByType.delete('Book.b2')
            raw.write('Author.temp-a', {name: 'Someone'})
        })
        expect(books()).toEqual([{id: 'b1', title: 'Dune'}, {id: 'temp-1', title: 'Pending'}])
        expect(authors()).toEqual([{id: 'temp-a', name: 'Someone'}])

        cache.rollbackOptimistic('o1')

        expect(books()).toEqual([{id: 'b1', title: 'Dune'}, {id: 'b2', title: 'Hyperion'}])
        expect(authors).toThrow('delv cache miss')
    })

    it('keeps fields and lists that a newer write changed when rolling back', () => {
        const {cache, raw, books} = setup()
        cache.applyOptimistic('o1', ({cacheByType}) => {
            cacheByType.update('Book.b1', {title: 'Optimistic', subtitle: 'Draft'})
            cacheByType.update('Book.b2', {title: 'Hyperion (edited)'})
            cacheByType.write('Book.temp-1', {title: 'Pending'})
        })

        raw.write('Book.b1', {title: 'Server', rating: 5})
        writeBooks(cache, [{id: 'b1'}, {id: 'b2'}, {id: 'b4', title: 'Excession'}])
        cache.rollbackOptimistic('o1')

        expect(raw.read('Book.b1')).toEqual({__typename: 'Book', id: 'b1', title: 'Server', rating: 5})
        expect(raw.read('Book.b2').title).toBe('Hyperion')
        expect(raw.read('Book.temp-1')).toBeUndefined()
        expect(books()).toEqual([
            {id: 'b1', title: 'Server'}, {id: 'b2', title: 'Hyperion'}, {id: 'b4', title: 'Excession'}
        ])
    })

    it('keeps a later optimistic write when an earlier overlapping one fails', () => {
        const {cache, raw} = setup()
        cache.applyOptimistic('a', ({cacheByType}) => cacheByType.update('Book.b1', {title: 'A', subtitle: 'From A'}))
        cache.applyOptimistic('b', ({cacheByType}) => cacheByType.update('Book.b1', {title: 'B'}))

        cache.rollbackOptimistic('a')

        expect(raw.read('Book.b1')).toEqual({__typename: 'Book', id: 'b1', title: 'B'})
    })

    it('rolls back a hook that throws part way through', () => {
        const {cache, books} = setup()
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

        cache.applyOptimistic('o1', ({cacheByType}) => {
            cacheByType.write('Book.temp-1', {title: 'Pending'})
            throw new Error('bad hook')
        })

        expect(books()).toEqual([{id: 'b1', title: 'Dune'}, {id: 'b2', title: 'Hyperion'}])
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('optimistic update failed'), expect.any(Error))
        spy.mockRestore()
    })

    it('forgets pending writes when the cache is cleared', () => {
        const {cache} = setup()
        cache.applyOptimistic('o1', ({cacheByType}) => cacheByType.write('Book.temp-1', {title: 'Pending'}))

        cache.clear()
        writeBooks(cache, [{id: 'b1', title: 'Dune'}])
        cache.rollbackOptimistic('o1')

        expect(cache.read({cacheProcess: 'type', query: BOOKS}).allBooks.nodes).toEqual([{id: 'b1', title: 'Dune'}])
    })
})
