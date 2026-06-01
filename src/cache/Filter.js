const UID = 'id'

const normalize = (v) => (v === undefined ? null : v)

const fieldOperators = {
    _eq: (a, b) => a != null && b != null && a === b,
    _neq: (a, b) => a != null && b != null && a !== b,
    _gt: (a, b) => a != null && a > b,
    _lt: (a, b) => a != null && a < b,
    _gte: (a, b) => a != null && a >= b,
    _lte: (a, b) => a != null && a <= b,
    _is_null: (a, flag) => (flag ? a == null : a != null),
    _is_distinct_from: (a, b) => normalize(a) !== normalize(b),
    _is_not_distinct_from: (a, b) => normalize(a) === normalize(b)
}

const matchesField = (node, field, conditions) => {
    for (let op in conditions) {
        const fn = fieldOperators[op]
        if (!fn) continue
        if (!fn(node[field], conditions[op])) return false
    }
    return true
}

const matchesWhere = (node, where) => {
    if (!where) return true
    for (let key in where) {
        if (key === '_and') {
            if (!where._and.every((cond) => matchesWhere(node, cond))) return false
        } else if (key === '_or') {
            if (!where._or.some((cond) => matchesWhere(node, cond))) return false
        } else if (key === '_not') {
            if (matchesWhere(node, where._not)) return false
        } else {
            if (!matchesField(node, key, where[key])) return false
        }
    }
    return true
}

const applyWhere = (nodes, where) => {
    if (!where) return nodes
    return nodes.filter((node) => matchesWhere(node, where))
}

const applyOrderBy = (nodes, orderBy) => {
    if (!orderBy) return nodes
    const fields = (orderBy instanceof Array) ? orderBy : [orderBy]
    return [...nodes].sort((a, b) => {
        for (const entry of fields) {
            for (const field in entry) {
                const dir = entry[field]
                const aVal = a[field]
                const bVal = b[field]
                if (aVal < bVal) return dir === 'asc' ? -1 : 1
                if (aVal > bVal) return dir === 'asc' ? 1 : -1
            }
        }
        if (a[UID] < b[UID]) return -1
        if (a[UID] > b[UID]) return 1
        return 0
    })
}

const applySlice = (nodes, first, offset) => {
    const start = offset || 0
    const end = (first != null) ? start + first : undefined
    return nodes.slice(start, end)
}

module.exports = {
    fieldOperators,
    matchesField,
    matchesWhere,
    applyWhere,
    applyOrderBy,
    applySlice
}
