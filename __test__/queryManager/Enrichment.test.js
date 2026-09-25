const {buildSchema, extendSchema, graphql, parse, validate} = require('graphql')
const Enrichment = require('../../src/queryManager/Enrichment')
const TypeMap = require('../../src/queryManager/Postgraphile')
const createCache = require('../../src/cache')
const Delv = require('../../src/core/delv')
const QueryManager = require('../../src/queryManager/QueryManager')
const NetworkOnly = require('../../src/networkPolicy/NetworkOnly')
const CacheFirst = require('../../src/networkPolicy/CacheFirst')
const CacheOnly = require('../../src/networkPolicy/CacheOnly')

const schema = buildSchema(`
  enum BookOrder { POSITION_ASC ID_ASC }
  input NumberFilter { greaterThan: Int lessThan: Int _gt: Int }
  input AuthorFilter { age: NumberFilter }
  input BookFilter { position: NumberFilter author: AuthorFilter and: [BookFilter!] }
  input BookCondition { position: Int }
  type Author { id: ID! age: Int name: String }
  type Book { id: ID! title: String position: Int author: Author }
  type BookEdge { cursor: String node: Book }
  type BookConnection { nodes: [Book!]! edges: [BookEdge!]! }
  type Query { books(first: Int, offset: Int, after: String, position: Int,
    condition: BookCondition, filter: BookFilter, orderBy: [BookOrder!]): BookConnection }
  type UpdateBookPayload { book: Book }
  type Mutation { updateBook(id: ID!, position: Int!): UpdateBookPayload }
`)
const fields = {
    Query: {books: 'BookConnection'}, BookConnection: {nodes: 'Book', edges: 'BookEdge'},
    BookEdge: {node: 'Book', cursor: 'String'},
    Book: {id: 'ID', title: 'String', position: 'Int', author: 'Author'},
    Author: {id: 'ID', name: 'String', age: 'Int'},
    Mutation: {updateBook: 'UpdateBookPayload'}, UpdateBookPayload: {book: 'Book'}
}
const typeMap = () => TypeMap({typeMap: {Query: {books: 'Book'}, Book: {author: 'Author'}, Author: {}}, fields})
const make = () => Enrichment(typeMap())
const valid = (prepared) => expect(validate(schema, parse(prepared.query))).toEqual([])
const selected = (query, path) => {
    let set = parse(query).definitions[0].selectionSet
    for(const key of path) set = set.selections.find((s) => s.name && s.name.value === key).selectionSet
    return set.selections.filter((s) => s.kind === 'Field').map((s) => s.name.value)
}

it('intersects direct/nested argument keys with node fields and ignores pagination keys', () => {
    const prepared = make().prepare({query: `{
      books(first: 5, offset: 2, after: "cursor", condition: {position: 2}) { nodes { title } }
    }`})
    valid(prepared)
    expect(selected(prepared.query, ['books', 'nodes'])).toEqual(expect.arrayContaining(['position', 'id', '__typename']))
    expect(selected(prepared.query, ['books', 'nodes'])).not.toEqual(expect.arrayContaining(['first']))
    expect(selected(prepared.query, ['books']).filter((name) => name !== '__typename')).toEqual(['nodes'])
})

it('handles variable/default objects, boolean lists and nested relationship filters', () => {
    const query = `query Books($filter: BookFilter = {and: [{position: {greaterThan: 1}}, {author: {age: {lessThan: 80}}}]}) {
      books(filter: $filter) { nodes { title } }
    }`
    const prepared = make().prepare({query})
    valid(prepared)
    expect(selected(prepared.query, ['books', 'nodes'])).toContain('position')
    expect(selected(prepared.query, ['books', 'nodes', 'author'])).toEqual(expect.arrayContaining(['age', 'id', '__typename']))
    const supplied = make().prepare({query, variables: {filter: {position: {_gt: 3}}}})
    expect(selected(supplied.query, ['books', 'nodes'])).not.toContain('author')
})

it('enriches edges/node and enum ordering without duplicate selections', () => {
    const prepared = make().prepare({query: '{ books(orderBy: [POSITION_ASC, ID_ASC]) { edges { cursor node { id position title } } } }'})
    valid(prepared)
    expect(selected(prepared.query, ['books', 'edges', 'node']).filter((name) => name === 'position')).toHaveLength(1)
    expect(selected(prepared.query, ['books', 'edges']).filter((name) => name !== '__typename')).toEqual(['cursor', 'node'])
})

it('keeps enrichment hidden, preserves aliases and handles response-name collisions', () => {
    const prepared = make().prepare({query: '{ books(position: 2) { nodes { position: title } } }'})
    valid(prepared)
    const nodes = parse(prepared.query).definitions[0].selectionSet.selections[0].selectionSet.selections[0].selectionSet.selections
    const injectedPosition = nodes.find((s) => s.name.value === 'position')
    const data = {books: {nodes: [{position: 'Dune', [injectedPosition.alias.value]: 2, id: 'b1', __typename: 'Book'}]}}
    expect(prepared.project(data)).toEqual({books: {nodes: [{position: 'Dune'}]}})
    expect(prepared.normalize(data)).toEqual({books: {nodes: [{title: 'Dune', position: 2, id: 'b1', __typename: 'Book'}]}})
})

it('handles fragments and conditional selections without relying on skipped fields', () => {
    const prepared = make().prepare({query: `query Books($show: Boolean!) {
      books(position: 2) { nodes { ...Display position @include(if: $show) } }
    } fragment Display on Book { title }`, variables: {show: false}})
    valid(prepared)
    const data = {books: {nodes: [{title: 'Dune', position: 2, id: 'b1', __typename: 'Book'}]}}
    expect(prepared.project(data)).toEqual({books: {nodes: [{title: 'Dune'}]}})
    expect(prepared.normalize(data).books.nodes[0].position).toBe(2)
})

it('carries requirements to mutations and clears them with the cache', () => {
    const cache = createCache(typeMap())
    cache.prepareQuery({query: '{ books(orderBy: [POSITION_ASC]) { nodes { title } } }'})
    const mutation = 'mutation { updateBook(id: "b1", position: 5) { book { title } } }'
    const prepared = cache.prepareQuery({query: mutation})
    valid(prepared)
    expect(selected(prepared.query, ['updateBook', 'book'])).toContain('position')
    cache.clear()
    expect(selected(cache.prepareQuery({query: mutation}).query, ['updateBook', 'book'])).not.toContain('position')
})

it('preserves legacy maps and places extra node fields below flattened connections', () => {
    const enrichment = Enrichment(TypeMap({typeMap: {Query: {books: 'Book'}, Book: {}}, fields: {Book: fields.Book}}))
    const prepared = enrichment.prepare({query: '{ books(orderBy: [POSITION_ASC]) { nodes { title } } }'})
    valid(prepared)
    expect(selected(prepared.query, ['books']).filter((name) => name !== '__typename')).toEqual(['nodes'])
    expect(selected(prepared.query, ['books', 'nodes'])).toContain('position')
})

it.each([NetworkOnly, CacheFirst])('stores hidden sort keys and rerenders cache reads after mutations (%p)', async (Policy) => {
    const books = [{id: 'b1', title: 'First', position: 1}, {id: 'b2', title: 'Second', position: 2}]
    const network = {post: jest.fn(async ({query, variables}) => {
        expect(validate(schema, parse(query))).toEqual([])
        const result = await graphql(schema, query, {
            books: () => ({nodes: [...books].sort((a, b) => a.position - b.position)}),
            updateBook: ({id, position}) => {
                const book = books.find((item) => item.id === id)
                book.position = position
                return {book}
            }
        }, null, variables)
        expect(result.errors).toBeUndefined()
        return {data: result}
    })}
    const cache = createCache(typeMap())
    const client = Delv({cache, queryManager: new QueryManager(), network,
        networkPolicies: [Policy, ...(Policy === NetworkOnly ? [] : [NetworkOnly]), CacheOnly],
        defaults: {networkPolicy: new Policy({}).getName()}})
    const query = '{ books(orderBy: [POSITION_ASC, ID_ASC]) { nodes { title } } }'
    expect(await client.query({query})).toEqual({books: {nodes: [{title: 'First'}, {title: 'Second'}]}})
    const listener = jest.fn()
    const unsubscribe = client.subscribe((types) => listener(types))
    expect(await client.mutate({mutation: 'mutation { updateBook(id: "b1", position: 3) { book { title } } }'})).toEqual({updateBook: {book: {title: 'First'}}})
    expect(client.readCache({query})).toEqual({books: {nodes: [{title: 'Second'}, {title: 'First'}]}})
    expect(await client.query({query, networkPolicy: 'cache-only'})).toEqual(client.readCache({query}))
    expect(network.post).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenCalledWith(expect.arrayContaining(['Book']))
    unsubscribe()
})

it('retains hidden filter values and recomputes nested comparisons after a mutation', async () => {
    const books = [{id: 'b1', title: 'Visible', position: 2, author: {id: 'a1', age: 40, name: 'Author'}}]
    const network = {post: async ({query, variables}) => ({data: await graphql(schema, query, {
        books: () => ({nodes: books}),
        updateBook: ({position}) => { books[0].position = position; return {book: books[0]} }
    }, null, variables)})}
    const cache = createCache(typeMap())
    const client = Delv({cache, queryManager: new QueryManager(), network, networkPolicies: [NetworkOnly]})
    const query = '{ books(filter: {and: [{position: {greaterThan: 1}}, {author: {age: {lessThan: 50}}}]}) { nodes { title } } }'
    expect(await client.query({query, networkPolicy: 'network-only'})).toEqual({books: {nodes: [{title: 'Visible'}]}})
    expect(client.getQueryTypes(query)).toContain('Author')
    expect(client.readCache({query})).toEqual({books: {nodes: [{title: 'Visible'}]}})
    await client.mutate({mutation: 'mutation { updateBook(id: "b1", position: 0) { book { title } } }'})
    expect(client.readCache({query})).toEqual({books: {nodes: []}})
})

it('adds bounded nested selections for recursive relationship filters', () => {
    const enrichment = Enrichment(TypeMap({typeMap: {Query: {books: 'Book'}, Book: {parent: 'Book'}},
        fields: {Book: {...fields.Book, parent: 'Book'}}}))
    const prepared = enrichment.prepare({query: '{ books(filter: {parent: {parent: {position: {greaterThan: 1}}}}) { nodes { title } } }'})
    const recursive = extendSchema(schema, parse('extend type Book { parent: Book } extend input BookFilter { parent: BookFilter }'))
    expect(validate(recursive, parse(prepared.query))).toEqual([])
    expect(selected(prepared.query, ['books', 'nodes', 'parent', 'parent'])).toContain('position')
    expect(selected(prepared.query, ['books', 'nodes', 'parent', 'parent'])).not.toContain('parent')
})

it('injects the configured cache key for types without an id', () => {
    const keyed = buildSchema(`
      type EntityType { type: String! description: String }
      type Entity { id: ID! name: String entityTypeByType: EntityType }
      type EntityConnection { nodes: [Entity!]! }
      type Query { entities: EntityConnection entityTypeByType(type: String!): EntityType }
    `)
    const enrichment = Enrichment(TypeMap({typeMap: {Query: {entities: 'Entity', entityTypeByType: 'EntityType'},
        Entity: {entityTypeByType: 'EntityType'}, EntityType: {}, __keys: {EntityType: 'type'}}, fields: {
        Query: {entities: 'EntityConnection', entityTypeByType: 'EntityType'}, EntityConnection: {nodes: 'Entity'},
        Entity: {id: 'ID', name: 'String', entityTypeByType: 'EntityType'}, EntityType: {type: 'String', description: 'String'}
    }}))
    const prepared = enrichment.prepare({query: '{ entities { nodes { name entityTypeByType { description } } } entityTypeByType(type: "person") { description } }'})
    expect(validate(keyed, parse(prepared.query))).toEqual([])
    expect(selected(prepared.query, ['entities', 'nodes'])).toContain('id')
    expect(selected(prepared.query, ['entities', 'nodes', 'entityTypeByType'])).toEqual(expect.arrayContaining(['type', '__typename']))
    expect(selected(prepared.query, ['entityTypeByType'])).toContain('type')
})

it('uses existing aliased scalar selections instead of adding duplicate fields', () => {
    const prepared = make().prepare({query: '{ books(orderBy: [POSITION_ASC]) { nodes { rank: position } } }'})
    valid(prepared)
    expect(selected(prepared.query, ['books', 'nodes']).filter((name) => name === 'position')).toHaveLength(1)
    expect(prepared.normalize({books: {nodes: [{rank: 3, id: 'b1', __typename: 'Book'}]}}).books.nodes[0].position).toBe(3)
})

it('projects interface fragments using introspected possible types', () => {
    const enrichment = Enrichment(TypeMap({typeMap: {__possibleTypes: {Node: ['Book']}}, fields}))
    const prepared = enrichment.prepare({query: '{ books { nodes { ... on Node { id } } } }'})
    expect(prepared.project({books: {nodes: [{id: 'b1', __typename: 'Book'}]}})).toEqual({books: {nodes: [{id: 'b1'}]}})
})
