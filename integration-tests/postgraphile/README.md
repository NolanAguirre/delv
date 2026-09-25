# lbry — delv + PostGraphile integration test

A runnable, native (no Docker) library app that exercises [delv](../../) against a
real PostGraphile API. Orchestrated with POSIX-sh Makefiles.

```
browser :8080 ── nginx ──┬── /            → ui/dist (built React app)
                         └── /graphql     → PostGraphile :5000 → Postgres "lbry"
```

## Prerequisites

Installed and on your `PATH`:

- **PostgreSQL 16** (`createdb`, `dropdb`, `psql`) — `gen_random_uuid()` is built in.
- **[sqitch](https://sqitch.org/)** with the pg engine — schema migrations.
- **Node.js 18+** and **npm** — API and UI.
- **nginx** — static + proxy front. `MIME_TYPES` defaults to
  `/etc/nginx/mime.types`; override if yours lives elsewhere.

A local Postgres reachable via `postgres:///lbry` (i.e. peer/socket auth as the
current user). Override with `make DATABASE_URL=... PGDATABASE=...`.

## Quick start

```sh
make install     # api + ui npm deps
make db-reset    # drop + create + deploy + verify + seed
make up          # build UI, start api, start nginx
```

Then open <http://localhost:8080>. GraphiQL is at <http://localhost:8080/graphiql>.

Tear down the background services with:

```sh
make down
```

## Layout

| Path                  | What                                                            |
| --------------------- | --------------------------------------------------------------- |
| `db/`                 | sqitch project (`lbry`, engine pg). One change per deploy.      |
| `db/deploy/v1.000.0.sql` | Full initial schema in the `lbry` schema.                    |
| `db/seed.sql`         | Sample data (not a versioned change).                           |
| `services/lbry/`      | Express + PostGraphile API on `:5000`.                          |
| `services/nginx/`     | nginx template; generated config lands in `.run/`.              |
| `ui/`                 | Vite + React app consuming delv via `file:../../..`.            |
| `Makefile`            | Orchestration.                                                  |

## Database versioning

Versioning is per-deployment: one sqitch change per deploy. The entire initial
schema lives in a single change `v1.000.0`. Future deployments add `v1.001.0`,
etc. Seed data lives outside sqitch so migrations stay pure schema.

## Individual targets

```sh
make api        # run PostGraphile in the foreground
make ui-dev     # vite dev server on :5173 (proxies /graphql to :5000)
make ui-build   # build UI to ui/dist
make db-deploy  # sqitch deploy only
make db-revert  # sqitch revert
```

Run `make help` for the full list.

## Notes

- Auth is deferred: `role` / `*_roles` tables exist, but there is no RLS/JWT yet;
  PostGraphile runs open.
- The UI builds its delv type map at boot via a live introspection query
  (`TypeMap({api})`). Swap to a prebuilt `typemap.json` later for production.
- `book_copy` and `role` exist beyond the originally listed tables so `checkout`
  and the `*_roles` joins have proper targets.
