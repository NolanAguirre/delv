const Cache = require('../../src/cache')
const TypeMap = require('../../src/queryManager/Postgraphile.js')
const jsonTypeMap = require('./__fixtures__/typemap.json')
const cacheByType = require('./__fixtures__/1_in.json')
const cacheState1 = require('./__fixtures__/1_out.json')
const cacheState2 = require('./__fixtures__/2_out.json')

let typeMap
let cache

const query = `{
    allBooks{
        nodes{
            id
        }
    }
}`

beforeAll(()=>{
    typeMap = new TypeMap({typeMap:jsonTypeMap})
})

describe('Cache unit test', () => {
    it('initialized', () => {
        cache = new Cache(typeMap)
    })

    it('writes into the cache, test 1', () => {
        cache.write({
            cacheProcess:'type',
            data:cacheByType
        })

        expect(cache.getState()).toEqual(cacheState1)
    })

    it('reads from the cache, test 2', () => {
        const data = cache.read({
            query,
            cacheProcess:'type'
        })

        expect(data).toEqual(cacheState2)
    })

})
