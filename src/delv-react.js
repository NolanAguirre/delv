import React, {Component} from 'react'
import graphql from 'graphql-anywhere'
import TypeMap from './TypeMap'
import Delv from './delv'
import Query from './Query'
import _ from 'lodash';
import loadingIcon from '../app/logos/loading.svg'

function DelvReact(props){
    Delv.config({...props.config})
    return props.children
}

export {DelvReact}

class ReactQuery extends Component {
    constructor(props) {
        super(props);
        this.state = {
            queryResult: '',
            loading:true
        }
        this.query = new Query({
            query: this.props.query,
            variables: this.props.variables,
            networkPolicy:this.props.networkPolicy,
            onFetch:this.onFetch,
            onResolve: this.onResolve,
            onError:this.onError,
            formatResult:props.formatResult
        })
    }

    componentDidMount = () => {
        this.query.query();
        if (!(this.query.networkPolicy === 'network-only' || this.query.networkPolicy === 'network-no-cache')) {
            this.query.addCacheListener();
        }
    }

    componentWillUnmount = () => {
        this.query.removeCacheListener();
        this.query.removeListeners();
    }

    componentDidUpdate = (prevProps, prevState, snapshot) => {
        if (prevProps.query != this.props.query) {
            this.query.removeCacheListener();
            this.query = new Query({
                query: this.props.query,
                variables: this.props.variables,
                networkPolicy:this.props.networkPolicy,
                onFetch:this.onFetch,
                onResolve: this.onResolve,
                onError:this.onError,
                formatResult:this.props.formatResult
            })
            if (!(this.query.networkPolicy === 'network-only' || this.query.networkPolicy === 'network-no-cache')) {
                this.query.addCacheListener();
            }
            this.query.query();
        }
    }

    shouldComponentUpdate(nextProps, nextState){
        if(this.state === nextState && nextProps.query === this.props.query){
            return false
        }
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
            children,
            ...otherProps
        } = this.props
        if (this.state.loading && !this.props.skipLoading) {
            if (this.props.loading) {
                return this.props.loading
            }
            return <div className='page-loading'>
                <img alt='Loading' className='loading-icon center-x' src={loadingIcon} />
            </div>
        }
        return React.cloneElement(this.props.children, {
            ...this.state.queryResult, ...otherProps
        })
    }
}

export {
    ReactQuery
}
