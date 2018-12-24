# j-delv

Delv is a GraphQL caching and query level made to work with postgraphile. As of now it only supports postgraphile query structures
using nodes as to represent one to many relationships, however it doesn't have the issues that apollo has, as it stores the the query data by type, not query.
This allows for you to add to the cache and have any query that pulls from that given type auto update. The downside is this guesses types using postgraphile naming conventions.

example of the guesses

allActivityCatagories is type ActivitiesConnection

holding type nodes

guess type of nodes by removing "Connection" and making the result singular

which yields Activity from ActivitiesConnection, which will work with postgraphile and nodes.



no where near finished and documentation is still needed.
