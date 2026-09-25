// Copy diagnostic values so inspecting them cannot mutate application state.
const snapshot = (value, ancestors = new Set()) => {
    if(value === undefined) return '[undefined]'
    if(typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
    if(typeof value === 'bigint') return String(value)
    if(!value || typeof value !== 'object') return value
    if(ancestors.has(value)) return '[Circular]'
    if(value instanceof Error) return {name: value.name, message: value.message, stack: value.stack}
    const next = new Set(ancestors).add(value)
    if(Array.isArray(value)) return value.map(item => snapshot(item, next))
    const result = Object.create(null)
    Object.keys(value).forEach(key => {
        try { result[key] = snapshot(value[key], next) } catch(e) { result[key] = '[Unavailable]' }
    })
    return result
}

// An optional sidecar; the Delv core never imports this module.
const createDebugSidecar = ({maxEvents = 500} = {}) => {
    const limit = Number.isFinite(maxEvents) ? Math.max(1, Math.floor(maxEvents)) : 500
    let events = []
    let sequence = 0
    let readCache = () => ({})
    let disconnect = () => {}
    let enabled = true
    const listeners = new Set()
    const notify = () => listeners.forEach(listener => { try { listener() } catch(e) {} })
    const record = (kind, details) => {
        if(!enabled) return
        events = [...events, {id: ++sequence, time: Date.now(), kind, ...snapshot(details)}].slice(-limit)
        notify()
    }
    const operation = kind => input => {
        if(!enabled) return
        const started = Date.now()
        const operationId = ++sequence
        record(`${kind}.start`, {operationId, input})
        return {
            success: result => record(`${kind}.success`, {operationId, duration: Date.now() - started, result}),
            error: error => record(`${kind}.error`, {operationId, duration: Date.now() - started, error})
        }
    }
    return {
        connect: ({inspectCache, subscribe}) => {
            disconnect()
            readCache = inspectCache
            enabled = true
            disconnect = subscribe(types => { try { record('cache.types', {types}) } catch(error) {} }) || (() => {})
        },
        onCacheRead: operation('cache.read'),
        onCacheWrite: operation('cache.write'),
        onCacheClear: operation('cache.clear'),
        onNetworkRequest: operation('network.request'),
        getEvents: () => snapshot(events),
        inspectCache: () => snapshot(readCache()),
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
        clear: () => { events = []; notify() },
        dispose: () => {
            enabled = false
            disconnect()
            disconnect = () => {}
            readCache = () => ({})
            events = []
            notify()
            listeners.clear()
        }
    }
}
module.exports = createDebugSidecar
