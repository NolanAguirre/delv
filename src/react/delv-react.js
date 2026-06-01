import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react'

const DelvContext = createContext(null)

const DelvProvider = ({client, children}) => (
    <DelvContext.Provider value={client}>{children}</DelvContext.Provider>
)

const useDelv = () => useContext(DelvContext)

const sameData = (a, b) => {
    try{
        return JSON.stringify(a) === JSON.stringify(b)
    }catch(e){
        return false
    }
}

const useQuery = ({query, variables, networkPolicy, cacheProcess, skip} = {}, clientOverride) => {
    const contextClient = useDelv()
    const client = clientOverride || contextClient
    if(!client){
        throw new Error('delv-react: no Delv client found. Wrap the tree in <DelvProvider client={delv}> or pass a client to useQuery.')
    }

    const variablesKey = variables ? JSON.stringify(variables) : ''
    const [state, setState] = useState(() => ({
        loading: !skip,
        data: undefined,
        error: undefined
    }))

    const mountedRef = useRef(true)
    const requestRef = useRef(0)

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    const run = useCallback(() => {
        const requestId = requestRef.current + 1
        requestRef.current = requestId
        setState((prev) => ({...prev, loading: true, error: undefined}))
        return client.query({query, variables, networkPolicy, cacheProcess})
            .then((data) => {
                if(mountedRef.current && requestRef.current === requestId){
                    setState({loading: false, data, error: undefined})
                }
                return data
            })
            .catch((error) => {
                if(mountedRef.current && requestRef.current === requestId){
                    setState({loading: false, data: undefined, error})
                }
                throw error
            })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, query, variablesKey, networkPolicy, cacheProcess])

    useEffect(() => {
        if(skip){
            setState({loading: false, data: undefined, error: undefined})
            return undefined
        }
        run().catch(() => {})
        return undefined
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
        loading: state.loading,
        data: state.data,
        error: state.error,
        refetch: run
    }
}

const DelvQuery = ({children, client, ...queryProps}) => {
    const result = useQuery(queryProps, client)
    if(typeof children === 'function'){
        return children(result)
    }
    return children || null
}

const withQuery = (config = {}) => (WrappedComponent) => (props) => {
    const resolved = typeof config === 'function' ? config(props) : config
    const {client, ...queryProps} = resolved
    const result = useQuery(queryProps, client)
    return <WrappedComponent {...props} {...result} />
}

export {
    DelvContext,
    DelvProvider,
    useDelv,
    useQuery,
    DelvQuery,
    withQuery
}
