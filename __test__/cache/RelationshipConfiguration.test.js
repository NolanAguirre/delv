const Cache = require('../../src/cache')
const TypeMap = require('../../src/queryManager/Postgraphile')
const Delv = require('../../src/core/delv')

const map = {
    Query: {allNodes: 'TermNode'},
    TermEdge: {fromNode: 'TermNode', toNode: 'TermNode'},
    TermNode: {outgoing: 'TermEdge', incoming: 'TermEdge', lineage: 'TermNode'},
    __fields: {TermEdge: {fromNode: 'TermNode', toNode: 'TermNode'},
        TermNode: {outgoing: 'TermEdgesConnection', incoming: 'TermEdgesConnection', lineage: 'TermNode'}}
}
const reverseReferences = {
    TermEdge: {fromNode: 'outgoing', toNode: 'incoming'},
    TermNode: {outgoing: 'fromNode', incoming: 'toNode', lineage: null}
}
const setup = (config, network = true) => {
    const schema = {...map}
    if(network) Object.defineProperty(schema, '__networkGenerated', {value: true})
    const cache = Cache(TypeMap({typeMap: schema}))
    const client = Delv({cache, network: {}, queryManager: {}, networkPolicies: [], reverseReferences: config})
    return {cache, client}
}
const write = (cache, node) => cache.write({cacheProcess: 'type', data: {data: {entity: node}}})
const edge = {__typename: 'TermEdge', id: 'e', fromNode: {__typename: 'TermNode', id: 'a'},
    toNode: {__typename: 'TermNode', id: 'b'}}

it('reports every ambiguous direction and self-reference without inventing links', () => {
    const {cache, client} = setup()
    expect(client.getSchemaIssues().map(issue => `${issue.type}.${issue.field}`)).toEqual([
        'TermEdge.fromNode', 'TermEdge.toNode', 'TermNode.outgoing', 'TermNode.incoming', 'TermNode.lineage'
    ])
    write(cache, edge)
    expect(cache.inspect().TermNode.a).toEqual({__typename: 'TermNode', id: 'a'})
    expect(cache.inspect().TermEdge.e).toMatchObject({fromNode: 'a', toNode: 'b'})
})

it('uses configured inverse fields, preserves cardinality and deduplicates inferred membership', () => {
    const {cache, client} = setup(reverseReferences)
    expect(client.getSchemaIssues()).toEqual([])
    write(cache, edge)
    write(cache, edge)
    expect(cache.inspect().TermNode.a).toEqual({__typename: 'TermNode', id: 'a', outgoing: ['e']})
    expect(cache.inspect().TermNode.b).toEqual({__typename: 'TermNode', id: 'b', incoming: ['e']})
    write(cache, {__typename: 'TermNode', id: 'c', outgoing: {nodes: [{__typename: 'TermEdge', id: 'f'}]}})
    expect(cache.inspect().TermEdge.f.fromNode).toBe('c')
    expect(cache.inspect().TermEdge.f.toNode).toBeUndefined()
    write(cache, {__typename: 'TermNode', id: 'a', lineage: {__typename: 'TermNode', id: 'b'}})
    expect(cache.inspect().TermNode.b.lineage).toBeUndefined()
    expect(cache.inspect().TermNode.a.lineage).toBe('b')
})

it('reports invalid overrides and skips them safely', () => {
    const {cache, client} = setup({...reverseReferences, TermEdge: {fromNode: 'missing', toNode: 'incoming'}, Typo: {x: null}})
    expect(client.getSchemaIssues()).toEqual(expect.arrayContaining([
        expect.objectContaining({type: 'TermEdge', field: 'fromNode', candidates: ['outgoing', 'incoming']}),
        expect.objectContaining({type: 'Typo', field: 'x'})
    ]))
    write(cache, edge)
    expect(cache.inspect().TermNode.a.outgoing).toBeUndefined()
})

it('uses configuration with prebuilt maps without showing development diagnostics', () => {
    const {cache, client} = setup(reverseReferences, false)
    expect(client.getSchemaIssues()).toEqual([])
    write(cache, edge)
    expect(cache.inspect().TermNode.a.outgoing).toEqual(['e'])
})
