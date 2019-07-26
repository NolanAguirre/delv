import TypeMap from './queryManager/TypeMap.js'
import TypeMapData from './queryManager/TypeMapData.json'
import Cache from './cache/Cache.js'
import InMemoryStore from './storage/InMemoryStore.js'
import CacheEmitter from './cache/CacheEmitter.js'
import test from './test.json'

const typeMap = new TypeMap({typeMap:TypeMapData})
const cache = new Cache({
    storage:new InMemoryStore(),
    emitter:new CacheEmitter(),
    typeMap:typeMap
})
cache.cacheByType(test.data)
console.log(cache.storage.toString())
