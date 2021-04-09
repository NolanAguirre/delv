let UID = 'id'

function Cache({storage, cacheProcesses, typeMap, emitter}) {
    let processes = Object.create(null)

    cacheProcesses.forEach(cacheProcess => {
        const policy = new cacheProcess({
            storage,
            typeMap,
            emitter
        })
        processes[policy.getName()] = policy
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
            return processes[cacheProcess].read(other)
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
            processes[cacheProcess].write(other)
        }
    }

    const clear = storage.clear


    const getState = () => ({
        storage:storage.getState()
    })

    const toString = () => JSON.stringify(getState)

    return {
        read,
        write,
        clear,
        getState,
        toString
    }
}

module.exports = Cache
