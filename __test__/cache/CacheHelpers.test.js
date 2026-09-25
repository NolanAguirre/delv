const createCache = require('../../src/cache')
const TypeMap = require('../../src/queryManager/Postgraphile.js')
const jsonTypeMap = require('./__fixtures__/typemap.json')

const BOOKS = 'query Books { allBooks { nodes { id title } } }'

const setup = (typeMap = TypeMap({typeMap: jsonTypeMap})) => {
    const cache = createCache(typeMap)
    cache.write({cacheProcess: 'type', query: BOOKS, data: {data: {allBooks: {
        __typename: 'BooksConnection',
        nodes: [
            {__typename: 'Book', id: 'b1', title: 'Dune'},
            {__typename: 'Book', id: 'b2', title: 'Hyperion'}
        ]
    }}}})
    const emits = []
    cache.subscribe((types) => emits.push([...types]))
    const books = () => cache.read({cacheProcess: 'type', query: BOOKS}).allBooks.nodes
    return {cache, ...cache.helpers(), emits, books}
}

describe('raw cache helpers', () => {
    it('writes one entity, emits its type once, and leaves membership alone', () => {
        const {cache, emits, books} = setup()

        expect(cache.write('Book.b3', {title: 'Neuromancer'})).toBe(true)

        expect(cache.read('Book.b3')).toEqual({__typename: 'Book', id: 'b3', title: 'Neuromancer'})
        expect(emits).toEqual([['Book']])
        expect(books()).toEqual([{id: 'b1', title: 'Dune'}, {id: 'b2', title: 'Hyperion'}])
    })

    it('deletes an entity so reads filter it out without editing membership', () => {
        const {cache, books} = setup()

        cache.delete('Book', 'b1')

        expect(cache.read('Book.b1')).toBeUndefined()
        expect(books()).toEqual([{id: 'b2', title: 'Hyperion'}])
        cache.write('Book.b1', {title: 'Dune Messiah'})
        expect(books()).toEqual([{id: 'b1', title: 'Dune Messiah'}, {id: 'b2', title: 'Hyperion'}])
    })

    it('updates only existing entities', () => {
        const {cache, emits} = setup()

        expect(cache.update('Book.missing', {title: 'Nope'})).toBe(false)
        expect(cache.read('Book.missing')).toBeUndefined()
        expect(cache.update('Book.b1', {title: 'Dune Messiah'})).toBe(true)
        expect(cache.read('Book.b1')).toEqual({__typename: 'Book', id: 'b1', title: 'Dune Messiah'})
        expect(emits).toEqual([['Book']])
    })

    it('splits references at the first dot and rejects malformed ones', () => {
        const {cache} = setup()

        cache.write('Book.v1.2', {title: 'Versioned'})

        expect(cache.read('Book', 'v1.2').title).toBe('Versioned')
        expect(() => cache.read('Book')).toThrow('expected a "Type.id" reference')
        expect(() => cache.write('.b1', {})).toThrow('expected a "Type.id" reference')
        expect(() => cache.delete('Book.')).toThrow('expected a "Type.id" reference')
    })

    it('converts ids to numbers when the key field is an Int', () => {
        const typeMap = TypeMap({typeMap: {Query: {allBooks: 'Book'}, Book: {}}, fields: {Book: {id: 'Int!', title: 'String'}}})
        const cache = createCache(typeMap)
        const {cache: raw} = cache.helpers()

        raw.write('Book.5', {title: 'Numbered'})

        expect(raw.read('Book.5')).toEqual({__typename: 'Book', id: 5, title: 'Numbered'})
        expect(raw.read('Book', 5).title).toBe('Numbered')
    })
})

describe('cacheByType helpers', () => {
    it('writes like a create mutation: appends membership, normalizes relations, sets reverse references', () => {
        const {cacheByType, emits, books} = setup()

        cacheByType.write('BookAuthor.ba9', {
            bookByBookId: {id: 'b1'},
            authorByAuthorId: {id: 'a9', name: 'Herbert'}
        })
        cacheByType.write('Book.b3', {title: 'Neuromancer'})

        expect(cacheByType.read('BookAuthor.ba9')).toEqual({
            __typename: 'BookAuthor', id: 'ba9', bookByBookId: 'b1', authorByAuthorId: 'a9'
        })
        expect(cacheByType.read('Author.a9')).toEqual({__typename: 'Author', id: 'a9', name: 'Herbert', bookAuthorByAuthorId: ['ba9']})
        expect(cacheByType.read('Book.b1').bookAuthorByBookId).toEqual(['ba9'])
        expect(books()).toEqual([
            {id: 'b1', title: 'Dune'}, {id: 'b2', title: 'Hyperion'}, {id: 'b3', title: 'Neuromancer'}
        ])
        expect(emits).toHaveLength(2)
        expect(emits[0]).toEqual(expect.arrayContaining(['BookAuthor', 'Book', 'Author']))
        expect(emits[1]).toEqual(['Book'])
    })

    it('matches membership ids regardless of string or number form', () => {
        const typeMap = TypeMap({typeMap: {Query: {allBooks: 'Book'}, Book: {}}, fields: {Book: {id: 'Int!', title: 'String'}}})
        const cache = createCache(typeMap)
        cache.write({cacheProcess: 'type', query: BOOKS, data: {data: {allBooks: {
            nodes: [{__typename: 'Book', id: 1, title: 'Dune'}]
        }}}})
        const {cacheByType} = cache.helpers()

        cacheByType.write('Book.1', {title: 'Dune Messiah'})
        cacheByType.write('Book.2', {title: 'Children of Dune'})
        expect(cache.read({cacheProcess: 'type', query: BOOKS}).allBooks.nodes)
            .toEqual([{id: 1, title: 'Dune Messiah'}, {id: 2, title: 'Children of Dune'}])

        cacheByType.delete('Book', '1')
        expect(cache.read({cacheProcess: 'type', query: BOOKS}).allBooks.nodes)
            .toEqual([{id: 2, title: 'Children of Dune'}])
    })

    it('deletes from the bucket and every recorded collection', () => {
        const {cacheByType, books} = setup()

        cacheByType.delete('Book.b1')

        expect(cacheByType.read('Book.b1')).toBeUndefined()
        expect(books()).toEqual([{id: 'b2', title: 'Hyperion'}])
    })

    it('updates by merging without changing membership', () => {
        const {cacheByType, books} = setup()

        cacheByType.update('Book.b1', {title: 'Dune Messiah'})
        cacheByType.update('Book.b9', {title: 'Elsewhere'})

        expect(books()).toEqual([{id: 'b1', title: 'Dune Messiah'}, {id: 'b2', title: 'Hyperion'}])
        expect(cacheByType.read('Book.b9')).toEqual({__typename: 'Book', id: 'b9', title: 'Elsewhere'})
    })
})
