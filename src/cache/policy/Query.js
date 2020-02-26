function CacheByQuery({emitter, storage, typeMap}){
    const getName = () => 'query'

    const read = ({id, storage}) => {
        return storage.getAbsolute(id)
    }

    const write =  ({id, data}) => {
        return storage.setAbsolute(id, data)
    }

    return {
        read,
        write,
        getName
    }
}

module.exports = CacheByQuery
