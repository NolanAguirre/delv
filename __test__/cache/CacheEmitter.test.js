const CacheEmitter = require('../../src/cache/CacheEmitter.js')

const emitter = new CacheEmitter()

describe('Cache Emitter unit test', () => {
    it('subscribes, emits and unsubscribes', (done)=>{
        emitter.on('1', done)
        emitter.off('1')
        emitter.emit('1', 'foo')

        emitter.on('2', (data) => {
            emitter.off('2')
            expect(data).toMatch('bar')
            done()
        })

        emitter.emit('2', 'bar')
    })

    it('emits cache updates', (done) => {
        emitter.on('UUID', (events)=>{
            expect(events).toEqual(['foo'])
            done()
        })
        emitter.updateType('foo')
        emitter.emitCacheUpdate()
    })

})
