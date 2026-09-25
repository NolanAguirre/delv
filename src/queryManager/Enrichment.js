const {parse, print, valueFromASTUntyped} = require('graphql')

// One instance per cache: mutation selections inherit fields required by queries.
const Enrichment = (typeMap) => {
    const requirements = new Map()
    const relationDepths = new Map()
    const fieldsOf = (type) => typeMap && typeMap.getFields ? typeMap.getFields(type) : {}
    const outputType = (type, name) => fieldsOf(type)[name]
        || (['nodes', 'edges', 'node'].includes(name) ? type : undefined)
    const nodeType = (type) => fieldsOf(type).nodes
        || (fieldsOf(type).edges && fieldsOf(fieldsOf(type).edges).node) || type
    const isObject = (type) => Object.keys(fieldsOf(type)).length > 0
    const requireField = (type, field) => {
        if(typeMap.canSelectField && !typeMap.canSelectField(type, field)) return
        if(!requirements.has(type)) requirements.set(type, new Set())
        requirements.get(type).add(field)
    }
    const collect = (type, value, ordering = false, trail = []) => {
        type = nodeType(type)
        if(Array.isArray(value)) return value.forEach((item) => collect(type, item, ordering, trail))
        if(ordering && typeof value === 'string'){
            const match = value.match(/^(.+)_(ASC|DESC)(?:_NULLS_(?:FIRST|LAST))?$/)
            if(match){
                const field = match[1].toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase())
                if(fieldsOf(type)[field]) requireField(type, field)
            }
        }
        if(!value || typeof value !== 'object') return
        for(const [key, child] of Object.entries(value)){
            const fieldType = fieldsOf(type)[key]
            if(fieldType){
                requireField(type, key)
                if(isObject(fieldType)){
                    const edge = `${type}:${key}`
                    const depth = trail.filter((item) => item === edge).length + 1
                    relationDepths.set(edge, Math.max(relationDepths.get(edge) || 0, depth))
                    collect(fieldType, child, ordering, [...trail, edge])
                }
            }else{
                // Input wrappers/operators are not output fields. Recurse at
                // the same node type, including and/or arrays and variables.
                collect(type, child, ordering || key === 'orderBy' || key === 'order_by', trail)
            }
        }
    }
    const prepare = ({query, variables = {}}) => {
        if(!typeMap || !typeMap.getFields) return {query, normalize: (data) => data, project: (data) => data}
        const document = parse(query)
        const fragments = new Map(document.definitions.filter((d) => d.kind === 'FragmentDefinition').map((d) => [d.name.value, d]))
        const operation = document.definitions.find((d) => d.kind === 'OperationDefinition')
        if(!operation) throw new Error('delv: expected a GraphQL operation')
        const values = {...variables}
        for(const variable of operation.variableDefinitions || []){
            const name = variable.variable.name.value
            if(values[name] === undefined && variable.defaultValue) values[name] = valueFromASTUntyped(variable.defaultValue)
        }
        const enabled = (selection) => (selection.directives || []).every((directive) => {
            const value = directive.arguments.find((arg) => arg.name.value === 'if')
            const flag = value && valueFromASTUntyped(value.value, values)
            return directive.name.value === 'skip' ? !flag : directive.name.value === 'include' ? flag : true
        })
        const expand = (set, stack = []) => ({...set, selections: set.selections.map((selection) => {
            if(selection.kind === 'FragmentSpread'){
                const name = selection.name.value
                if(stack.includes(name) || !fragments.has(name)) throw new Error(`delv: invalid fragment ${name}`)
                const fragment = fragments.get(name)
                return {kind: 'InlineFragment', typeCondition: fragment.typeCondition,
                    directives: selection.directives, selectionSet: expand(fragment.selectionSet, [...stack, name])}
            }
            return selection.selectionSet ? {...selection, selectionSet: expand(selection.selectionSet, stack)} : selection
        })})
        const original = expand(operation.selectionSet)
        const rootType = operation.operation === 'mutation' ? 'Mutation' : 'Query'
        const gather = (set, type) => {
            for(const selection of set.selections){
                if(!enabled(selection)) continue
                if(selection.kind === 'InlineFragment'){
                    gather(selection.selectionSet, selection.typeCondition ? selection.typeCondition.name.value : type)
                }else if(selection.selectionSet){
                    const childType = outputType(type, selection.name.value)
                    collect(childType, Object.fromEntries((selection.arguments || []).map((arg) => [arg.name.value, valueFromASTUntyped(arg.value, values)])))
                    gather(selection.selectionSet, childType)
                }
            }
        }
        gather(original, rootType)
        let aliasId = 0
        const field = (name, selectionSet) => ({kind: 'Field', name: {kind: 'Name', value: name}, ...(selectionSet ? {selectionSet} : {})})
        const inject = (set, type, path = [], edges = []) => {
            const selections = set.selections.map((selection) => {
                if(selection.kind === 'InlineFragment') return {...selection, selectionSet: inject(selection.selectionSet, selection.typeCondition ? selection.typeCondition.name.value : type, path, edges)}
                if(!selection.selectionSet) return selection
                return {...selection, selectionSet: inject(selection.selectionSet, outputType(type, selection.name.value), [...path, type], [...edges, `${type}:${selection.name.value}`])}
            })
            // Legacy relationship maps flatten connection wrappers to the node
            // type. Do not place node fields on those wrapper selections.
            const legacyWrapper = !fieldsOf(type).nodes && !fieldsOf(type).edges && set.selections.some((s) =>
                s.kind === 'Field' && ['nodes', 'edges', 'node'].includes(s.name.value))
            if(legacyWrapper) return {...set, selections}
            const needed = new Set(requirements.get(type) || [])
            // An injected relation must be normalizable even if the caller only
            // selected its display fields, or did not select the relation at all.
            if(path.length) needed.add('__typename')
            const key = typeMap.getKey ? typeMap.getKey(type) : 'id'
            if(fieldsOf(type)[key]) needed.add(key)
            const effectiveFields = (items, unconditional = false) => items.flatMap((s) => {
                if(unconditional && (s.directives || []).length) return []
                if(s.kind === 'Field') return [s]
                if(s.kind === 'InlineFragment' && (!unconditional || !s.typeCondition || s.typeCondition.name.value === type)){
                    return effectiveFields(s.selectionSet.selections, unconditional)
                }
                return []
            })
            const add = (name, childSet) => {
                if(effectiveFields(selections, true).some((s) => s.name.value === name && (name !== '__typename' || !s.alias))) return
                const next = field(name, childSet)
                if(effectiveFields(selections).some((s) => s.name.value !== name && (s.alias || s.name).value === name)){
                    let alias
                    do { alias = `__delv_${aliasId++}` } while(effectiveFields(selections).some((s) => (s.alias || s.name).value === alias))
                    next.alias = {kind: 'Name', value: alias}
                }
                selections.push(next)
            }
            // Connection arguments apply to nodes, not connection metadata.
            if(nodeType(type) !== type && requirements.has(nodeType(type))){
                const wrapper = fieldsOf(type).nodes ? 'nodes' : 'edges'
                needed.add(wrapper)
            }
            if(fieldsOf(type).node && requirements.has(fieldsOf(type).node)) needed.add('node')
            for(const name of needed){
                const childType = outputType(type, name)
                if(isObject(childType)){
                    const edge = `${type}:${name}`
                    if(edges.filter((item) => item === edge).length >= (relationDepths.get(edge) || 1)) continue
                    const childSet = inject({kind: 'SelectionSet', selections: []}, childType, [...path, type], [...edges, edge])
                    if(childSet.selections.length) add(name, childSet)
                }else add(name)
            }
            return {...set, selections}
        }
        const enriched = inject(original, rootType)
        const merge = (left, right) => {
            if(Array.isArray(left) && Array.isArray(right)) return right.map((item, i) => merge(left[i], item))
            if(left && right && typeof left === 'object' && typeof right === 'object'){
                const result = {...left}
                for(const key of Object.keys(right)) result[key] = merge(left[key], right[key])
                return result
            }
            return right
        }
        const mapResult = (data, set, canonical) => {
            if(data == null) return data
            if(Array.isArray(data)) return data.map((item) => mapResult(item, set, canonical))
            const result = canonical && data.__typename ? {__typename: data.__typename} : {}
            for(const selection of set.selections){
                if(!enabled(selection)) continue
                if(selection.kind === 'InlineFragment'){
                    const condition = selection.typeCondition && selection.typeCondition.name.value
                    if(!condition || !data.__typename || data.__typename === condition || (typeMap.getPossibleTypes && typeMap.getPossibleTypes(condition).includes(data.__typename))){
                        const fragmentData = mapResult(data, selection.selectionSet, canonical)
                        for(const key of Object.keys(fragmentData)) result[key] = merge(result[key], fragmentData[key])
                    }
                    continue
                }
                const key = (selection.alias || selection.name).value
                if(!Object.prototype.hasOwnProperty.call(data, key)) continue
                const value = selection.selectionSet ? mapResult(data[key], selection.selectionSet, canonical) : data[key]
                const target = canonical ? selection.name.value : key
                result[target] = merge(result[target], value)
            }
            return result
        }
        return {
            query: print({...document, definitions: [{...operation, selectionSet: enriched}]}),
            normalize: (data) => mapResult(data, enriched, true),
            project: (data) => mapResult(data, original, false)
        }
    }
    return {prepare, clear: () => { requirements.clear(); relationDepths.clear() }}
}
module.exports = Enrichment
