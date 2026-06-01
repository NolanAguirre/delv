# delv

Delv is a caching and query layer for GraphQL, built around PostGraphile's query
structure. Instead of preserving the shape of each query like most caching
libraries, Delv normalizes every node into a flat, reference-based store keyed
by type and id. A single write keeps every query that touched a node up to date,
so the cache stays correct after a mutation without re-querying or hand-patching
per query.

See [docs/cache-design.md](./docs/cache-design.md) for the normalized cache
shape, the connection-metadata note, and the documented limitations.

## Install

```sh
npm install delv
```

React bindings are exposed from `delv/react` and depend on React as an optional
peer dependency:

```sh
npm install react
```

`react >=16.8.0` is required only if you use the React bindings (hooks rely on
`useState`/`useEffect`).

## Setup

Delv is a factory. You wire together a cache, a query manager, a network
transport, and the network policy classes you want to support, then call
`Delv({...})` to get a client.

```js
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
} = require('delv')

// In production, pass a prebuilt typemap so no introspection request is made.
const typeMap = TypeMap({typeMap: require('./typemap.json')})

const delv = Delv({
  cache: createCache(typeMap),
  queryManager: new QueryManager(),
  network: new AxiosWithErrors({url: 'https://example.com/graphql'}),
  networkPolicies: [CacheOnly, CacheFirst, NetworkOnly, NetworkOnce],
  defaults: {
    networkPolicy: 'cache-first',
    cacheProcess: 'type'
  }
})
```

The `defaults` are optional. When omitted, Delv falls back to
`networkPolicy: 'cache-first'` and `cacheProcess: 'type'`. Only the policy
classes you list in `networkPolicies` are registered; requesting an
unregistered policy name throws `Unknown network policy: "<name>"`.

## Typemap generation

`TypeMap` turns PostGraphile introspection into the type map the cache uses to
normalize nodes. It supports two modes:

**Development — fetch introspection from the API.** Passing `api` returns a
promise that resolves to the built map:

```js
TypeMap({api: 'https://example.com/graphql'}).then((map) => {
  // persist `map` (e.g. JSON.stringify) to ship as a prebuilt typemap
})
```

**Production — pass a prebuilt `typeMap`.** Passing `typeMap` builds the client
synchronously and makes no introspection request, so production startup never
hits the network for schema data:

```js
const typeMap = TypeMap({typeMap: require('./typemap.json')})
```

Generate the JSON once during development (or in a build step) from the resolved
map, commit it, and load it in production.

## Core query usage

The client returned by `Delv({...})` exposes:

```js
// Run a query through a network policy. Returns a promise of the response data.
const data = await delv.query({
  query: '{ allUsers { nodes { id name } } }',
  variables: {},
  networkPolicy: 'cache-first', // optional, falls back to defaults
  cacheProcess: 'type'          // optional, falls back to defaults
})

// Read straight from the cache (throws if the query is not fully cached).
const cached = delv.readCache({query, variables, cacheProcess})

// Subscribe to cache changes. The callback receives the changed type names.
// Returns an unsubscribe function (a no-op if the cache has no subscribe).
const unsubscribe = delv.subscribe((changedTypes) => { /* ... */ })

// The node types a query touches (used to decide if a change is relevant).
const types = delv.getQueryTypes(query)

// Clear the query manager and the cache.
delv.reset()
```

## React usage

Wrap your tree in a `DelvProvider` and read data with the `useQuery` hook,
`DelvQuery` render-prop component, or `withQuery` HOC — all from `delv/react`.

```jsx
import {DelvProvider, useQuery, DelvQuery, withQuery} from 'delv/react'

const App = () => (
  <DelvProvider client={delv}>
    <Users />
  </DelvProvider>
)

// Hook
const USERS = '{ allUsers { nodes { id name } } }'

const Users = () => {
  const {loading, data, error, refetch} = useQuery({
    query: USERS,
    variables: {},
    networkPolicy: 'cache-first', // optional
    cacheProcess: 'type',         // optional
    skip: false                   // optional, skip the request entirely
  })

  if(loading) return <p>Loading…</p>
  if(error) return <p>{String(error)}</p>
  return (
    <ul>
      {data.allUsers.nodes.map((u) => <li key={u.id}>{u.name}</li>)}
    </ul>
  )
}

// Render-prop
const UsersRenderProp = () => (
  <DelvQuery query={USERS}>
    {({loading, data, error, refetch}) => (loading ? <p>Loading…</p> : <List data={data} />)}
  </DelvQuery>
)

// HOC — injects {loading, data, error, refetch} as props
const UsersWithHoc = withQuery({query: USERS})(({loading, data}) => (
  loading ? <p>Loading…</p> : <List data={data} />
))
```

`useQuery` re-renders when the cache emits a change for any type the query
touches, so mutations elsewhere keep the view current. You can pass a client as
the second argument to `useQuery` (or a `client` prop to `DelvQuery`/`withQuery`)
to override the one from context.

## Network policy behavior

Each policy dedupes concurrent calls for the same query through the query
manager and writes successful responses into the cache.

| Policy | Name | Behavior |
| --- | --- | --- |
| `CacheOnly` | `cache-only` | Reads only from the cache; never hits the network. Rejects if the query is not cached. |
| `CacheFirst` | `cache-first` | Returns the cached result if present; otherwise fetches over the network, writes the response to the cache, and resolves with it. |
| `NetworkOnly` | `network-only` | Always fetches over the network and writes the response to the cache, even if a cached copy exists. |
| `NetworkOnce` | `network-once` | Fetches over the network the first time, then serves subsequent calls from the cache. |

In every case, in-flight requests for the same query share one promise, and
failed requests reject (and clear the pending state) without writing to the
cache.

## Cache limitations

Because storage is type-normalized rather than query-shaped:

- Pagination metadata is dropped beyond each node's per-node `__cursor`
  (connection-level fields like `totalCount` and `pageInfo` are not cached).
- A single parent with two fields of the same user-defined type (for example a
  join row referencing two `User` records) can conflict, since both references
  land in the same type bucket.

The upside is that data stays up to date across all queries after a mutation,
with no per-query cache updates or re-fetching required. See
[docs/cache-design.md](./docs/cache-design.md) for details.
