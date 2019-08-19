
const read = ({id, storage}) => {
    return storage.getAbsolute(id)
}

const write = ({id, data, storage}) => {
    return storage.setAbsolute(id, data)
}

export default {
    name:'query',
    read,
    write
}
