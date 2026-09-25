// Relationship names identify references; target types alone do not identify inverses.
module.exports = (typeMap) => {
    let overrides = {}
    const definition = type => typeMap.getTypeDefinition(type) || {}
    const resolve = (type, field) => {
        const target = definition(type)[field]
        const candidates = Object.keys(definition(target)).filter(key => definition(target)[key] === type)
        const configured = overrides[type] && Object.prototype.hasOwnProperty.call(overrides[type], field)
        if(configured){
            const inverse = overrides[type][field]
            if(inverse === null) return {inverse: null}
            if(typeof inverse === 'string' && candidates.includes(inverse)) return {inverse}
            return {type, field, target, candidates, reason: 'Configured inverse must be a field pointing back to this type, or null.'}
        }
        const siblings = Object.keys(definition(type)).filter(key => definition(type)[key] === target)
        if(type === target || candidates.length > 1 || (candidates.length && siblings.length > 1)){
            return {type, field, target, candidates, reason: 'The inverse cannot be determined safely from the target type.'}
        }
        return {inverse: candidates[0] || null}
    }
    const issues = () => {
        const map = typeMap.toString()
        const result = []
        for(const type of Object.keys(map)){
            if(type === 'Query' || type.startsWith('__')) continue
            for(const field of Object.keys(definition(type))){
                const resolution = resolve(type, field)
                if(resolution.reason) result.push(resolution)
            }
        }
        for(const type of Object.keys(overrides)){
            for(const field of Object.keys(overrides[type] || {})){
                if(!definition(type)[field]) result.push({type, field, candidates: [], reason: 'Configured source field does not exist in the relationship map.'})
            }
        }
        return result
    }
    return {
        configure: value => { overrides = value || {} },
        resolve,
        issues,
        isCollection: (type, field) => {
            const map = typeMap.toString()
            const metadata = (map.__fieldTypes || {})[type] || (map.__fields || {})[type] || {}
            const signature = metadata[field]
            if(!signature) return undefined
            return signature.includes('[') || /Connection!?$/.test(signature)
        }
    }
}
