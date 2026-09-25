// Records what each storage entry looked like before and after it was written
// while recording, so an optimistic write can be undone later without
// clobbering anything written since. Stored entities and membership arrays
// must be replaced rather than mutated in place.
const Journal = (storage) => {
    let log = null

    const readEntity = (id, type) => {
        const bucket = storage.get(type)
        const value = bucket ? bucket.get(id) : undefined
        return value == null ? undefined : value
    }

    const touchEntity = (id, type) => {
        if(!log) return
        let bucket = log.types.get(type)
        if(!bucket){
            bucket = {existed: storage.get(type) != null, entities: new Map()}
            log.types.set(type, bucket)
        }
        const key = String(id)
        if(!bucket.entities.has(key)){
            bucket.entities.set(key, {id, before: readEntity(id, type)})
        }
    }

    const touchAbsolute = (key) => {
        if(log && !log.absolutes.has(key)){
            log.absolutes.set(key, {before: storage.getAbsolute(key)})
        }
    }

    // Revert only the fields that still hold the recorded value; a field some
    // later write changed is newer data and is kept.
    const revertEntity = (id, type, {before, after}) => {
        const current = readEntity(id, type)
        if(current === after){
            if(before === undefined) storage.evict(id, type)
            else storage.set(id, type, before)
            return
        }
        if(current === undefined || before === undefined || after === undefined){
            return
        }
        const reverted = {...current}
        let changed = false
        for(let field of new Set([...Object.keys(before), ...Object.keys(after)])){
            if(after[field] !== before[field] && current[field] === after[field]){
                if(field in before) reverted[field] = before[field]
                else delete reverted[field]
                changed = true
            }
        }
        if(changed) storage.set(id, type, reverted)
    }

    const undo = (entries) => {
        entries.absolutes.forEach(({before, after}, key) => {
            if(storage.getAbsolute(key) !== after) return
            if(before === undefined) storage.removeAbsolute(key)
            else storage.setAbsolute(key, before)
        })
        entries.types.forEach(({existed, entities}, type) => {
            entities.forEach((entry) => revertEntity(entry.id, type, entry))
            const bucket = storage.get(type)
            if(!existed && storage.removeType && bucket && bucket.getValues && !bucket.getValues().length){
                storage.removeType(type)
            }
        })
        return [...entries.types.keys()]
    }

    // Returns an undo function that reverts what fn wrote and reports the
    // types it touched.
    const record = (fn) => {
        const previous = log
        const entries = {types: new Map(), absolutes: new Map()}
        log = entries
        try{
            fn()
        }finally{
            log = previous
            entries.absolutes.forEach((entry, key) => { entry.after = storage.getAbsolute(key) })
            entries.types.forEach(({entities}, type) => {
                entities.forEach((entry) => { entry.after = readEntity(entry.id, type) })
            })
        }
        return () => undo(entries)
    }

    const overrides = {
        record,
        isRecording: () => log !== null,
        merge: (id, type, node) => {
            touchEntity(id, type)
            return storage.merge(id, type, node)
        },
        set: (id, type, node) => {
            touchEntity(id, type)
            return storage.set(id, type, node)
        },
        evict: (id, type) => {
            touchEntity(id, type)
            return storage.evict(id, type)
        },
        setAbsolute: (key, value) => {
            touchAbsolute(key)
            return storage.setAbsolute(key, value)
        },
        removeAbsolute: (key) => {
            touchAbsolute(key)
            return storage.removeAbsolute(key)
        }
    }

    return new Proxy(storage, {
        get: (target, key) => {
            if(Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key]
            const value = target[key]
            return typeof value === 'function' ? value.bind(target) : value
        }
    })
}

module.exports = Journal
