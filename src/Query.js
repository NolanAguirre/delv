const GraphQLStore = require('./Store.js')

module.exports = class Query{
    constructor(props){
        //super(props);
        this.props = props;
        this.queryId = GraphQLStore.registerQuery(props.query)
        this.networkPolicy = props.networkPolicy || 'cache-first'
        this.componentDidMount();
    }

    formatQueryOptions = () => {
        return{
            networkPolicy: this.networkPolicy,
            onResolve: this.onResolve,
            onCache: this.onCache,
            onError: this.onError,
            onFetch: this.props.onFetch
        }
    }

    componentDidMount = () => {
        this.id = GraphQLStore.bindComponentToQuery(this.queryId, this.formatQueryOptions())
        GraphQLStore.fetchQuery(this.queryId, this.id, this.props.variables)
    }

    componentWillUnmount = () => {
        GraphQLStore.unbindComponent(this.id);
    }

    onResolve = (queryResult) => {

    }

    onCache = (cache) => {
        if(this.props.onCache){
            this.props.onCache(cache)
        }else{
            //this.setState({queryResult:cache})
        }
    }

    onError = () => {

    }

    render = () => {

    }
}
