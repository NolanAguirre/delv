// import React, {Component} from 'react'
// import graphql from 'graphql-anywhere'
// import gql from 'graphql-tag'
// import TypeMap from './TypeMap'
// import Delv from './delv'
// import CacheEmitter from './CacheEmitter'
// class DelvReact extends Component{
//     constructor(props){
//         super(props);
//         this.state = {isReady:false}
//         Delv.registerMount(this);
//     }
//
//     isReady = () => {
//         this.setState({isReady:true})
//     }
//
//     render = () => {
//         if(this.state.isReady){
//             return this.props.children
//         }else{
//             return <div>'loading...'</div>
//         }
//     }
// }
//
// export { DelvReact }
//
// class Query extends Component{
//     constructor(props){
//         super(props);
//         this.state = {queryResult:''}
//         this.id = '_' + Math.random().toString(36).substr(2, 9)
//         this.types = [];
//         this.mapTypes()
//     }
//
//     mapTypes = () => {
//         const resolver = (fieldName, root, args, context, info) => {
//             if(!info.isLeaf && fieldName != 'nodes'){
//                 this.types.push(TypeMap.guessChildType(TypeMap.get(fieldName)))
//             }
//             return {}
//         }
//         graphql(resolver, gql `${this.props.query}`, null)
//
//     }
//
//     query = () => {
//         Delv.query(this.props.query, {resolve:this.resolve, onFetch:this.onFetch, networkPolicy:'network-once'})
//     }
//
//     onCacheUpdate = (types) => {
//         if(this.state.resolved){
//             let includesType = this.types.some(r => types.includes(r))
//             if(includesType){
//                 this.query();
//             }
//         }
//     }
//
//     componentDidMount = () => {
//         this.query();
//         if(this.networkPolicy != 'network-only'){
//             CacheEmitter.on(this.id, this.onCacheUpdate)
//         }
//     }
//
//     componentWillUnmount = () => {
//         CacheEmitter.removeAllListeners(this.id);
//     }
//
//     componentDidUpdate = (prevProps, prevState, snapshot) => {
//         if(prevProps.query != this.props.query){
//             this.query()
//         }
//     }
//
//     resolve = (data) => {
//         this.setState({queryResult:data, resolved:true});
//     }
//
//     onFetch = () => {
//         this.setState({resolved:false})
//     }
//
//     render = () => {
//         if(this.state.resolved){
//             return React.cloneElement(this.props.children, {queryResult:this.state.queryResult})
//         }else{
//             return 'loading'
//         }
//     }
// }
//
// export { Query }
"use strict";