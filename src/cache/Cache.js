let UID = 'id'

function Cache({storage, cacheProcesses, typeMap, emitter}) {
    const process = Object.create(null)

    cacheProcesses.forEach((ProcessClass) => {
        const policy = new ProcessClass({
            storage,
            typeMap,
            emitter
        })
        process[policy.getName()] = policy
    })

    const read = ({cacheProcess, ...other}) => {
        if(cacheProcess instanceof Function){
            return cacheProcess({
                storage,
                typeMap,
                emitter,
                ...other
            })
        }else{
            return process[cacheProcess].read(other)
        }
    }

    const write = ({cacheProcess, ...other}) => {
        if(cacheProcess instanceof Function){
            cacheProcess({
                storage,
                typeMap,
                emitter,
                ...other
            })
        }else{
            process[cacheProcess].write(other)
        }
    }

    const clear = storage.clear

    const subscribe = (callback) => {
        const id = '_' + Math.random().toString(36).substr(2, 9)
        emitter.on(id, callback)
        return () => emitter.off(id)
    }

    const getQueryTypes = (query) => {
        if(typeMap && typeMap.getTypes){
            return typeMap.getTypes(query)
        }
        return []
    }

    const toString = () => {
        let printValue = {
            storage:storage.toString()
        }
        return printValue
    }

    return {
        read,
        write,
        clear,
        subscribe,
        getQueryTypes,
        toString
    }
}

module.exports = Cache
