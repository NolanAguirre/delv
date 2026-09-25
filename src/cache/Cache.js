const mockResult = require('../queryManager/MockResult')
const Enrichment = require('../queryManager/Enrichment')
const ReverseReferences = require('./ReverseReferences')
const MutationActions = require('./MutationActions')
const Journal = require('./Journal')
const Optimistic = require('./Optimistic')
const CacheHelpers = require('./CacheHelpers')
let UID = 'id'

function Cache({storage: baseStorage, cacheProcesses, typeMap, emitter}) {
    const storage = Journal(baseStorage)
    const layers = Optimistic({journal: storage, emitter})
    const process = Object.create(null)
    const enrichment = Enrichment(typeMap)
    const reverseReferences = ReverseReferences(typeMap)
    const mutationActions = MutationActions()

    cacheProcesses.forEach((ProcessClass) => {
        const policy = new ProcessClass({
            storage,
            typeMap,
            reverseReferences,
            mutationActions,
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

    const helpers = {
        ...CacheHelpers({
            storage,
            emitter,
            typeMap,
            policy: Object.values(process).find((policy) => policy.writeEntity)
        }),
        typeMap
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

    const applyOptimistic = (id, fn, context = {}) => {
        layers.apply(id, fn, {...helpers, ...context})
    }

    const clear = () => {
        layers.clear()
        storage.clear()
        enrichment.clear()
    }

    const subscribe = (callback) => {
        const id = '_' + Math.random().toString(36).substr(2, 9)
        emitter.on(id, callback)
        return () => emitter.off(id)
    }

    const getQueryTypes = (query) => {
        if(typeMap && typeMap.getTypes){
            return typeMap.getTypes(enrichment.prepare({query}).query)
        }
        return []
    }

    const toString = () => {
        let printValue = {
            storage:storage.toString()
        }
        return printValue
    }

    return {
        configureReverseReferences: reverseReferences.configure,
        configureMutationActions: mutationActions.configure,
        getSchemaIssues: () => typeMap.isNetworkGenerated ? reverseReferences.issues() : [],
        inspect: () => storage.inspect ? storage.inspect() : storage.toString(),
        prepareQuery: enrichment.prepare,
        getMockResult: (options) => mockResult(typeMap, options),
        read,
        write,
        applyOptimistic,
        rollbackOptimistic: layers.rollback,
        discardOptimistic: layers.discard,
        batch: emitter.batch,
        helpers: () => helpers,
        clear,
        subscribe,
        getQueryTypes,
        toString
    }
}

module.exports = Cache
