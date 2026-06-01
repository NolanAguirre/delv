const delv = require('../src')

describe('public entry point', () => {
    it('exports the core public surface', () => {
        expect(delv.Delv).toBeInstanceOf(Function)
        expect(delv.createCache).toBeInstanceOf(Function)
        expect(delv.QueryManager).toBeInstanceOf(Function)
        expect(delv.TypeMap).toBeInstanceOf(Function)
        expect(delv.CacheFirst).toBeInstanceOf(Function)
        expect(delv.CacheOnly).toBeInstanceOf(Function)
        expect(delv.NetworkOnly).toBeInstanceOf(Function)
        expect(delv.NetworkOnce).toBeInstanceOf(Function)
        expect(delv.AxiosWithErrors).toBeInstanceOf(Function)
    })
})

