class StoreType{
    constructor(){
        this.store = Object.create(null)
    }

    get = (key) => this.store[key]

    set = (key, node) => this.store[key] = node

    delete = (key) => this.store[key] = null

    merge = (key, node) => this.store[key] = {...this.store[key], ...node}

    getValues = () => Object.values(this.store)

    toString = () => this.store
}


class InMemoryStore{
    constructor(){
        this.store = Object.create(null)
    }

    clear = () => this.store = Object.create(null)

    getAbsolute = (id) => this.store[id]

    setAbsolute = (id, node) => this.store[id] = node

    deleteAbsolute = (id) => this.store.delete(id)

    get = (type) => {
        return this.store[type]
    }

    set = (id, type, node) => {
        let storeType = this.store[type]
        if(storeType){
            storeType.set(id, node)
        }else{
            storeType = new StoreType()
            storeType.set(id, node)
            this.store[type] = storeType
        }
    }

    delete = (node) => {

    }

    merge = (id, type, node) => {
        let storeType = this.store[type]
        if(storeType){
            storeType.merge(id, node)
        }else{
            storeType = new StoreType()
            storeType.set(id, node)
            this.store[type] = storeType
        }
    }

    toString = () => {
        let printValue = {}
        for(let key in this.store){
            const value = this.store[key]
            if(value){
                printValue[key] = value.toString()
            }
        }
        return printValue
    }
}

export default InMemoryStore
