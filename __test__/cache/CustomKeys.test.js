const Cache = require('../../src/cache')
const TypeMap = require('../../src/queryManager/Postgraphile')

const schema = {
    Query: {allEntityTypes: 'EntityType', entityTypeByType: 'EntityType', allEntities: 'Entity', allSettings: 'Setting'},
    EntityType: {entitiesByType: 'Entity'},
    Entity: {entityTypeByType: 'EntityType'},
    Setting: {},
    __keys: {EntityType: 'type'}
}
const make = (keys) => Cache(TypeMap({typeMap: schema, keys}))
const write = (cache, query, data, variables) => cache.write({cacheProcess: 'type', query, variables, data: {data}})
const read = (cache, query, variables) => cache.read({cacheProcess: 'type', query, variables})
const entityType = (type, description, extra = {}) => ({__typename: 'EntityType', type, description, ...extra})
const listQuery = '{ allEntityTypes { nodes { type description } } }'

it('normalizes a keyed type by its key and re-reads a list', () => {
    const cache = make()
    write(cache, listQuery, {allEntityTypes: {__typename: 'EntityTypesConnection',
        nodes: [entityType('person', 'Shared'), entityType('org', 'Shared')]}})
    expect(cache.inspect().EntityType.person).toEqual(entityType('person', 'Shared'))
    expect(read(cache, listQuery).allEntityTypes.nodes).toEqual([
        {type: 'person', description: 'Shared'}, {type: 'org', description: 'Shared'}
    ])
    // Equal sort values fall back to the type's key.
    const ordered = read(cache, '{ allEntityTypes(orderBy: DESCRIPTION_ASC) { nodes { type } } }')
    expect(ordered.allEntityTypes.nodes).toEqual([{type: 'org'}, {type: 'person'}])
})

it('resolves a nested keyed reference and its reverse reference', () => {
    const cache = make()
    const query = '{ allEntities { nodes { id name entityTypeByType { type description } } } }'
    write(cache, query, {allEntities: {__typename: 'EntitiesConnection', nodes: [
        {__typename: 'Entity', id: 'e1', name: 'Ada', entityTypeByType: entityType('person', 'A person')}
    ]}})
    expect(cache.inspect().Entity.e1.entityTypeByType).toBe('person')
    expect(cache.inspect().EntityType.person.entitiesByType).toEqual(['e1'])
    expect(read(cache, query).allEntities.nodes).toEqual([
        {id: 'e1', name: 'Ada', entityTypeByType: {type: 'person', description: 'A person'}}
    ])

    write(cache, undefined, {entityType: entityType('org', 'An org', {entitiesByType: {nodes: [
        {__typename: 'Entity', id: 'e2', name: 'Acme'}
    ]}})})
    expect(cache.inspect().Entity.e2.entityTypeByType).toBe('org')
})

it('re-reads a single-record lookup from cache', () => {
    const cache = make()
    const query = 'query EntityType($type: String!) { entityTypeByType(type: $type) { type description } }'
    const variables = {type: 'person'}
    write(cache, query, {entityTypeByType: entityType('person', 'A person')}, variables)
    expect(read(cache, query, variables)).toEqual({entityTypeByType: {type: 'person', description: 'A person'}})
    write(cache, undefined, {updateEntityTypeByType: {__typename: 'UpdateEntityTypePayload',
        entityType: entityType('person', 'Updated')}})
    expect(read(cache, query, variables)).toEqual({entityTypeByType: {type: 'person', description: 'Updated'}})
})

it('keeps nested connection counts distinct per keyed owner', () => {
    const cache = make()
    const query = '{ allEntityTypes { nodes { type entitiesByType { totalCount } } } }'
    write(cache, query, {allEntityTypes: {__typename: 'EntityTypesConnection', nodes: [
        entityType('person', undefined, {entitiesByType: {__typename: 'EntitiesConnection', totalCount: 3}}),
        entityType('org', undefined, {entitiesByType: {__typename: 'EntitiesConnection', totalCount: 7}})
    ]}})
    expect(read(cache, query).allEntityTypes.nodes).toEqual([
        {type: 'person', entitiesByType: {totalCount: 3}},
        {type: 'org', entitiesByType: {totalCount: 7}}
    ])
})

it('maintains membership on create and delete mutations', () => {
    const cache = make()
    write(cache, listQuery, {allEntityTypes: {__typename: 'EntityTypesConnection', nodes: [entityType('person', 'A person')]}})

    write(cache, 'mutation { createEntityType(input: {}) { entityType { type description } } }', {
        createEntityType: {__typename: 'CreateEntityTypePayload', entityType: entityType('org', 'An org')}
    })
    expect(read(cache, listQuery).allEntityTypes.nodes).toEqual([
        {type: 'person', description: 'A person'}, {type: 'org', description: 'An org'}
    ])

    write(cache, 'mutation { deleteEntityTypeByType(input: {type: "person"}) { entityType { type } } }', {
        deleteEntityTypeByType: {__typename: 'DeleteEntityTypePayload', entityType: {__typename: 'EntityType', type: 'person'}}
    })
    expect(read(cache, listQuery).allEntityTypes.nodes).toEqual([{type: 'org', description: 'An org'}])
    expect(cache.inspect().EntityType.person).toBeUndefined()
})

it('uses a configured key for a type without detection', () => {
    const query = '{ allSettings { nodes { name value } } }'
    const data = {allSettings: {__typename: 'SettingsConnection', nodes: [{__typename: 'Setting', name: 'theme', value: 'dark'}]}}

    const unkeyed = make()
    write(unkeyed, query, data)
    expect(unkeyed.inspect().Setting).toBeUndefined()

    const keyed = make({Setting: 'name'})
    write(keyed, query, data)
    expect(keyed.inspect().Setting.theme).toEqual({__typename: 'Setting', name: 'theme', value: 'dark'})
    expect(read(keyed, query).allSettings.nodes).toEqual([{name: 'theme', value: 'dark'}])
})
