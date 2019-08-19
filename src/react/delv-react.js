import React, {Component} from 'react'
import graphql from 'graphql-anywhere'
import TypeMap from './TypeMap'
import Delv from './delv'
import Query from './Query'

class Query extends Component {
    constructor(props) {
        super(props);
        this.state = {
            loading:true
        }
    }

    componentDidMount = () => {
        this.resetProps()
    }

    resetProps = () => {
        if(this.query){
            this.query.removeCacheListener();
            this.query.removeListeners();
        }
        this.query = new Query({
            query: this.props.query,
            variables: this.props.variables,
            networkPolicy:this.props.networkPolicy,
            cachePolicy:this.props.cachePolicy
        })
        if (this.query.networkPolicy !== 'network-only') {
            this.query.addCacheListener();
        }
        this.query.query();
    }

    componentWillUnmount = () => {
        this.query.removeCacheListener();
        this.query.removeListeners();
    }

    componentDidUpdate = (prevProps, prevState, snapshot) => {
        if (prevProps.query != this.props.query) {
            this.resetProps()
        }
    }

    shouldComponentUpdate = (nextProps, nextState) => {
        // if(this.state === nextState && nextProps.query === this.props.query){
        //     return false
        // }
        if(this.state.queryResult === '' && nextState.queryResult === '' && nextProps.loading == this.props.loading){
            return false
        }
        return true
    }

    onFetch = (promise) => {
        this.setState({loading:true})
        if(this.props.onFetch){
            this.props.onFetch(promise)
        }
    }

    onResolve = (data) => {
        this.setState({queryResult: data, loading:false})
        if(this.props.onResolve){
            this.props.onResolve(data)
        }
    }

    onError = (error) => {
        if(this.props.onError){
            this.props.onError(error)
        }else{
            this.setState({error:error.error, loading:false})
        }
    }

    render = () => {
        const {
            query,
            variables,
            networkPolicy,
            onFetch,
            onResolve,
            onError,
            formatResult,
            cacheProcess,
            children,
            loading,
            ...otherProps
        } = this.props
        if (this.state.loading && !this.props.skipLoading) {
            if (this.props.loading) {
                return this.props.loading
            }
            return <div>loading</div>
        }
        if(this.state.error){ //TODO make this better too
            return React.cloneElement(this.props.children, {
                ...this.state.error, ...otherProps
            })
        }else{
            return React.cloneElement(this.props.children, {
                ...this.state.queryResult, ...otherProps
            })
        }
    }
}

export {
    ReactQuery
}


function ReactQueryHOC(WrappedComponent, config){
    return (props) => {
        if(config.queryFunction){
            let args = config.queryArgs
            if(args instanceof Function){
                args = config.queryArgs(props)
            }else{
                args = props[args]
            }
            config.query = config.queryFunction(args)
        }
        const {
            queryFunction,
            queryArgs,
            ...newProps
        } = config
        return <ReactQuery {...newProps}>
            <WrappedComponent {...props} />
        </ReactQuery>
    }
}

export {
    ReactQueryHOC
}
