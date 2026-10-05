// delv's entry is CommonJS; importing the default gives module.exports, which
// avoids relying on the bundler's (flaky) CJS named-export detection.
import delv from 'delv'
import axios from 'axios'

const {
    Delv,
    createCache,
    QueryManager,
    TypeMap,
    AxiosWithErrors,
    CacheOnly,
    CacheFirst,
    NetworkOnly,
    NetworkOnce
} = delv

const GRAPHQL_URL = '/graphql'

// Dev-mode: introspect the live API to build the type map on boot. This keeps
// us from committing a typemap right now.
// TODO: swap to a prebuilt typemap.json (TypeMap({typeMap})) for production.
const createClient = async () => {
    // The async (api) branch of TypeMap resolves the raw introspection map;
    // feed it back in synchronously to get the queryable TypeMap interface.
    const map = await TypeMap({api: GRAPHQL_URL, httpClient: axios})
    const typeMap = TypeMap({typeMap: map})
    const cache = createCache(typeMap)
    const queryManager = new QueryManager()
    const network = new AxiosWithErrors({url: GRAPHQL_URL, httpClient: axios})

    return Delv({
        cache,
        queryManager,
        network,
        networkPolicies: [CacheFirst, CacheOnly, NetworkOnly, NetworkOnce],
        defaults: {networkPolicy: 'cache-first', cacheProcess: 'type'}
    })
}

export default createClient
