const express = require('express')
const app = express()
const { postgraphile } = require('postgraphile')
const PostGraphileConnectionFilterPlugin = require('postgraphile-plugin-connection-filter')

const graphql = postgraphile('postgres://postgres@localhost:5432/delv', 'delv', {
    dynamicJson: true,
    appendPlugins: [PostGraphileConnectionFilterPlugin],
    graphileBuildOptions:{
        connectionFilterRelations: true
    },
    disableQueryLog:true
})

app.use('/', graphql)

app.listen(process.env.PORT || 3005, process.env.HOST || 'localhost')
