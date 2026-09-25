import React, {createContext, useCallback, useContext, useEffect, useRef, useState, useMemo} from 'react'

const DelvContext = createContext(null)

const SchemaIssues = ({issues}) => {
    const config = {}
    issues.forEach(({type, field, target}) => {
        if(!target) return
        if(!config[type]) config[type] = {}
        config[type][field] = null
    })
    return <main role='alert' style={{padding: '2rem', maxWidth: '60rem', margin: '0 auto'}}>
        <h1>Delv needs relationship configuration</h1>
        <p>The fetched schema contains relationships whose reverse references need an explicit choice.
            Add reverseReferences to Delv configuration, then recreate the client.</p>
        <ul>{issues.map(({type, field, target, candidates, reason}) => <li key={`${type}.${field}`}>
            <strong>{type}.{field}</strong>{target ? ` → ${target}` : ''}: {reason}
            {candidates.length > 0 && <span> Choose an inverse field on {target}: {candidates.join(', ')}.</span>}
        </li>)}</ul>
        <p>Each entry controls one direction. Use an inverse field name to maintain that back-reference,
            or null to disable inference for that field. For computed fields such as lineage, use null
            unless you have a known inverse. Remove entries for source fields that do not exist.</p>
        <p>This configuration disables inference for the listed fields. Replace null with the correct
            inverse field name wherever you want automatic back-references:</p>
        <pre style={{overflowX: 'auto'}}>{`Delv({
  // ...existing configuration,
  reverseReferences: ${JSON.stringify(config, null, 2).replace(/\n/g, '\n  ')}
})`}</pre>
    </main>
}

const DelvProvider = ({client, children, loading = <div role='status'>Loading…</div>, error: errorFallback}) => {
    const pending = client && typeof client.then === 'function'
    const [initialization, setInitialization] = useState(null)

    useEffect(() => {
        if(!pending) return
        let active = true
        Promise.resolve(client).then(
            (resolvedClient) => {
                if(active) setInitialization({source: client, client: resolvedClient, failed: false})
            },
            (error) => {
                if(active) setInitialization({source: client, error, failed: true})
            }
        )
        return () => { active = false }
    }, [client, pending])

    if(pending){
        if(!initialization || initialization.source !== client) return loading
        if(initialization.failed){
            if(errorFallback !== undefined){
                return typeof errorFallback === 'function' ? errorFallback(initialization.error) : errorFallback
            }
            return <div role='alert'>Unable to initialize Delv.</div>
        }
    }

    const resolvedClient = pending ? initialization.client : client
    const issues = resolvedClient && resolvedClient.getSchemaIssues ? resolvedClient.getSchemaIssues() : []
    if(issues.length) return <SchemaIssues issues={issues} />
    return <DelvContext.Provider value={resolvedClient}>{children}</DelvContext.Provider>
}

const useDelv = () => useContext(DelvContext)

const sameData = (a, b) => {
    try{
        return JSON.stringify(a) === JSON.stringify(b)
    }catch(e){
        return false
    }
}

const useQuery = ({query, variables, networkPolicy, cacheProcess, skip, onFetch, onResolve, onError} = {}, clientOverride) => {
    const contextClient = useDelv()
    const client = clientOverride || contextClient
    if(!client){
        throw new Error('delv-react: no Delv client found. Wrap the tree in <DelvProvider client={delv}> or pass a client to useQuery.')
    }

    const variablesKey = variables ? JSON.stringify(variables) : ''
    const initialState = () => {
        const data = !skip && client.getCachedResult
            ? client.getCachedResult({query, variables, networkPolicy, cacheProcess}) : undefined
        return {loading: !skip && data === undefined, data, error: undefined}
    }
    const [state, setState] = useState(initialState)
    const [identity, setIdentity] = useState({client, query, variablesKey, networkPolicy, cacheProcess, skip})
    let renderedState = state
    if(identity.client !== client || identity.query !== query || identity.variablesKey !== variablesKey ||
        identity.networkPolicy !== networkPolicy || identity.cacheProcess !== cacheProcess || identity.skip !== skip){
        renderedState = initialState()
        setIdentity({client, query, variablesKey, networkPolicy, cacheProcess, skip})
        setState(renderedState)
    }

    const mountedRef = useRef(true)
    const requestRef = useRef(0)
    const callbacksRef = useRef({onFetch, onResolve, onError})
    callbacksRef.current = {onFetch, onResolve, onError}

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    const execute = useCallback((request) => {
        const requestId = requestRef.current + 1
        requestRef.current = requestId
        const snapshot = initialState()
        setState(snapshot)
        const callbacks = callbacksRef.current
        if(snapshot.data !== undefined && callbacks.onResolve) callbacks.onResolve(snapshot.data)
        const promise = request()
        const result = promise
            .then((data) => {
                if(mountedRef.current && requestRef.current === requestId){
                    setState({loading: false, data, error: undefined})
                    if(callbacks.onResolve) callbacks.onResolve(data)
                }
                return data
            })
            .catch((error) => {
                if(mountedRef.current && requestRef.current === requestId){
                    setState({loading: false, data: undefined, error})
                    if(callbacks.onError) callbacks.onError(error)
                }
                throw error
            })
        if(callbacks.onFetch) callbacks.onFetch(promise)
        return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, query, variablesKey, networkPolicy, cacheProcess, skip])

    const run = useCallback(() => execute(() => client.query({query, variables, networkPolicy, cacheProcess})
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [execute])

    const refetch = useCallback(() => execute(() => client.refetch({query, variables, cacheProcess})
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [execute])

    useEffect(() => {
        if(skip){
            setState({loading: false, data: undefined, error: undefined})
            return undefined
        }
        run().catch(() => {})
        return () => { requestRef.current += 1 }
    }, [run, skip])

    useEffect(() => {
        if(skip){
            return undefined
        }
        const queryTypes = client.getQueryTypes ? client.getQueryTypes(query) : []
        const unsubscribe = client.subscribe((changedTypes) => {
            const types = changedTypes || []
            const relevant = !queryTypes.length || types.some((type) => queryTypes.includes(type))
            if(!relevant){
                return
            }
            let next
            try{
                next = client.readCache({query, variables, cacheProcess})
            }catch(e){
                return
            }
            if(!mountedRef.current){
                return
            }
            setState((prev) => {
                if(!prev.loading && !prev.error && sameData(prev.data, next)){
                    return prev
                }
                return {loading: false, data: next, error: undefined}
            })
        })
        return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, query, variablesKey, cacheProcess, skip])

    return {
        loading: renderedState.loading,
        data: renderedState.data,
        error: renderedState.error,
        refetch
    }
}

const useMutation = (config = {}, clientOverride) => {
    const contextClient = useDelv()
    const client = clientOverride || contextClient
    if(!client){
        throw new Error('delv-react: no Delv client found. Wrap the tree in <DelvProvider client={delv}> or pass a client to useMutation.')
    }

    const [state, setState] = useState({
        loading: false,
        data: undefined,
        error: undefined
    })

    const mountedRef = useRef(true)
    const configRef = useRef(config)
    configRef.current = config

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    const mutate = useCallback((runtime = {}) => {
        if(mountedRef.current){
            setState({loading: true, data: undefined, error: undefined})
        }
        return client.mutate({...configRef.current, ...runtime})
            .then((data) => {
                if(mountedRef.current){
                    setState({loading: false, data, error: undefined})
                }
                return data
            })
            .catch((error) => {
                if(mountedRef.current){
                    setState({loading: false, data: undefined, error})
                }
                throw error
            })
    }, [client])

    return [mutate, {loading: state.loading, data: state.data, error: state.error}]
}

const DelvQuery = ({children, client, ...queryProps}) => {
    const result = useQuery(queryProps, client)
    if(typeof children === 'function'){
        return children(result)
    }
    return children || null
}

// Element-child API: keep query lifecycle UI outside the data component.
const ReactQuery = ({
    children, client, query, variables, networkPolicy, cacheProcess, skip,
    loading: loadingOverride,
    skipLoading = false, error: errorFallback, formatResult,
    onFetch, onResolve, onError, ...childProps
}) => {
    const contextClient = useDelv()
    const resolvedClient = client || contextClient
    const configuredLoading = loadingOverride !== undefined ? loadingOverride
        : resolvedClient && resolvedClient.defaults ? resolvedClient.defaults.loading : undefined
    const loading = configuredLoading === undefined
        ? <div className='page-loading' role='status'>Loading…</div> : configuredLoading
    const result = useQuery({
        query, variables, networkPolicy, cacheProcess, skip, onFetch, onError,
        onResolve: (data) => {
            if(onResolve) onResolve(formatResult ? formatResult(data) : data)
        }
    }, client)

    const mocking = !skip && result.loading && loading === 'mock' && !skipLoading
    const mockData = useMemo(() => {
        if(!mocking) return undefined
        if(!resolvedClient.getMockResult) throw new Error('delv-react: loading="mock" requires a client with getMockResult')
        return resolvedClient.getMockResult({query, variables})
    }, [mocking, resolvedClient, query, JSON.stringify(variables)])

    if(skip) return null
    if(result.loading && !skipLoading && !mocking) return loading
    if(result.error){
        if(errorFallback !== undefined){
            return typeof errorFallback === 'function'
                ? errorFallback(result.error, result.refetch)
                : errorFallback
        }
        return <div role='alert'>Unable to load data.</div>
    }

    const source = mocking ? mockData : result.data
    const data = source === undefined ? undefined
        : formatResult ? formatResult(source) : source
    return React.cloneElement(React.Children.only(children), {...data, ...childProps})
}

const Delv = {query: ReactQuery}

const withQuery = (config = {}) => (WrappedComponent) => (props) => {
    const resolved = typeof config === 'function' ? config(props) : config
    const {client, ...queryProps} = resolved
    const result = useQuery(queryProps, client)
    return <WrappedComponent {...props} {...result} />
}

export {
    Delv,
    ReactQuery,
    DelvContext,
    DelvProvider,
    useDelv,
    useQuery,
    useMutation,
    DelvQuery,
    withQuery
}

export default Delv
