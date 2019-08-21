let UID = 'id'

class Cache {
    constructor({storage, cachePolicies, typeMap, emitter}) {
        this.storage = storage
        this.loadPolicies(cachePolicies)
        this.typeMap = typeMap
        this.emitter = emitter
    }

    loadPolicies = (policies) => {
        this.policies = Object.create(null)
        policies.forEach(process => {
            this.policies[process.name] = {
                read:process.read,
                write:process.write
            }
        })

    }

    read = ({cachePolicy, ...other}) => {
        return this.policies[cachePolicy].read({
            ...other,
            storage:this.storage,
            emitter:this.emitter,
            typeMap:this.typeMap
        })
    }

    write = ({cachePolicy, ...other}) => {
        this.policies[cachePolicy].write({
            ...other,
            storage:this.storage,
            emitter:this.emitter,
            typeMap:this.typeMap
        })
    }

    clear = () => {
        this.storage.clear()
    }


    toString = () => {
        let printValue = {
            storage:this.storage.toString()
        }
        return printValue
    }
}

export default Cache
