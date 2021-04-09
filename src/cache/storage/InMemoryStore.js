function StoreType() {
    const store = Object.create(null)

    const get = (key) => store[key]

    const set = (key, node) => store[key] = node

    const remove = (key) => store[key] = null

    const merge = (key, node) => {
        store[key] = {...store[key], ...node}
    }

    const getValues = () => Object.values(store)

    const getState = () => store

    return {
        get,
        set,
        remove,
        merge,
        getValues,
        getState
    }
}


function InMemoryStore(){
    let store = Object.create(null)

    const clear = () => store = Object.create(null)

    const get = (type) => store[type]

    const set = (id, type, node) => {
        let storeType = store[type]
        if(storeType){
            storeType.set(id, node)
        }else{
            storeType = new StoreType()
            storeType.set(id, node)
            store[type] = storeType
        }
    }

    const remove = (node) => {

    }

    const getAbsolute = (id) => store[id]

    const setAbsolute = (id, node) => store[id] = node

    const removeAbsolute = (id) => store.remove(id)

    const merge = (id, type, node) => {
        let storeType = store[type]
        if(storeType){
            storeType.merge(id, node)
        }else{
            storeType = new StoreType()
            storeType.set(id, node)
            store[type] = storeType
        }
    }

    const getState = () => {
        let printValue = {}
        for(let key of Object.keys(store)){
            const value = store[key]
            if(value){
                printValue[key] = value.getState()
            }
        }
        return printValue
    }

    return{
        clear,
        get,
        set,
        remove,
        getAbsolute,
        setAbsolute,
        removeAbsolute,
        merge,
        getState
    }
}

module.exports = InMemoryStore
