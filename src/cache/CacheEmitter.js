function CacheEmitter() {
    let changedTypes = []
    let depth = 0
    let requested = false
    const events = Object.create(null)

    const on = (eventName, callback) => {
        if(callback instanceof Function){
            events[eventName] = callback
        }
    }

    const off = (eventName) => { //performace can be way better
        delete events[eventName]
    }

    const emit = (eventName, args) => {
        if(events[eventName]){
            events[eventName](args)
        }
    }


    const updateType = (type) => {
        if(!changedTypes.includes(type)){
            changedTypes.push(type)
        }
    }

    const emitCacheUpdate = () => {
        if(depth > 0){
            requested = true
            return
        }
        const types = changedTypes
        changedTypes = []
        for(let event of Object.values(events)){
            event(types)
        }
    }

    // Subscribers see one final state for everything written inside fn.
    const batch = (fn) => {
        depth++
        try{
            return fn()
        }finally{
            depth--
            if(depth === 0 && (requested || changedTypes.length)){
                requested = false
                emitCacheUpdate()
            }
        }
    }

    return {
        emit,
        on,
        off,
        updateType,
        emitCacheUpdate,
        batch
    }
}

module.exports = CacheEmitter
