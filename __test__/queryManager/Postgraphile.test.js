/**
 * Coverage for src/queryManager/Postgraphile.js (PostGraphile type-map generator).
 *
 * To refresh the committed introspection fixture against a live PostGraphile
 * server, post INTROSPECTION_QUERY (see the source) to the server and write the
 * `data.data` payload to __fixtures__/introspection.json. The round-trip test
 * below then re-derives __fixtures__/typemap.json from it.
 */

jest.mock('axios')

const axios = require('axios')
const TypeMap = require('../../src/queryManager/Postgraphile')
const introspection = require('./__fixtures__/introspection.json')
const typemap = require('./__fixtures__/typemap.json')

const mockIntrospection = (data) => {
    axios.post.mockResolvedValue({data: {data}})
}

const mockTypes = (types) => {
    mockIntrospection({__schema: {types}})
}

let logSpy

beforeEach(() => {
    axios.post.mockReset()
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
    logSpy.mockRestore()
})

describe('Postgraphile TypeMap', () => {
    it('derives the committed typemap from the introspection fixture', () => {
        mockIntrospection(introspection)

        return TypeMap({api: 'http://fixture/graphql'}).then(({__fields, ...relationships}) => {
            expect(relationships).toEqual({...typemap, TermEdge: {
                termNodeByFromNode: 'TermNode', termNodeByToNode: 'TermNode',
                termNodeRelationshipByRelationship: 'TermNodeRelationship'
            }})
            expect(__fields.Query).toBeDefined()
        })
    })

    it('resolves *Connection field types from the description backtick', () => {
        mockTypes([
            {
                name: 'Account',
                description: 'An account.',
                fields: [
                    {
                        name: 'membersByAccountId',
                        type: {
                            name: 'AccountMembersConnection',
                            description: 'A connection to a list of `AccountMember` values.',
                            ofType: null
                        }
                    }
                ]
            }
        ])

        return TypeMap({api: 'http://fixture/graphql'}).then((map) => {
            expect(map.Account.membersByAccountId).toBe('AccountMember')
        })
    })

    it('excludes Edge, Payload, Connection, and blacklisted types from the map keys', () => {
        mockTypes([
            {
                name: 'Account',
                description: 'An account.',
                fields: [
                    {name: 'name', type: {name: 'String', description: null, ofType: null}}
                ]
            },
            {
                name: 'AccountsEdge',
                description: 'An edge.',
                fields: [
                    {name: 'cursor', type: {name: 'Cursor', description: null, ofType: null}}
                ]
            },
            {
                name: 'CreateAccountPayload',
                description: 'A payload.',
                fields: [
                    {name: 'clientMutationId', type: {name: 'String', description: null, ofType: null}}
                ]
            },
            {
                name: 'AccountsConnection',
                description: 'A connection.',
                fields: [
                    {name: 'totalCount', type: {name: 'Int', description: null, ofType: null}}
                ]
            },
            {
                name: 'edges',
                description: 'Blacklisted.',
                fields: [
                    {name: 'foo', type: {name: 'String', description: null, ofType: null}}
                ]
            }
        ])

        return TypeMap({api: 'http://fixture/graphql'}).then((map) => {
            expect(Object.keys(map).filter((key) => key !== '__fields')).toEqual(['Account'])
            expect(map.AccountsEdge).toBeUndefined()
            expect(map.CreateAccountPayload).toBeUndefined()
            expect(map.AccountsConnection).toBeUndefined()
            expect(map.edges).toBeUndefined()
        })
    })

    it('drops scalar blacklisted field types from the field values', () => {
        mockTypes([
            {
                name: 'Account',
                description: 'An account.',
                fields: [
                    {name: 'id', type: {name: 'Int', description: null, ofType: null}},
                    {name: 'name', type: {name: 'String', description: null, ofType: null}},
                    {name: 'rowId', type: {name: 'UUID', description: null, ofType: null}},
                    {name: 'cursor', type: {name: 'Cursor', description: null, ofType: null}},
                    {name: 'ownerByOwnerId', type: {name: 'User', description: null, ofType: null}}
                ]
            }
        ])

        return TypeMap({api: 'http://fixture/graphql'}).then((map) => {
            expect(map.Account).toEqual({ownerByOwnerId: 'User'})
        })
    })

    it('retains repeated relationship fields for configuration without logging warnings', () => {
        mockTypes([
            {
                name: 'Account',
                description: 'An account.',
                fields: [
                    {name: 'ownerByOwnerId', type: {name: 'User', description: null, ofType: null}},
                    {name: 'creatorByCreatedBy', type: {name: 'User', description: null, ofType: null}}
                ]
            }
        ])

        return TypeMap({api: 'http://fixture/graphql'}).then((map) => {
            expect(map.Account).toEqual({
                ownerByOwnerId: 'User',
                creatorByCreatedBy: 'User'
            })
            expect(logSpy).not.toHaveBeenCalled()
            expect(TypeMap({typeMap: map}).isNetworkGenerated).toBe(true)
        })
    })

    it('uses a prebuilt typeMap without any network request', () => {
        const prebuilt = {Account: {ownerByOwnerId: 'User'}}
        const result = TypeMap({typeMap: prebuilt})

        expect(axios.post).not.toHaveBeenCalled()
        expect(typeof result.getTypeDefinition).toBe('function')
        expect(typeof result.toString).toBe('function')
        expect(typeof result.getTypes).toBe('function')
        expect(result.toString()).toEqual(prebuilt)
        expect(result.getTypeDefinition('Account')).toEqual({ownerByOwnerId: 'User'})
    })

    describe('getTypes', () => {
        const typeMap = {
            Query: {allBooks: 'Book', allAuthors: 'Author'},
            Book: {bookAuthorByBookId: 'BookAuthor'},
            BookAuthor: {authorByAuthorId: 'Author'}
        }

        it('walks a connection query through the type map', () => {
            const result = TypeMap({typeMap})
            const query = `{
                allBooks {
                    nodes {
                        id
                        title
                        bookAuthorByBookId {
                            authorByAuthorId { name }
                        }
                    }
                }
            }`
            expect(result.getTypes(query)).toEqual(['Book', 'BookAuthor', 'Author'])
        })

        it('walks edges/node selections without adding wrapper types', () => {
            const result = TypeMap({typeMap})
            const query = `{
                allBooks {
                    edges {
                        node { id bookAuthorByBookId { id } }
                    }
                }
            }`
            expect(result.getTypes(query)).toEqual(['Book', 'BookAuthor'])
        })

        it('includes the operation name marker for named queries', () => {
            const result = TypeMap({typeMap})
            const query = `query Books { allBooks { nodes { id } } }`
            expect(result.getTypes(query)).toEqual(['__Books', 'Book'])
        })
    })
})

it('retains scalar/wrapped field metadata and mutation payloads when introspecting', async () => {
    mockTypes([
        {name: 'Query', fields: [{name: 'allBooks', type: {name: 'BooksConnection'}}]},
        {name: 'Book', fields: [{name: 'position', type: {name: null, ofType: {name: 'BigFloat'}}}]},
        {name: 'BooksConnection', fields: [{name: 'nodes', type: {name: null, ofType: {name: null, ofType: {name: null, ofType: {name: 'Book'}}}}}]},
        {name: 'Mutation', fields: [{name: 'moveBook', type: {name: 'MoveBookPayload'}}]},
        {name: 'MoveBookPayload', fields: [{name: 'book', type: {name: 'Book'}}]}
    ])
    const map = await TypeMap({api: '/graphql'})
    const hydrated = TypeMap({typeMap: JSON.parse(JSON.stringify(map))})
    expect(hydrated.getFields('Book').position).toBe('BigFloat')
    expect(hydrated.getFields('BooksConnection').nodes).toBe('Book')
    expect(hydrated.getFields('Mutation').moveBook).toBe('MoveBookPayload')
    expect(hydrated.getFields('MoveBookPayload').book).toBe('Book')
})

it('serializes manually supplied output fields with a prebuilt map', () => {
    const original = TypeMap({typeMap: {Book: {}}, fields: {Book: {position: 'BigFloat'}}})
    const restored = TypeMap({typeMap: JSON.parse(JSON.stringify(original.toString()))})
    expect(restored.getFields('Book').position).toBe('BigFloat')
})

describe('cache keys', () => {
    const scalar = (name) => ({kind: 'SCALAR', name, ofType: null})
    const object = (name) => ({kind: 'OBJECT', name, ofType: null})
    const nonNull = (type) => ({kind: 'NON_NULL', name: null, ofType: type})
    const field = (name, type, args = []) => ({name, type, args})
    const arg = (name, type) => ({name, defaultValue: null, type})
    const lookup = (name, type, ...args) => field(name, object(type), args.map(([argName, argType]) => arg(argName, nonNull(scalar(argType)))))
    const types = (extraQuery = [], extraTypes = []) => [
        {name: 'Query', fields: [
            field('allEntityTypes', {kind: 'OBJECT', name: 'EntityTypesConnection', description: 'A connection to a list of `EntityType` values.', ofType: null}),
            lookup('entityTypeByType', 'EntityType', ['type', 'String']),
            lookup('entityType', 'EntityType', ['nodeId', 'ID']),
            lookup('accountById', 'Account', ['id', 'Int']),
            ...extraQuery
        ]},
        {name: 'EntityTypesConnection', fields: [field('nodes', {kind: 'LIST', name: null, ofType: object('EntityType')})]},
        {name: 'EntityType', fields: [field('nodeId', nonNull(scalar('ID'))), field('type', nonNull(scalar('String'))), field('description', scalar('String'))]},
        {name: 'Account', fields: [field('nodeId', nonNull(scalar('ID'))), field('id', nonNull(scalar('Int'))), field('name', scalar('String'))]},
        ...extraTypes
    ]
    const pair = {name: 'Pair', fields: [field('left', nonNull(scalar('Int'))), field('right', nonNull(scalar('Int')))]}
    const composite = lookup('pairByLeftAndRight', 'Pair', ['left', 'Int'], ['right', 'Int'])

    it('detects a single-column lookup as the key and leaves id types alone', async () => {
        mockTypes(types())
        const map = await TypeMap({api: '/graphql'})
        expect(map.__keys).toEqual({EntityType: 'type'})
        expect(logSpy).not.toHaveBeenCalled()
        const hydrated = TypeMap({typeMap: JSON.parse(JSON.stringify(map))})
        expect(hydrated.getKey('EntityType')).toBe('type')
        expect(hydrated.getKey('Account')).toBe('id')
    })

    it('logs and sets no key when a type has more than one single-column lookup', async () => {
        mockTypes(types([lookup('fooByA', 'Foo', ['a', 'String']), lookup('fooByB', 'Foo', ['b', 'String'])],
            [{name: 'Foo', fields: [field('a', nonNull(scalar('String'))), field('b', nonNull(scalar('String')))]}]))
        const map = await TypeMap({api: '/graphql'})
        expect(map.__keys).toEqual({EntityType: 'type'})
        expect(logSpy).toHaveBeenCalledWith('delv: Foo has multiple single-column lookups (fooByA, fooByB); it will not be cached. Set keys.Foo in TypeMap config.')
    })

    it('logs and sets no key for a composite lookup', async () => {
        mockTypes(types([composite], [pair]))
        const map = await TypeMap({api: '/graphql'})
        expect(map.__keys).toEqual({EntityType: 'type'})
        expect(logSpy).toHaveBeenCalledWith('delv: Pair has no id and no single-column lookup; it will not be cached. Set keys.Pair in TypeMap config.')
    })

    it('skips the log for types configured with keys during introspection', async () => {
        mockTypes(types([composite], [pair]))
        await TypeMap({api: '/graphql', keys: {Pair: 'left'}})
        expect(logSpy).not.toHaveBeenCalled()
    })

    it('lets configured keys override detection and serializes them', async () => {
        mockTypes(types([composite], [pair]))
        const map = await TypeMap({api: '/graphql'})
        const configured = TypeMap({typeMap: map, keys: {EntityType: 'description', Pair: 'left'}})
        expect(configured.getKey('EntityType')).toBe('description')
        expect(configured.getKey('Pair')).toBe('left')
        expect(configured.toString().__keys).toEqual({EntityType: 'description', Pair: 'left'})
        const restored = TypeMap({typeMap: JSON.parse(JSON.stringify(configured.toString()))})
        expect(restored.getKey('Pair')).toBe('left')
    })

    it('logs a configured key that is not a field of its type', async () => {
        mockTypes(types())
        const map = await TypeMap({api: '/graphql'})
        TypeMap({typeMap: map, keys: {EntityType: 'missing'}})
        expect(logSpy).toHaveBeenCalledWith("delv: keys.EntityType = 'missing' is not a field of EntityType")
    })

    it('defaults to id for handwritten maps', () => {
        expect(TypeMap({typeMap: {Book: {}}}).getKey('Book')).toBe('id')
    })
})

it('retains nested list and non-null wrappers and enum values from introspection', async () => {
    mockTypes([
        {name: 'Query', fields: [{name: 'scores', type: {kind: 'NON_NULL', ofType: {kind: 'LIST', ofType: {kind: 'NON_NULL', ofType: {kind: 'SCALAR', name: 'Float'}}}}}]},
        {name: 'Status', enumValues: [{name: 'ACTIVE'}]}
    ])
    const map = TypeMap({typeMap: await TypeMap({api: 'http://fixture/graphql'})})
    expect(map.getFieldType('Query', 'scores')).toBe('[Float!]!')
    expect(map.getFields('Query').scores).toBe('Float')
    expect(map.getEnumValues('Status')).toEqual(['ACTIVE'])
    const {parse} = require('graphql')
    expect(() => parse(axios.post.mock.calls[0][1].query)).not.toThrow()
})
