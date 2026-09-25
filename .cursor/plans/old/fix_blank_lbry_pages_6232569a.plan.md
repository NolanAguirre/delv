---
name: fix blank lbry pages
overview: The lbry pages render blank because delv's graphql@14 dependency crashes under modern bundlers (defineToJSON interop). Fix by bumping delv's graphql to ^15.8.0, reinstalling, and rebuilding the UI, then verifying pages render live data.
todos:
  - id: bump-deps
    content: In root package.json bump graphql ^14.4.2 -> ^15.8.0 and graphql-tag ^2.10.0 -> ^2.12.6
    status: pending
  - id: reinstall
    content: Run npm install at repo root to update node_modules + package-lock.json
    status: pending
  - id: clear-cache-build
    content: Remove integration-tests/postgraphile/ui/node_modules/.vite and run make ui.build
    status: pending
  - id: verify-jest
    content: Run npm test to confirm delv Jest suite still passes
    status: pending
  - id: verify-browser
    content: Refresh/restart the stack and confirm in-browser that pages render live data with no defineToJSON console error
    status: pending
isProject: false
---

## Fix blank lbry pages (graphql@14 bundler crash)

### Root cause (confirmed via browser)
Both dev (`:6001`) and the nginx build (`:8060`) render a fully blank page. Console shows:

```
Uncaught TypeError: (0 , import_defineToJSON.default) is not a function
  at delv.js (node_modules/.vite/deps/delv.js)
```

`createClient()` in [ui/src/delv.js](integration-tests/postgraphile/ui/src/delv.js) throws while loading delv, so [ui/src/main.jsx](integration-tests/postgraphile/ui/src/main.jsx) never mounts React. The DB (v1.000.0 + v1.001.0, seeded), API (`:6000`), nginx, orchestration, and all page components are correct - this one crash is why the pages are "only empty."

The crash comes from delv depending on `graphql@^14.4.2` (2019). graphql v14's `jsutils/defineToJSON.js` uses an `_interopRequireDefault(...).default` pattern that esbuild/rollup mis-interop, yielding `undefined` and crashing on call. delv never imports `graphql` directly - only `graphql-tag` (needs only `parse`, present in v15) and `graphql-anywhere` (no graphql import). The UI resolves graphql through the symlinked delv from the repo-root `node_modules/graphql`, so bumping it there fixes both dev and build.

### Fix
1. In [package.json](package.json) (root delv package), change `"graphql": "^14.4.2"` to `"graphql": "^15.8.0"`. Also bump `"graphql-tag": "^2.10.0"` to `"^2.12.6"` (explicitly supports graphql 15/16 and is bundler-friendly; drop-in). Leave `graphql-anywhere` untouched.
2. Run `npm install` at the repo root to update `node_modules` + `package-lock.json`. The symlinked lbry UI picks up graphql v15 automatically.
3. Clear the stale Vite optimize cache so dev re-bundles delv against v15: remove `integration-tests/postgraphile/ui/node_modules/.vite`.
4. Rebuild the UI: `cd integration-tests/postgraphile && make ui.build`.

### Verify
- `npm test` (root) - delv's Jest suite still passes (graphql-tag `parse` + graphql-anywhere unaffected by the bump).
- Restart/refresh the stack (`make down && make up`, or let the running dev server reload) and open `http://localhost:8060` in the browser: confirm the `lbry` header renders and Books/Genres/Authors show live rows, the account dropdown switches user, Checkouts shows active/history, and the browser console is free of the `defineToJSON` error.
- Sanity-check `useMutation` paths: edit profile in Account Settings persists; Return moves a loan from active to history.

### Notes
- `npm install` with graphql-tag@2.12 + graphql@15 resolves cleanly; the old graphql-tag@2.10 peer range warning goes away with the graphql-tag bump.
- No changes needed to the page components, queries, API, DB, nginx, or Makefiles - they are already correct.
