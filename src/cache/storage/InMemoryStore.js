function StoreType() {
    const store = Object.create(null)

    const get = (key) => store[key]

    const set = (key, node) => store[key] = node

    const remove = (key) => store[key] = null

    const del = (key) => { delete store[key] }

    const merge = (key, node) => {
        store[key] = {...store[key], ...node}
    }

    const getValues = () => Object.values(store)

    const toString = () => store
    return {
        get,
        set,
        remove,
        delete: del,
        merge,
        getValues,
        toString
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

    const removeAbsolute = (id) => { delete store[id] }

    const removeType = (type) => { delete store[type] }

    const evict = (id, type) => {
        const storeType = store[type]
        if(storeType && storeType.delete){
            storeType.delete(id)
        }
    }

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

    const toString = () => {
        let printValue = {}
        for(let key of Object.keys(store)){
            const value = store[key]
            if(value){
                printValue[key] = value.toString()
            }
        }
        return printValue
    }

    const inspect = () => {
        const result = Object.create(null)
        Object.keys(store).forEach(key => {
            const value = store[key]
            result[key] = value && typeof value.getValues === 'function' ? value.toString() : value
        })
        return result
    }

    return{
        inspect,
        clear,
        get,
        set,
        remove,
        getAbsolute,
        setAbsolute,
        removeAbsolute,
        removeType,
        evict,
        merge,
        toString
    }
}

module.exports = InMemoryStore
