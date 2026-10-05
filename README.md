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

delv does not bundle an HTTP library. Pass one (such as axios) as `httpClient`
to `AxiosWithErrors` and to `TypeMap({api})`; it must expose
`post(url, body)` resolving to a response with a `data` property.

```js
const axios = require('axios')
const {
  Delv,
  createCache,
  QueryManager,
  TypeMap,
  AxiosWithErrors,
  CacheOnly,
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
  NetworkOnce
} = require('delv')

// In production, pass a prebuilt typemap so no introspection request is made.
const typeMap = TypeMap({typeMap: require('./typemap.json')})

const delv = Delv({
  cache: createCache(typeMap),
  queryManager: new QueryManager(),
  network: new AxiosWithErrors({url: 'https://example.com/graphql', httpClient: axios}),
  networkPolicies: [CacheOnly, CacheFirst, NetworkFirst, NetworkOnly, NetworkOnce],
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
TypeMap({api: 'https://example.com/graphql', httpClient: axios}).then((map) => {
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

For development, you can keep the generated map in memory. `DelvProvider`
accepts either a ready client or a promise resolving to a client. Create that
promise once outside React rendering, with initialization awaiting
`TypeMap({api})` and wrapping the result using `TypeMap({typeMap: map})` before
creating the cache and client:

```jsx
const client = createClient() // async initialization, including introspection

<DelvProvider client={client}>
  <App />
</DelvProvider>
```

The provider mounts children only after the client is ready. Its `loading` prop
customizes the startup fallback, and `error` accepts an element or a function
receiving the initialization error. Ready clients mount children immediately.
Query-level `loading: 'mock'` applies after initialization, when schema metadata
is available.

### Resolving ambiguous reverse references

When using network introspection, `DelvProvider` displays a setup screen instead
of mounting the app if reverse relationships are ambiguous or self-referential.
It lists the exact source fields, possible inverse fields, and a configuration
snippet. Add `reverseReferences` to the `Delv({...})` call and recreate the client:

```js
const client = Delv({
  cache: createCache(typeMap),
  queryManager,
  network,
  networkPolicies,
  reverseReferences: {
    TermEdge: {
      termNodeByFromNode: 'termEdgesByFromNode',
      termNodeByToNode: 'termEdgesByToNode'
    },
    TermNode: {
      termEdgesByFromNode: 'termNodeByFromNode',
      termEdgesByToNode: 'termNodeByToNode',
      lineage: null
    }
  }
})
```

Keys are actual GraphQL type and field names. Each entry controls one traversal
direction: `TermEdge.termNodeByFromNode` above adds the edge to the nested node's
`termEdgesByFromNode`. Configure both directions when both should infer links.
Use `null` to disable reverse inference for a field; its returned data is still
cached normally. Inverse names must exist on the target type and point back to
the source type. Introspection metadata determines singular versus collection
cardinality. Delv does not guess ambiguous inverses from naming conventions.

Keep this configuration when shipping a prebuilt type map. The setup screen is
only enabled for maps returned directly by network introspection and hydrated
with `TypeMap({typeMap: map})`; serializing to JSON removes that development
marker. Unresolved or invalid inverses are skipped in either mode, so they
cannot populate unrelated fields. The initial screen snippet uses `null` to
disable inference; choose the actual inverse names to maintain relationships
automatically. Re-fetch related data when inference is disabled and it changes.

### Cache keys

Nodes are normalized by `id` by default. A type without an `id` field gets a key
from introspection when PostGraphile exposes exactly one single-column unique
lookup for it: a `Query` field that returns the type and takes one required
argument named after one of the type's scalar fields, such as
`entityTypeByType(type: String!)` keying `EntityType` by `type`. `nodeId`
lookups are ignored. Detected keys are stored in the map's `__keys`, so they
survive `JSON.stringify` and ship with a prebuilt map.

Set `keys` to choose a key yourself. It overrides detection and is written into
`toString()` output alongside `fields`:

```js
const typeMap = TypeMap({typeMap: map, keys: {EntityRelationshipType: 'relationship'}})
```

Queries automatically select a type's key field the same way they select `id`.
Types that still have no key are not stored; the nodes inside them are still
cached. Introspection reports each one with `console.log`:

- `delv: X has no id and no single-column lookup; it will not be cached.` The
  type has a composite or missing unique key, or is a view. Set `keys.X`.
- `delv: X has multiple single-column lookups (xByA, xByB); it will not be
  cached.` Delv won't pick one. Set `keys.X`.
- `delv: keys.X = 'y' is not a field of X` A configured key doesn't match the
  type's introspected fields.

Passing `keys` to `TypeMap({api, keys})` silences the first two messages for
those types. Apply the keys by wrapping the result with
`TypeMap({typeMap: map, keys})`, as with `fields`.

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

For a component that handles loading and errors for you, use `<Delv.query>`.
It renders its single child after the query resolves, passing the top-level
response fields as props. The child stays current through cache subscriptions.

```jsx
import Delv, {DelvProvider} from 'delv/react'

const USERS = '{ allUsers { nodes { id name } } }'

const Users = ({allUsers}) => (
  <ul>
    {allUsers.nodes.map((user) => <li key={user.id}>{user.name}</li>)}
  </ul>
)

const App = () => (
  <DelvProvider client={delv}>
    <Delv.query query={USERS} loading={<p>Loading users…</p>}>
      <Users />
    </Delv.query>
  </DelvProvider>
)
```

`Delv` is available as either a default or named export from `delv/react`;
the component is also exported as `ReactQuery`. This React namespace is separate
from the core `Delv` client factory exported by `delv`.

The wrapper accepts `query`, `variables`, `networkPolicy`, `cacheProcess`, and an
optional `client` override. Its presentation options are:

- `loading`: overrides the client's `defaults.loading` for this query. Without
  either setting, defaults to accessible “Loading…”
  text with the `page-loading` class. Pass `null` to show nothing, or `"mock"`
  to render the child immediately with schema-shaped placeholder data.
- `error`: content shown on failure, or `(error, refetch) => ReactNode` for a
  retry UI. Defaults to “Unable to load data.”
- `formatResult`: transforms response data into child props, for example
  `data => ({users: data.allUsers.nodes})`. Also applies to cache updates.
- `skipLoading`: renders the child while the request is pending; the child must
  tolerate missing data when using this option.
- `skip`: sends no request and renders nothing.
- `onFetch(promise)`, `onResolve(data)`, and `onError(error)`: optional request
  callbacks. `onResolve` receives formatted data when `formatResult` is supplied;
  cache updates render fresh data without invoking request callbacks.

Use mock loading to keep the data component mounted while its request is pending:

```jsx
<Delv.query
  query={USERS}
  loading="mock"
  formatResult={data => ({users: data.allUsers.nodes})}
>
  <UserList />
</Delv.query>
```

To enable mock loading for all query components using a client, set
`defaults.loading` when creating that client:

```js
const delv = Delv({
  cache, queryManager, network, networkPolicies,
  defaults: {loading: 'mock'}
})
```

Each `<Delv.query>` can override this with `loading="mock"`, custom loading
content such as `loading={<Spinner />}`, or `loading={null}` to render nothing
while pending. Omitting `loading` (or passing `undefined`) inherits the client's
setting. If neither is configured, the standard “Loading…” state is shown.
An explicit `client` prop uses that client's default instead of the provider's.

Mock loading fills the selected query tree, including nested objects and one item
per list. Strings and IDs become `"Loading"`, numeric types become `0`, and
booleans become `false`. Format a number with `.toFixed(2)` to display `0.00`.
Enums use their first declared value; interfaces and unions use their first
possible concrete type. Other custom scalars use `"Loading"`; use `formatResult`
if your component needs a specialized placeholder such as a valid date or JSON
object. Nullable fields also receive placeholders.

Aliases, fragments, and `@skip`/`@include` directives are respected. Mock data passes
through `formatResult`, stays out of the cache, and does not invoke `onResolve`.
Cached data renders normally, and errors still use the error fallback.
`skipLoading` takes precedence over mock loading.

Regenerate prebuilt type maps with the current introspection generator to retain
scalar fields and list wrappers. Alternatively, supply explicit field metadata,
e.g. `TypeMap({typeMap, fields: {Query: {users: '[User!]!'}, User: {name: 'String'}}})`.
Older relationship-only maps cannot determine the complete placeholder shape;
missing field types produce an error. The core client also exposes
`client.getMockResult({query, variables})` for generating the same data directly.

Pass exactly one element child. Its existing props are preserved, response fields
override matching child props, and extra wrapper props override both. Query and
presentation options are not forwarded to the child.

```jsx
<Delv.query
  query={USERS}
  formatResult={data => ({users: data.allUsers.nodes})}
  error={(error, refetch) => (
    <button onClick={refetch}>Could not load users. Retry</button>
  )}
>
  <UserList />
</Delv.query>
```

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
touches, so mutations elsewhere keep the view current. `refetch()` always
issues a `network-only` request regardless of the query's `networkPolicy`, and
takes no arguments; use `delv.refetch({query, variables})` outside React. You can pass a client as
the second argument to `useQuery` (or a `client` prop to `DelvQuery`/`withQuery`)
to override the one from context.

## Mutations

A mutation is a `network-only` request whose response is written into the
type-normalized cache. Because the cache is normalized, writing the mutated
node(s) automatically updates every query that touched those types via the
`subscribe`/emitter path — no per-query cache patching required.

Use the client's `mutate` method:

Each mutation invocation sends its own request, including concurrent calls with
identical variables. Only queries share in-flight requests.

For creation, returning a related node's identity also maintains reverse cache
references. For example, `book { id title libraryById { id } }` adds the new book
to the library's cached book references without returning the library's entire
book list. Delv deduplicates those references and notifies subscribers of both
types. See [reverse references](./docs/cache-design.md#reverse-references) for
the relationship and in-memory pagination assumptions.

```js
const data = await delv.mutate({
  mutation: 'mutation ($name: String!) { createUser(input: {name: $name}) { user { id name } } }',
  variables: {name: 'Ada'},
  cacheProcess: 'type',          // optional, falls back to defaults
  refetchQueries: [
    // Each entry is run after the mutation resolves.
    {query: '{ allUsers { nodes { id name } } }', variables: {}}
  ]
})
```

`refetchQueries` covers cases the mutation response can't express, such as a
node joining a list the normalized write can't link it to. A refetch only adds
to list membership; nodes leave lists only through a delete mutation. Each entry accepts
`{query, variables, networkPolicy, cacheProcess}` and defaults to
`network-only`. Refetches run after the mutation resolves; a failing refetch is
swallowed so it never masks an otherwise successful mutation.

### React `useMutation`

`useMutation` (from `delv/react`) returns an Apollo-style tuple
`[mutate, {loading, data, error}]`:

```jsx
import {useMutation} from 'delv/react'

const CREATE_USER = 'mutation ($name: String!) { createUser(input: {name: $name}) { user { id name } } }'

const AddUser = () => {
  const [createUser, {loading, error}] = useMutation({
    mutation: CREATE_USER,
    refetchQueries: [{query: '{ allUsers { nodes { id name } } }'}]
  })

  const onSubmit = async (name) => {
    try{
      await createUser({variables: {name}}) // per-call variables merged over config
    }catch(e){
      // error is also exposed on the returned state
    }
  }

  return <button disabled={loading} onClick={() => onSubmit('Ada')}>Add</button>
}
```

The returned `mutate(runtime)` merges `runtime` over the hook `config`, so you
can pass per-call `variables` at submit time. It re-throws on error so callers
can `try/catch`, while also exposing `error` on the returned state. As with
`useQuery`, pass a client as the second argument to override the one from
context. Hook functions in `config` (such as `optimistic` and `update`) are
always read from the latest render.

### Optimistic updates

`mutate` (and `useMutation`) accept two optional hooks:

- `optimistic` runs once, right after the request is sent. Its cache writes
  show up immediately and are rolled back only if the mutation fails.
- `update` runs after a successful response and receives the `result`.

```js
delv.mutate({
  mutation: CREATE_BOOK,
  variables: {book},
  optimistic: ({cacheByType, cache, mutation, variables, typeMap}) => {
    cacheByType.write('Book.temp-1', {title: book.title, author: {id: book.authorId}})
  },
  update: ({cacheByType, cache, result, mutation, variables, typeMap}) => {
    cacheByType.delete('Book.temp-1')
  }
})
```

Both helper objects have the same methods:

| Method | Behavior |
| --- | --- |
| `read('Type.id')` | Returns the stored entity, or `undefined`. |
| `write('Type.id', values)` | Creates the entity or merges into it. |
| `update('Type.id', values)` | Merges into the entity. |
| `delete('Type', id)` or `delete('Type.id')` | Removes the entity. |

References split at the first `.`, so ids may contain dots. When the type map
says the key field is an `Int`, the id is converted to a number.

`cacheByType` writes an entity the same way a `create*`, `update*`, or
`delete*` mutation response is written. Nested relations are normalized
(a missing `__typename` is filled in from the type map), reverse references are
maintained, `write` appends the id to cached lists of that type, and `delete`
removes it from them. `update` never changes list membership.

`cache` is the raw, lower-level version. It only merges into or evicts the one
entity (stamping `__typename` and the key field) and notifies subscribers. **It
skips normalization, reverse references, and list membership:** a raw `write`
does not add the entity to any list, and a raw `update` returns `false` and
does nothing when the entity is not cached. Reads skip deleted ids, so a raw
`delete` still hides the entity from lists.

When the mutation succeeds, delv leaves the optimistic writes in place and
writes the server response on top of them, like any other response. Values the
response returns replace the optimistic ones. **Delv does not know that a
temporary entity such as `Book.temp-1` corresponds to the real one the
server created**, so remove it yourself in `update` (as above), or the list
will show both.

When the mutation fails, the optimistic writes are undone and the error is
re-thrown. The undo only reverts values that still hold what the hook wrote. A
field, entity, or list that a later write changed (a refetch, another
mutation) is newer data and is kept. Errors thrown by `update` are logged
rather than thrown, because the server write already succeeded.

Other writes are not held back while the mutation is pending. A refetch that
arrives before the server applies the mutation can overwrite the optimistic
values until the mutation's response arrives.

The same helpers are available on the client as `delv.cache` and
`delv.cacheByType` for writes outside a mutation. See
[optimistic updates](./docs/cache-design.md#optimistic-updates) in the cache
design notes.

## Network policy behavior

Each policy dedupes concurrent calls for the same query through the query
manager and writes successful responses into the cache.

| Policy | Name | Behavior |
| --- | --- | --- |
| `CacheOnly` | `cache-only` | Reads only from the cache; never hits the network. Rejects if the query is not cached. |
| `CacheFirst` | `cache-first` | Delivers available cached data immediately, then fetches and delivers fresh data if this exact query and variables have not succeeded before. |
| `NetworkFirst` | `network-first` | Fetches until this exact query and variables succeed, then serves cached data on subsequent calls. |
| `NetworkOnly` | `network-only` | Always fetches over the network and writes the response to the cache, even if a cached copy exists. |
| `NetworkOnce` | `network-once` | Fetches over the network the first time, then serves subsequent calls from the cache. |

In every case, in-flight requests for the same query share one promise, and
failed requests reject (and clear the pending state) without writing to the
cache.

`client.query({query, variables, onResult})` supports cache-first's two results:
`onResult` receives available cached data synchronously, then the fresh network
result. The returned promise resolves with the final result or rejects on failure.
React hooks read a synchronous cache snapshot before rendering and apply the
network result when it arrives, without a loading flash on cache hits.

Fetch history uses the full query document and variables, including successful
empty results. Concurrent queries share requests across policies; failures remain
retryable. `client.reset()` clears cache and fetch history. Mutations always use
network-only, regardless of a supplied query policy.

## Cache limitations

Because storage is type-normalized rather than query-shaped:

- `totalCount` is retained as a server snapshot for each query and variables,
  including nested and count-only connections. Refetch to refresh counts after
  mutations; delv does not infer totals from a possibly incomplete node list.
  `pageInfo` is not cached; each edge's per-node `__cursor` is retained.
- Same-type sibling and self-referential relationships require explicit
  `reverseReferences` configuration for automatic inverse updates. Unresolved
  inverses are skipped; directly returned references retain their field names.

The upside is that data stays up to date across all queries after a mutation,
with no per-query cache updates or re-fetching required. See
[docs/cache-design.md](./docs/cache-design.md) for details.

### Automatic argument fields

Delv enriches network selections with fields needed to evaluate query arguments
in the cache. For example, `orderBy: POSITION_ASC` selects `position`, and
`filter: {and: [{price: {greaterThan: 10}}, {author: {age: {lessThan: 50}}}]}`
selects `price` and `author { age }`. It recursively matches argument keys against
the output node's fields, including objects/lists supplied through variables.
Pagination keys such as `first`, `offset`, and `after` are ignored when they are
not fields on that node type. Both `nodes` and `edges { node }` are supported.

The added values (and required entity identities) are stored in the normalized
cache but are not added to the caller's result. Existing selections, aliases,
fragments, and `@skip`/`@include` are preserved. Each cache remembers the fields
required by queried types and adds them to later mutation selections of those
types, so changing a hidden sort/filter value updates cached query results.
`client.reset()` clears these requirements along with the cache.

New `TypeMap({api})` introspection results retain full output field metadata in
`__fields`, alongside the existing relationship map. Regenerate older saved
maps to enable this feature for scalar arguments and mutation payloads. For a
handwritten map, supply output fields explicitly:

```js
const typeMap = TypeMap({
    typeMap: {Query: {allBooks: 'Book'}, Book: {}},
    fields: {
        Book: {id: 'UUID', title: 'String', position: 'BigFloat'},
        Mutation: {moveBook: 'MoveBookPayload'},
        MoveBookPayload: {book: 'Book'}
    }
})
```

Include the real connection/edge output types in `fields` when filters reference
relationships that are not already selected. Introspection supplies these
metadata automatically. Output fields requiring arguments are not implicitly
selected. Unknown argument names retain the existing behavior.

Cache reads support `condition`, `where`, and common `filter` comparisons
(`equalTo`, `greaterThan`, `lessThan`, and their inclusive forms), boolean groups,
and nested relationship filters. Numeric schema types such as `BigFloat` and
`BigInt` are compared numerically, even when the API returns decimal strings.
This does not make an incomplete/paginated cache complete, fetch unseen matching
records, or infer server-specific filter operators or arbitrary mutation side
effects. Mutations must still return the affected entities/connections.

### Debug sidecar and overlay

Attach an optional sidecar to observe delv. The core only invokes hooks; it does
not retain logs, assign event IDs, measure durations, or depend on the debug UI.
The bundled sidecar is a separate entry point, so applications can substitute
another logger with the same hooks.

```js
import createDebugSidecar from 'delv/debug'
import {DelvDebugPanel} from 'delv/debug/react'

const sidecar = createDebugSidecar({maxEvents: 500})
const client = Delv({cache, queryManager, network, networkPolicies, sidecar})

// Mount alongside your application. No provider or component-library dependency.
<DelvDebugPanel sidecar={sidecar} enabled={isDevelopment} />
```

Create and pass the sidecar only in environments where you want diagnostics.
Recording starts when it is attached, including before the panel mounts. The
panel starts collapsed and provides an event stream, category and text filters,
expandable payloads, and a read-only cache browser grouped by storage key/type.
Network events contain the actual outgoing (potentially enriched) query and
response. Cache reads and writes include inputs, results or errors; `cache.types`
shows the emitted type lists. Start/completion events share an `operationId`.
Repeated calls coalesced by a network policy produce only one actual request.

The sidecar retains the most recent `maxEvents` events in memory and snapshots
payloads to keep past logs stable. Payloads include query variables and returned
data. Pause freezes the panel view while recording continues; Clear logs clears
only diagnostic history. Refresh reads the current cache without a cache query.
Call `sidecar.dispose()` when finished to release its cache subscription and
history. Use one sidecar per client. Without a sidecar, no diagnostic subscription
or event history is created.

Custom sidecars implement any of these optional hooks:

```js
const sidecar = {
  connect({inspectCache, subscribe}) {
    // inspectCache() exposes current storage. Treat it as read-only.
    // subscribe(types => ...) returns an unsubscribe function to own and release.
  },
  onCacheRead(input) { return {success(result) {}, error(error) {}} },
  onCacheWrite(input) { return {success(result) {}, error(error) {}} },
  onCacheClear() { return {success() {}, error(error) {}} },
  onNetworkRequest(input) { return {success(response) {}, error(error) {}} }
}
```

Hooks run synchronously and must treat inputs and results as read-only. Hook
exceptions are isolated from application operations. Operations performed through
the client and its policies are observed; direct calls on an externally held cache
or network object bypass operation hooks. Cache type subscriptions still reflect
emissions from that cache. Custom cache adapters can supply `inspect()` (with
`toString()` as a fallback) to expose their storage to the inspector.
