// Optional hook dispatch only: observers own timing, retention, and presentation.
const call = (target, method, ...args) => {
    try { return target && typeof target[method] === 'function' ? target[method](...args) : undefined }
    catch(error) { /* Observer failures must not affect application operations. */ }
}

const observe = (target, hooks, methods) => {
    if(!hooks) return target
    return new Proxy(target, {
        get(object, key) {
            const original = object[key]
            if(typeof original !== 'function') return original
            if(!Object.prototype.hasOwnProperty.call(methods, key)) return original.bind(object)
            return (...args) => {
                const observer = call(hooks, methods[key], args[0])
                try {
                    const result = original.apply(object, args)
                    if(result && typeof result.then === 'function'){
                        return result.then(value => { call(observer, 'success', value); return value }, error => {
                            call(observer, 'error', error)
                            throw error
                        })
                    }
                    call(observer, 'success', result)
                    return result
                } catch(error) {
                    call(observer, 'error', error)
                    throw error
                }
            }
        }
    })
}
module.exports = {observe, call}
