class StoreType{
    constructor(){
        this.store = new Map();
    }

    get = (key) => {
        return this.store.get(key)
    }

    set = (key, value) => {
        this.store.set(key, value)
    }

    delete = (key) => {
        this.store.delete(key)
    }

    merge = (key, value) => {
        const oldValue = this.store.get(key)
        this.store.set(key,  {...oldValue, ...value})
    }

    toString = () => {
        let printValue = {}
        for(let [key, value] of this.store){
            printValue[key] = value
        }
        return printValue
    }
}


class InMemoryStore{
    constructor(){
        this.store = new Map();
    }

    getAbsolute = (id) => {
        return this.store.get(id)
    }

    setAbsolute = (id, node) => {
        this.store.set(id, node)
    }

    deleteAbsolute = (id) => {
        this.store.delete(id)
    }

    get = (id, type, node) => {
        if(this.store.has(type)){
            const storeType = this.store.get(type)
            storeType.get(id)
        }
    }

    set = (id, type, node) => {
        if(this.store.has(type)){
            let storeType = this.store.get(type)
            storeType.set(id, node)
        }else{
            let storeType = new StoreType()
            storeType.set(id, node)
            this.store.set(type, storeType)
        }
    }

    delete = (node) => {

    }

    merge = (id, type, node) => {
        if(this.store.has(type)){
            let storeType = this.store.get(type)
            storeType.merge(id, node)
        }else{
            let storeType = new StoreType()
            storeType.set(id, node)
            this.store.set(type, storeType)
        }
    }

    toString = () => {
        let printValue = {}
        for(let [key, value] of this.store){
            printValue[key] = value.toString()
        }
        return printValue
    }
}

export default InMemoryStore
