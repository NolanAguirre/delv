// Entity-level cache access for optimistic/update hooks and app code.
// `cache` touches exactly one stored entity; `cacheByType` writes like a
// mutation payload (normalization, reverse references, list membership).
const CacheHelpers = ({storage, emitter, typeMap, policy}) => {
    const keyOf = (type) => typeMap && typeMap.getKey ? typeMap.getKey(type) : 'id'

    const coerceId = (type, id) => {
        if(typeof id !== 'string' || !/^-?\d+$/.test(id) || !typeMap || !typeMap.getFieldType){
            return id
        }
        const signature = typeMap.getFieldType(type, keyOf(type))
        return typeof signature === 'string' && signature.replace(/[[\]!]/g, '') === 'Int' ? Number(id) : id
    }

    // 'Type.id' splits at the first '.', so ids may themselves contain dots.
    const parseRef = (ref, id) => {
        if(id !== undefined){
            return {type: ref, id: coerceId(ref, id)}
        }
        const index = typeof ref === 'string' ? ref.indexOf('.') : -1
        if(index <= 0 || index === ref.length - 1){
            throw new Error(`delv cache: expected a "Type.id" reference, got ${JSON.stringify(ref)}`)
        }
        const type = ref.slice(0, index)
        return {type, id: coerceId(type, ref.slice(index + 1))}
    }

    const readEntity = ({type, id}) => {
        const bucket = storage.get(type)
        const entity = bucket ? bucket.get(id) : undefined
        return entity == null ? undefined : entity
    }

    const read = (ref, id) => readEntity(parseRef(ref, id))

    const change = (fn) => emitter.batch(fn)

    const mergeRaw = ({type, id}, values) => {
        storage.merge(id, type, {...values, __typename: type, [keyOf(type)]: id})
        emitter.updateType(type)
        return true
    }

    const cache = {
        read,
        write: (ref, values = {}) => {
            const target = parseRef(ref)
            return change(() => mergeRaw(target, values))
        },
        update: (ref, values = {}) => {
            const target = parseRef(ref)
            return change(() => readEntity(target) === undefined ? false : mergeRaw(target, values))
        },
        delete: (ref, id) => {
            const target = parseRef(ref, id)
            return change(() => {
                storage.evict(target.id, target.type)
                emitter.updateType(target.type)
                return true
            })
        }
    }

    const writeEntity = (action, target, values) => {
        if(!policy){
            throw new Error('delv cache: cacheByType requires the "type" cache process')
        }
        return change(() => policy.writeEntity({action, ...target, values}))
    }

    const cacheByType = {
        read,
        write: (ref, values = {}) => writeEntity('create', parseRef(ref), values),
        update: (ref, values = {}) => writeEntity('update', parseRef(ref), values),
        delete: (ref, id) => writeEntity('delete', parseRef(ref, id))
    }

    return {cache, cacheByType}
}

module.exports = CacheHelpers
