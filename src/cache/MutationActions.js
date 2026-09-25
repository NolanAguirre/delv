const ACTIONS = ['create', 'update', 'delete', 'query']

module.exports = () => {
    let overrides = {}
    const configure = value => {
        const next = value || {}
        for(const field of Object.keys(next)){
            if(!ACTIONS.includes(next[field])){
                throw new Error(`Unknown mutation action: "${next[field]}" for "${field}"`)
            }
        }
        overrides = next
    }
    const resolve = fieldName => (
        Object.prototype.hasOwnProperty.call(overrides, fieldName) ? overrides[fieldName] : undefined
    )
    return {
        configure,
        resolve
    }
}
