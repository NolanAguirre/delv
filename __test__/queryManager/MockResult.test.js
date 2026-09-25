const mockResult = require('../../src/queryManager/MockResult')
const TypeMap = require('../../src/queryManager/Postgraphile')

const typeMap = TypeMap({typeMap: {
    __fields: {
        Query: {users: '[User!]!', search: '[Result!]!', matrix: '[[Float!]!]!'},
        User: {name: 'String!', age: 'Int', active: 'Boolean', friend: 'User', status: 'Status', id: 'ID'},
        Team: {title: 'String'}
    },
    __possibleTypes: {Result: ['User', 'Team']},
    __enumValues: {Status: ['ACTIVE', 'INACTIVE']}
}})

it('fills selected nested objects and lists, merging aliases and fragments and honoring directives', () => {
    const query = `query Mock($show: Boolean = false) {
        people: users { ...Details friend { name } }
        people: users { friend { age } name @skip(if: true) age @include(if: $show) }
        matrix
    }
    fragment Details on User { label: name id active status }`
    const expected = {people: [{label: 'Loading', id: 'Loading', active: false, status: 'ACTIVE', friend: {name: 'Loading', age: 0}}], matrix: [[0]]}
    expect(mockResult(typeMap, {query})).toEqual(expected)
    expect(mockResult(typeMap, {query, variables: {show: true}}).people[0].age).toBe(0)
})

it('selects a concrete abstract type with consistent typename and fragments', () => {
    expect(mockResult(typeMap, {query: '{ search { __typename ... on User { name } ... on Team { title } } }'}))
        .toEqual({search: [{__typename: 'User', name: 'Loading'}]})
})

it('reports missing metadata rather than inventing field types', () => {
    expect(() => mockResult(typeMap, {query: '{ users { unknown } }'})).toThrow('User.unknown')
})

it('rejects cyclic fragments and creates fresh data per call', () => {
    expect(() => mockResult(typeMap, {query: '{ users { ...Loop } } fragment Loop on User { friend { ...Loop } }'})).toThrow('invalid fragment Loop')
    const first = mockResult(typeMap, {query: '{ users { name } }'})
    first.users[0].name = 'Changed'
    expect(mockResult(typeMap, {query: '{ users { name } }'}).users[0].name).toBe('Loading')
})

it('preserves explicit field overrides and list shapes when serializing metadata', () => {
    const original = TypeMap({typeMap: {__fieldTypes: {Query: {users: 'User'}}}, fields: {Query: {users: '[User!]!'}, User: {name: 'String'}}})
    const restored = TypeMap({typeMap: JSON.parse(JSON.stringify(original.toString()))})
    expect(restored.getFields('Query').users).toBe('User')
    expect(mockResult(restored, {query: '{ users { name } }'})).toEqual({users: [{name: 'Loading'}]})
})
