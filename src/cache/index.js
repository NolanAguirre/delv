const Cache = require('./Cache')
const Emitter = require('./CacheEmitter')
const Storage = require('./storage/InMemoryStore')
const Type = require('./policy/Type.js')
const Query = require('./policy/Query.js')

module.exports = (typeMap) => {
    return new Cache({
        storage:new Storage(),
        cacheProcesses:[Type, Query],
        typeMap,
        emitter:new Emitter()
    })
}
