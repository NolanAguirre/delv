function CacheEmitter() {
    let changedTypes = []
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
        for(let event of Object.values(events)){
            event(changedTypes)
        }
        changedTypes = []
    }

    return {
        emit,
        on,
        off,
        updateType,
        emitCacheUpdate,
    }
}

module.exports = CacheEmitter
