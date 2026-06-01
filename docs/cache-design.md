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

Because the cache stores nodes by type and id, the connection wrapper itself is
not preserved. Each node keeps its own per-node `__cursor`, but connection-level
metadata (`totalCount`, `pageInfo`, edge ordering) is dropped during
normalization.

## Limitations

- **Pagination metadata is lost.** Only per-node `__cursor` survives; aggregate
  connection fields such as `totalCount` and `pageInfo` are not cached.
- **Same-type sibling fields conflict.** When a single parent has two fields of
  the same user-defined type — for example a join row that points at two
  different `User` records — the two references collide under one type bucket
  and can overwrite each other. `TypeMap` logs a conflict warning when it
  detects this shape during introspection.
