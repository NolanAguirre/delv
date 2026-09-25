const graphql = require('graphql-anywhere').default
const {parse} = require('graphql')
const queryKey = require('../queryManager/QueryKey')

// Counts are server snapshots, not the number of entities in a cached page.
const prefix = '@@delv/counts:'
module.exports = (storage, keyOf = () => 'id') => {
    const fieldKey = (owner, field, args) => JSON.stringify([
        owner && owner.__typename || 'Query', owner && owner[keyOf(owner.__typename)], field,
        queryKey('{ count }', args)
    ])
    return {
        write: ({query, variables, data, selectionQuery = query}) => {
            if(!query) return
            const counts = {}
            const owners = new WeakMap()
            const resolver = (field, root, args, context, info) => {
                if(root == null) return null
                const value = root[info.resultKey]
                if(field === 'totalCount' && typeof value === 'number' && owners.has(root)){
                    counts[owners.get(root)] = value
                }
                if(value && typeof value === 'object' && !Array.isArray(value)){
                    owners.set(value, fieldKey(root === data ? null : root, field, args))
                }
                return value
            }
            graphql(resolver, parse(selectionQuery), data, {}, variables)
            storage.setAbsolute(prefix + queryKey(query, variables), counts)
        },
        read: ({query, variables}, owner, field, args) => {
            const counts = storage.getAbsolute(prefix + queryKey(query, variables))
            const count = counts && counts[fieldKey(owner, field, args)]
            return count === undefined ? {} : {totalCount: count}
        }
    }
}
