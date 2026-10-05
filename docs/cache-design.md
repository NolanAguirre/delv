# Cache design

Delv normalizes every node returned by a query into a flat, reference-based
structure. Rather than preserving the shape of each query (the approach taken by
most GraphQL caching libraries), Delv stores each node once, keyed by its type
and a unique id. Other nodes that reference it hold only that id, so a single
write keeps every query that touched the node up to date — including after a
mutation, with no need to re-query or hand-patch the cache.

## Normalized shape

The cache is a map of node type to a map of node id to node data:

```json
{
  "<node type>": {
    "<node id>": {
      "...node data": "..."
    }
  }
}
```

A fuller example (node ids should be UUIDs; integers are used here for
readability, and a `U` suffix distinguishes user ids from account ids):

```json
{
  "accounts": {
    "1": {
      "id": "1",
      "name": "nolan's account",
      "user": "1U"
    }
  },
  "users": {
    "1U": {
      "id": "1U",
      "name": "Nolan"
    }
  }
}
```

Here `accounts.1.user` is a reference (`"1U"`) into the `users` map rather than
an embedded copy of the user. Any later write to `users.1U` is immediately
reflected everywhere the account is read.

## Reverse references

When a response nests a related entity, Delv also records the reverse link using
the type map. For example, a creation response containing
`book { id title libraryById { id } }` stores the book's library reference and
adds the book ID to the library's reverse book references. It does not require
returning `library.books` or recursively expanding the graph.

Inferred collection members are accumulated and deduplicated, preserving books
already in the library. Both types emit cache updates so subscribed queries
reread the updated relationships. Explicitly returned collections are merged
into their stored membership the same way; an explicitly returned null is
preserved.

Every list, root or nested, has one membership shared by all queries and
arguments that select it: a nested list lives on its parent entity, and a root
list lives on the Query root. Responses only add ids; a delete mutation is the
only thing that removes them. Each read reproduces its own slice in memory.

References are stored under their GraphQL field names. Reverse inference uses
an explicit `Delv({reverseReferences: {SourceType: {sourceField: 'inverseField'}}})`
mapping when supplied. Each mapping controls one direction; `null` disables that
field's inference. Without a mapping, only an unambiguous relationship between
different types is inferred. Ambiguous and self-referential links are skipped.
Introspection field metadata supplies inverse cardinality; older maps without
metadata retain the legacy collection/singular fallback.

For network-generated maps, `DelvProvider` blocks app mounting with an actionable
configuration screen until ambiguous relationships and invalid mappings are
resolved. Prebuilt JSON maps use the same inference rules without the startup
screen. Configuration remains separate from the exported schema JSON.

List reads filter, order, and apply `first`/`offset` to the cached members.
Both `order_by: {title: asc}` and PostGraphile's `orderBy: TITLE_ASC` are
supported. Correct slicing requires the relevant members and ordering fields to
be cached; this cannot reconstruct rows never fetched, so a page is only right
once the pages before it are cached. Cursor pagination and database natural
ordering are not maintained. Use `cacheProcess: 'query'` for true server
pagination.

## Connection metadata

PostGraphile wraps lists in `Connection` types that carry pagination metadata
alongside the actual nodes:

```graphql
type AccountsConnection {
  totalCount: Int
  pageInfo: PageInfo
  edges: [AccountsEdge!]!   # each edge: { cursor, node: Account }
  nodes: [Account!]!
}
```

Entities remain normalized by type and id. `totalCount` is stored separately
as a server snapshot scoped to the query and variables, owning entity, field,
and field arguments. Counts survive cached reads for root and nested connections,
including selections that request only a count. Aliased counts are read using
the original response selection. A refetch replaces the query's count snapshot;
clearing the cache removes it. Entity updates still flow through normalized nodes.

Counts are not calculated from cached membership, which may be only one page.
Mutations do not adjust these snapshots automatically: refetch affected queries
when totals may have changed. Each node retains its per-node `__cursor`;
`pageInfo` is still not cached.

## Optimistic updates

A mutation's `optimistic` hook runs once and writes straight into the
normalized store, the same store every read uses. There are no separate layers
to merge on read, and later writes are not held back or replayed. They land on
top of the optimistic values like any other write.

While the hook runs, a journal wrapped around storage records each entity and
absolute key (collection membership, count snapshots) it touches. For each
one, it keeps the value before the hook and the value after it. It also records
whether each touched type bucket existed. If the mutation succeeds, the journal
is discarded and the response is written normally. If it fails, the journal is
undone once:

- An entity or absolute key that still holds the hook's value is restored.
- For an entity some later write changed, only the fields still holding the
  hook's value are reverted. Fields the later write changed are kept.
- An absolute key (for example, a list's membership) that a later write
  replaced is kept.
- A type bucket the hook created is removed if it ends up empty, so a later
  read is still a cache miss rather than an empty result.

This relies on stored entities and membership arrays always being replaced,
never mutated in place, so reference comparison tells whether a value has
changed since. The hook and the rollback are each batched into one subscriber
update. A hook that throws is undone immediately and logged.

On success, the response only corrects what it returns. A temporary entity
created by the hook is unrelated to the real one as far as the cache knows, so
the `update` hook must remove it. If two pending optimistic writes touch the
same field and both fail, rolling back the later one first gives the right
result. Rolling back the earlier one first can leave the earlier value in place
until the next write of that field.

The two helper sets for hooks differ in scope. `cacheByType` uses the same `cacheNode`
path as network responses, so it maintains normalization, reverse references,
and (for `write`/`delete`) recorded collection membership. The raw `cache`
helpers merge into or evict one entity and notify subscribers, nothing more.
Deleted ids are filtered out on read, while stale membership and reverse
references remain in storage.

## Limitations

- **Counts require refetching after changes.** `totalCount` reflects the last
  response for that query and variables. `pageInfo` remains uncached.
  Optimistic writes do not adjust counts either.
- **Ambiguous inverses require configuration.** Same-type sibling fields and
  self-references need explicit inverse mappings or `null` to disable inference.
  Returned references are cached by field name; unresolved inverse links are
  never added to every field sharing the target type.
