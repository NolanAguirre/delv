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

        return expect(TypeMap({api: 'http://fixture/graphql'})).resolves.toEqual(typemap)
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
            expect(Object.keys(map)).toEqual(['Account'])
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

    it('warns on repeated relationship types but keeps both fields', () => {
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
            expect(logSpy).toHaveBeenCalled()
            const conflict = logSpy.mock.calls.some((call) => /conflict detected/.test(call[0]))
            expect(conflict).toBe(true)
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
