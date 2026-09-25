const {Delv, createCache, TypeMap, QueryManager, NetworkFirst, NetworkOnly} = require('../../src')
const schema = {
    Query: {allStories: 'Story', storyById: 'Story'}, Story: {timelines: 'Timeline'}, Timeline: {},
    __fields: {
        Query: {allStories: 'StoriesConnection', storyById: 'Story'},
        StoriesConnection: {nodes: 'Story', edges: 'StoriesEdge', totalCount: 'Int'},
        StoriesEdge: {node: 'Story', cursor: 'Cursor'},
        Story: {id: 'ID', title: 'String', timelines: 'TimelinesConnection'},
        TimelinesConnection: {nodes: 'Timeline', totalCount: 'Int'}, Timeline: {id: 'ID'}
    }
}
const setup = () => {
    const cache = createCache(TypeMap({typeMap: schema}))
    const network = {post: jest.fn()}
    const client = Delv({cache, network, queryManager: new QueryManager(), networkPolicies: [NetworkFirst, NetworkOnly],
        defaults: {networkPolicy: 'network-first'}})
    return {client, cache, network}
}
const response = (data) => ({data: {data}})

it('preserves server totals on second mount, including nested count-only selections', async () => {
    const {client, network} = setup()
    const query = '{ allStories(first: 1) { totalCount nodes { id title timelines { totalCount } } } }'
    network.post.mockResolvedValue(response({allStories: {__typename: 'StoriesConnection', totalCount: 50, nodes: [
        {__typename: 'Story', id: 's1', title: 'A', timelines: {__typename: 'TimelinesConnection', totalCount: 12}}
    ]}}))
    const first = await client.query({query})
    expect(await client.query({query})).toEqual(first)
    expect(first.allStories.totalCount).toBe(50)
    expect(first.allStories.nodes[0].timelines.totalCount).toBe(12)
    expect(network.post).toHaveBeenCalledTimes(1)
})

it('keeps count-only root aliases and differing arguments distinct', async () => {
    const {client, network} = setup()
    const query = '{ active: allStories(condition: {title: "A"}) { count: totalCount } empty: allStories(condition: {title: "B"}) { totalCount } }'
    network.post.mockResolvedValue(response({active: {__typename: 'StoriesConnection', count: 5},
        empty: {__typename: 'StoriesConnection', totalCount: 0}}))
    expect(await client.query({query})).toEqual({active: {count: 5}, empty: {totalCount: 0}})
    expect(await client.query({query})).toEqual({active: {count: 5}, empty: {totalCount: 0}})
})

it('scopes snapshots to variables, replaces totals on refetch and clears them on reset', async () => {
    const {client, network} = setup()
    const query = 'query Counts($title: String!) { allStories(condition: {title: $title}) { totalCount } }'
    const a = {query, variables: {title: 'A'}}, b = {query, variables: {title: 'B'}}
    network.post.mockResolvedValueOnce(response({allStories: {__typename: 'StoriesConnection', totalCount: 7}}))
    await client.query(a)
    network.post.mockResolvedValueOnce(response({allStories: {__typename: 'StoriesConnection', totalCount: 0}}))
    await client.query(b)
    expect((await client.query(a)).allStories.totalCount).toBe(7)
    expect((await client.query(b)).allStories.totalCount).toBe(0)
    network.post.mockResolvedValueOnce(response({allStories: {__typename: 'StoriesConnection', totalCount: 9}}))
    await client.query({...a, networkPolicy: 'network-only'})
    expect((await client.query(a)).allStories.totalCount).toBe(9)
    client.reset()
    expect(() => client.readCache(a)).toThrow(/cache miss/)
})

it('supports edge connections while retaining normalized entity updates', async () => {
    const {client, network, cache} = setup()
    const query = '{ allStories { totalCount edges { cursor node { id title } } } }'
    network.post.mockResolvedValue(response({allStories: {__typename: 'StoriesConnection', totalCount: 10, edges: [
        {cursor: 'c1', node: {__typename: 'Story', id: 's1', title: 'A'}}
    ]}}))
    await client.query({query})
    cache.write({cacheProcess: 'type', data: {data: {story: {__typename: 'Story', id: 's1', title: 'Updated'}}}})
    expect(await client.query({query})).toEqual({allStories: {totalCount: 10, edges: [
        {cursor: 'c1', node: {id: 's1', title: 'Updated'}}
    ]}})
})

it('reads nested totals through a singular root without discarding previously cached members', async () => {
    const {client, network, cache} = setup()
    cache.write({cacheProcess: 'type', data: {data: {story: {__typename: 'Story', id: 's1',
        timelines: {nodes: [{__typename: 'Timeline', id: 't1'}]}}}}})
    const query = 'query Story($id: ID!) { storyById(id: $id) { id timelines { totalCount } } }'
    network.post.mockResolvedValue(response({storyById: {__typename: 'Story', id: 's1',
        timelines: {__typename: 'TimelinesConnection', totalCount: 6}}}))
    const options = {query, variables: {id: 's1'}}
    const first = await client.query(options)
    expect(await client.query(options)).toEqual(first)
    expect(first.storyById.timelines.totalCount).toBe(6)
    expect(cache.inspect().Story.s1.timelines).toEqual(['t1'])
})
