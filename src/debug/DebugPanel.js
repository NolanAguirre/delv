import React, {useEffect, useState} from 'react'

const colors = {background: '#10151f', color: '#dce4f2', border: '1px solid #344054'}
const button = {...colors, borderRadius: 5, padding: '5px 9px', font: 'inherit', cursor: 'pointer'}
const Tree = ({value, label = 'value'}) => {
    if(value && typeof value === 'object'){
        const entries = Object.entries(value)
        return <details style={{paddingLeft: 12}}>
            <summary style={{cursor: 'pointer', padding: '3px 0'}}>{label} <span style={{color: '#8e9db5'}}>({entries.length})</span></summary>
            {entries.map(([key, child]) => <Tree key={key} label={key} value={child} />)}
        </details>
    }
    return <div style={{padding: '3px 0 3px 12', overflowWrap: 'anywhere'}}><span style={{color: '#94b9ff'}}>{label}: </span>{String(value)}</div>
}

const read = sidecar => {
    try { return {events: sidecar.getEvents(), cache: sidecar.inspectCache()} }
    catch(error) { return {events: sidecar.getEvents(), cache: {error: error.message}} }
}

// UI subscribes to the sidecar, never to the Delv client.
const DelvDebugPanel = ({sidecar, enabled = false, defaultOpen = false, side = 'right'}) => {
    const [open, setOpen] = useState(defaultOpen)
    const [tab, setTab] = useState('events')
    const [paused, setPaused] = useState(false)
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [view, setView] = useState({events: [], cache: {}})
    useEffect(() => {
        if(!enabled || !sidecar || paused) return undefined
        let timer
        const refresh = () => {
            // Batch bursts of cache events without rendering during application reads.
            if(timer === undefined) timer = setTimeout(() => { timer = undefined; setView(read(sidecar)) }, 50)
        }
        const unsubscribe = sidecar.subscribe(refresh)
        setView(read(sidecar))
        return () => { unsubscribe(); clearTimeout(timer) }
    }, [sidecar, enabled, paused])
    if(!enabled || !sidecar) return null
    const position = {position: 'fixed', bottom: 16, [side === 'left' ? 'left' : 'right']: 16, zIndex: 2147483646, font: '12px/1.5 ui-monospace, monospace'}
    if(!open) return <button type="button" style={{...button, ...position}} onClick={() => setOpen(true)}>delv · debug</button>
    const matching = view.events.filter(event => (filter === 'all' || event.kind.startsWith(filter)) && JSON.stringify(event).toLowerCase().includes(search.toLowerCase()))
    const buckets = Object.entries(view.cache || {}).filter(([key, value]) => `${key} ${JSON.stringify(value)}`.toLowerCase().includes(search.toLowerCase()))
    return <section aria-label="Delv debug panel" style={{...colors, ...position, width: 600, height: 460, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', minWidth: 260, minHeight: 200, resize: 'both', overflow: 'hidden', borderRadius: 10, boxShadow: '0 16px 60px #0008', display: 'flex', flexDirection: 'column', textAlign: 'left'}}>
        <header style={{display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderBottom: colors.border}}>
            <strong style={{flex: 1}}>delv <span style={{color: '#8392aa', fontWeight: 400}}>/ internals</span></strong>
            <span style={{color: paused ? '#f5cc7a' : '#78ddb0'}}>{paused ? 'Paused view' : 'Live'}</span>
            <button type="button" style={button} aria-label="Collapse debug panel" onClick={() => setOpen(false)}>Collapse</button>
        </header>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px'}}>
            <button type="button" style={button} aria-pressed={tab === 'events'} onClick={() => setTab('events')}>Events ({view.events.length})</button>
            <button type="button" style={button} aria-pressed={tab === 'cache'} onClick={() => setTab('cache')}>Cache</button>
            <button type="button" style={button} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause view'}</button>
            <button type="button" style={button} onClick={() => { sidecar.clear(); setView(read(sidecar)) }}>Clear logs</button>
            <button type="button" style={button} onClick={() => setView(read(sidecar))}>Refresh</button>
        </div>
        <div style={{display: 'flex', gap: 8, padding: '0 12px 10px'}}>
            <input aria-label="Search debug data" placeholder="Search query, type, variables, result…" value={search} onChange={event => setSearch(event.target.value)} style={{...button, minWidth: 0, flex: 1, cursor: 'text'}} />
            {tab === 'events' && <select aria-label="Event category" value={filter} onChange={event => setFilter(event.target.value)} style={button}>
                <option value="all">All events</option><option value="cache.read">Cache reads</option><option value="cache.write">Cache writes</option><option value="network">Network</option><option value="cache.types">Type changes</option><option value="cache.clear">Cache clears</option>
            </select>}
        </div>
        <div style={{overflow: 'auto', flex: 1, padding: '0 12px 12px'}}>
            {tab === 'events' ? matching.length ? matching.slice().reverse().map(event => <details key={event.id} style={{borderTop: colors.border, padding: '7px 0'}}>
                <summary style={{cursor: 'pointer', color: event.kind.endsWith('.error') ? '#ff9898' : '#b7ceef'}}>
                    <span style={{color: '#8392aa'}}>{new Date(event.time).toLocaleTimeString()} </span>{event.kind}
                    {event.duration !== undefined && ` · ${event.duration}ms`}{event.types && ` · ${event.types.join(', ')}`}
                </summary>
                {Object.entries(event).filter(([key]) => !['time', 'kind', 'id'].includes(key)).map(([key, value]) => <Tree key={key} label={key} value={value} />)}
            </details>) : <p style={{color: '#8392aa'}}>No matching events. Run a query to see activity here.</p>
                : buckets.length ? buckets.map(([key, value]) => <Tree key={key} label={key} value={value} />) : <p style={{color: '#8392aa'}}>No cached entries match.</p>}
        </div>
        <footer style={{padding: '7px 12px', color: '#8392aa', borderTop: colors.border}}>Newest first · expand rows to inspect · {paused ? 'Recording continues while the view is paused' : 'Read-only cache inspection'}</footer>
    </section>
}
export {DelvDebugPanel}
export default DelvDebugPanel
