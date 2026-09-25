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

    it('batches nested updates into one emit when the outermost batch exits', () => {
        const batching = new CacheEmitter()
        const emits = []
        batching.on('listener', (types) => emits.push(types))

        const result = batching.batch(() => {
            batching.updateType('Book')
            batching.emitCacheUpdate()
            batching.batch(() => {
                batching.updateType('Author')
                batching.emitCacheUpdate()
            })
            expect(emits).toEqual([])
            return 'done'
        })

        expect(result).toBe('done')
        expect(emits).toEqual([['Book', 'Author']])
        expect(() => batching.batch(() => {
            batching.updateType('User')
            throw new Error('boom')
        })).toThrow('boom')
        expect(emits).toEqual([['Book', 'Author'], ['User']])
        batching.batch(() => {})
        expect(emits).toHaveLength(2)
    })

})
