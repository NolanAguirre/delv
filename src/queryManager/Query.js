import Delv from './delv.js'

function Query({
    query,
    variables,
    networkPolicy,
    cacheProcess
}) {
    const emitter = queryManager.register(query, variables)
    const id = '_' + Math.random().toString(36).substr(2, 9)
    const types = Delv.typeMap.getTypes(query)
    let resolved = true

    queryManager.register()

    const query = () => {
        resolved = false
        return Delv.query({
            query,
            variables,
            networkPolicy,
            cacheProcess
        }).then((data)=>{
            resolved = true
            return data
        })
    }


    const addCacheListener = () => {
        Delv.cacheEmitter.on(id, onCacheUpdate)
    }

    const removeCacheListener = () => {
        Delv.cacheEmitter.removeAllListeners(id);
    }

    const onCacheUpdate = (types) => {
        if (resolved) {
            let includesType = types.some(r => types.includes(r))
            if (includesType) {
                query();
            }
        }
    }
}




export default Query
