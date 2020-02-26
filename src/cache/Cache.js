let UID = 'id'

function Cache({storage, cacheProcesses, typeMap, emitter}) {
    const process = Object.create(null)

    cacheProcesses.forEach(process => {
        const policy = new process({
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
        toString
    }
}

module.exports = Cache
