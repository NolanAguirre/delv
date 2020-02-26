const Cache = require('../../src/cache')
const TypeMap = require('../../src/queryManager/Postgraphile.js')
const jsonTypeMap = require('./__fixtures__/typemap.json')
let typeMap
let cache

beforeAll(()=>{
    typeMap = new TypeMap({typemap:jsonTypeMap})
})

describe('Cache unit test', () => {
    it('initialized', () => {
        cache = new Cache(typeMap)
    })

    it('writes into the cache', () => {
        
    })

    it('reads from the cache', () => {

    })

})
