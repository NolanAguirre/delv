const Delv = require('./core/delv')
const createCache = require('./cache')
const QueryManager = require('./queryManager/QueryManager')
const TypeMap = require('./queryManager/Postgraphile')
const AxiosWithErrors = require('./network/AxiosWithErrors')
const CacheOnly = require('./networkPolicy/CacheOnly')
const CacheFirst = require('./networkPolicy/CacheFirst')
const NetworkOnly = require('./networkPolicy/NetworkOnly')
const NetworkFirst = require('./networkPolicy/NetworkFirst')
const NetworkOnce = require('./networkPolicy/NetworkOnce')

module.exports = {
    Delv,
    createCache,
    QueryManager,
    TypeMap,
    CacheOnly,
    CacheFirst,
    NetworkOnly,
    NetworkFirst,
    NetworkOnce,
    AxiosWithErrors
}
