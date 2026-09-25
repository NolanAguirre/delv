const express = require('express')
const {postgraphile} = require('postgraphile')

const DATABASE_URL = process.env.DATABASE_URL || 'postgres:///lbry'
const SCHEMA = process.env.PG_SCHEMA || 'lbry'
const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || 5000

const app = express()

app.use(postgraphile(DATABASE_URL, SCHEMA, {
    watchPg: true,
    graphiql: true,
    enhanceGraphiql: true,
    graphqlRoute: '/graphql',
    graphiqlRoute: '/graphiql',
    dynamicJson: true,
    ignoreRBAC: false,
    setofFunctionsContainNulls: false
}))

app.listen(PORT, HOST, () => {
    console.log('lbry PostGraphile API listening on http://' + HOST + ':' + PORT + '/graphql')
    console.log('GraphiQL available at http://' + HOST + ':' + PORT + '/graphiql')
})
