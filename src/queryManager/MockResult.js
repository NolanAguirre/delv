const {parse, parseType, valueFromASTUntyped} = require('graphql')

// Presentation-only data: never normalize or write these values to the cache.
module.exports = (typeMap, {query, variables = {}}) => {
    if(!typeMap || !typeMap.getFieldType) throw new Error('delv: mock loading requires a TypeMap with field metadata')
    const document = typeof query === 'string' ? parse(query) : query
    const operations = document.definitions.filter((definition) => definition.kind === 'OperationDefinition')
    if(operations.length !== 1) throw new Error('delv: mock loading expects one GraphQL operation')
    const operation = operations[0]
    const fragments = new Map(document.definitions.filter((definition) => definition.kind === 'FragmentDefinition').map((fragment) => [fragment.name.value, fragment]))
    const values = {...variables}
    for(const variable of operation.variableDefinitions || []){
        const name = variable.variable.name.value
        if(values[name] === undefined && variable.defaultValue) values[name] = valueFromASTUntyped(variable.defaultValue)
    }
    const enabled = (selection) => (selection.directives || []).every((directive) => {
        const argument = (directive.arguments || []).find((arg) => arg.name.value === 'if')
        const flag = argument && valueFromASTUntyped(argument.value, values)
        return directive.name.value === 'skip' ? !flag : directive.name.value === 'include' ? !!flag : true
    })
    const possible = (type) => typeMap.getPossibleTypes ? typeMap.getPossibleTypes(type) : []
    const matches = (condition, type) => !condition || condition === type || possible(condition).includes(type)
    const merge = (left, right) => {
        if(Array.isArray(left) && Array.isArray(right)) return right.map((item, index) => merge(left[index], item))
        if(left && right && typeof left === 'object' && typeof right === 'object'){
            const result = {...left}
            for(const key of Object.keys(right)) result[key] = merge(result[key], right[key])
            return result
        }
        return right
    }
    const scalar = (type) => {
        const enums = typeMap.getEnumValues ? typeMap.getEnumValues(type) : []
        if(enums.length) return enums[0]
        if(type === 'Boolean') return false
        if(['Int', 'Float', 'BigInt', 'BigFloat', 'Decimal'].includes(type)) return 0
        return 'Loading'
    }
    const buildType = (reference, selectionSet, stack) => {
        if(reference.kind === 'NonNullType') return buildType(reference.type, selectionSet, stack)
        if(reference.kind === 'ListType') return [buildType(reference.type, selectionSet, stack)]
        return selectionSet ? walk(selectionSet, reference.name.value, stack) : scalar(reference.name.value)
    }
    const walk = (selectionSet, declaredType, stack = []) => {
        const type = possible(declaredType)[0] || declaredType
        let result = {}
        for(const selection of selectionSet.selections){
            if(!enabled(selection)) continue
            if(selection.kind !== 'Field'){
                let fragment = selection
                let nextStack = stack
                if(selection.kind === 'FragmentSpread'){
                    const name = selection.name.value
                    if(stack.includes(name) || !fragments.has(name)) throw new Error(`delv: invalid fragment ${name}`)
                    fragment = fragments.get(name)
                    nextStack = [...stack, name]
                }
                if(matches(fragment.typeCondition && fragment.typeCondition.name.value, type)){
                    result = merge(result, walk(fragment.selectionSet, type, nextStack))
                }
                continue
            }
            const field = selection.name.value
            const key = (selection.alias || selection.name).value
            if(field === '__typename'){
                result[key] = type
                continue
            }
            const signature = typeMap.getFieldType(type, field) || typeMap.getFieldType(declaredType, field)
            if(!signature) throw new Error(`delv: mock loading is missing the type for ${type}.${field}; regenerate the type map or supply fields metadata`)
            result[key] = merge(result[key], buildType(parseType(signature), selection.selectionSet, stack))
        }
        return result
    }
    return walk(operation.selectionSet, operation.operation === 'mutation' ? 'Mutation' : 'Query')
}
