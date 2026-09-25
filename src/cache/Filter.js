const compare = require('./Compare')
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

const aliases = {
    equalTo: '_eq', notEqualTo: '_neq', greaterThan: '_gt', lessThan: '_lt',
    greaterThanOrEqualTo: '_gte', lessThanOrEqualTo: '_lte', isNull: '_is_null',
    distinctFrom: '_is_distinct_from', notDistinctFrom: '_is_not_distinct_from'
}
const matchesField = (node, field, conditions, access = {}) => {
    const value = access.getValue ? access.getValue(node, field) : node[field]
    const type = access.getType && access.getType(node, field)
    if(conditions == null || typeof conditions !== 'object') return value === conditions
    for (let op in conditions) {
        const operator = aliases[op] || op
        const fn = fieldOperators[operator]
        if (!fn) {
            // A relationship filter uses the related node's field names.
            if(value && typeof value === 'object'){
                const nodes = Array.isArray(value) ? value : [value]
                if(op === 'some' || op === 'every' || op === 'none'){
                    const match = (item) => matchesWhere(item, conditions[op], access)
                    if(op === 'some' && !nodes.some(match)) return false
                    if(op === 'every' && !nodes.every(match)) return false
                    if(op === 'none' && nodes.some(match)) return false
                }else if(!nodes.some((item) => matchesWhere(item, {[op]: conditions[op]}, access))) return false
            }else if(access.isRelation && access.isRelation(node, field)) return false
            continue
        }
        const expected = conditions[op]
        if(type && ['_eq', '_neq', '_gt', '_lt', '_gte', '_lte'].includes(operator)){
            if(value == null || expected == null) return false
            if(!fn(compare(value, expected, type), 0)) return false
        }else if(!fn(value, expected)) return false
    }
    return true
}

const matchesWhere = (node, where, access = {}) => {
    if (!where) return true
    if(!node) return false
    for (let key in where) {
        if (key === '_and' || key === 'and') {
            if (!where[key].every((cond) => matchesWhere(node, cond, access))) return false
        } else if (key === '_or' || key === 'or') {
            if (!where[key].some((cond) => matchesWhere(node, cond, access))) return false
        } else if (key === '_not' || key === 'not') {
            if (matchesWhere(node, where[key], access)) return false
        } else {
            if (!matchesField(node, key, where[key], access)) return false
        }
    }
    return true
}

const applyWhere = (nodes, where, access) => {
    if (!where) return nodes
    return nodes.filter((node) => matchesWhere(node, where, access))
}

const matchesCondition = (node, condition) => {
    for (let field in condition) {
        const expected = condition[field]
        // Postgraphile omits null condition fields; treat them as "no filter".
        if (expected == null) continue
        // The discriminating field may not have been selected (so it is absent
        // from the cached node). We cannot evaluate it client-side, so we leave
        // the node in rather than dropping it - the server already filtered it.
        if (!(field in node)) continue
        if (node[field] !== expected) return false
    }
    return true
}

const applyCondition = (nodes, condition) => {
    if (!condition) return nodes
    return nodes.filter((node) => matchesCondition(node, condition))
}

const applyOrderBy = (nodes, orderBy, access = {}) => {
    if (!orderBy) return nodes
    const fields = ((orderBy instanceof Array) ? orderBy : [orderBy]).map((entry) => {
        if(typeof entry !== 'string') return entry
        const match = entry.match(/^(.+)_(ASC|DESC)$/)
        if(!match) return null
        const field = match[1].toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        return {[field]: match[2].toLowerCase()}
    }).filter(Boolean)
    if(!fields.length) return nodes
    // Queries may order by fields they don't select. Keep the server-provided
    // sequence when a sort key is unavailable instead of falling through to
    // later keys (or the id tie-breaker) and inventing a different order.
    const sortKeys = fields.flatMap((entry) => Object.keys(entry))
    if(nodes.some((node) => sortKeys.some((field) => node[field] === undefined))){
        return nodes
    }
    const keyOf = (node) => (access.getKey ? access.getKey(node) : node[UID])
    return [...nodes].sort((a, b) => {
        for (const entry of fields) {
            for (const field in entry) {
                const dir = entry[field]
                const aVal = a[field]
                const bVal = b[field]
                const result = compare(aVal, bVal, access.getType && access.getType(a, field))
                if(result) return dir === 'asc' ? result : -result
            }
        }
        if (keyOf(a) < keyOf(b)) return -1
        if (keyOf(a) > keyOf(b)) return 1
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
    matchesCondition,
    applyWhere,
    applyCondition,
    applyOrderBy,
    applySlice
}
