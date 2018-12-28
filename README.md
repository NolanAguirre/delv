# delv

Delv is a caching and query layer for Graphql, built around postgraphile's query structure. Instead of preserving the structure of the query like mainstream caching libraries, Delv stores each node by type, saving references by type and a UID. This approach has a few downsides, such as the loss of pagination data, and issues caching data that has two fields of the same user defined type, such as a join table between two users. The upside to this approach is all the data is kept up to date even after a mutation, there is no need to update the cache per query, or re-query the database, after a mutation.


Still in the works, some of the kinks will be worked out with time.
