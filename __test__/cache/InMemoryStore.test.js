const InMemoryStore = require('../../src/cache/storage/InMemoryStore.js')

const store = new InMemoryStore()

describe('In memory store unit test', ()=>{
    it('sets and gets', ()=>{
        const node = {foo:"bar"}
        store.set(1, 'testType', node)
        expect(store.get('testType').get(1)).toEqual(node)
    })
    it('absolute sets and absolute gets', ()=>{
        const node = {foo:"foo"}
        store.setAbsolute(1, node)
        expect(store.getAbsolute(1)).toEqual(node)
    })
    it('merges', ()=>{
        const node = {foo:"foo", bar:"bar"}
        const node2 = {foo:"foo", bar:"foo", baz:'baz'}
        store.merge(1, 'merge', node)
        store.merge(1, 'merge', node2)
        expect(store.get('merge').get(1)).toEqual({...node, ...node2})
    })
    it('replaces when it should', ()=>{
        const node = {foo:"foo", bar:"bar"}
        store.set(1, 'merge', node)
        expect(store.get('merge').get(1)).toEqual(node)
    })
})
