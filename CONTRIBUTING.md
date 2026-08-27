# Contributing

Two kinds of change land here, and they have different bars.

**Content** — anything under `catalog/sources/**`. Add a Markdown file, open a
PR. `npm run catalog` in CI validates it. No release needed; merging to `main`
deploys it.

**Code** — anything under `src/` or `scripts/`. Read on.

## Setup

```bash
npm install
npm run verify
```

`verify` is what CI runs: the stdout guard, catalog validation, typecheck, and
the end-to-end test that spawns the built server and drives it with a real MCP
client. Run it before pushing.

## The one rule that will bite you

**Nothing under `src/` may write to stdout.** On stdio transport, stdout is the
JSON-RPC framing; a single `console.log` corrupts a frame and the client reports
an opaque disconnect with nothing pointing at the cause.

Use `log` from `src/core/logger.ts`, which writes to stderr. `npm run check:stdout`
fails the build on any violation, and it runs before every build — not just in CI.

Watch for this in dependencies too. A library that prints a deprecation notice to
stdout breaks the session the same way.

## Adding a tool

Before writing code, check whether the catalog can express it. A new category or
tag needs neither code nor a release.

If a tool is genuinely needed: create `src/tools/<name>.ts` exporting
`defineTool({...})` and add it to the array in `src/tools/index.ts`. That array
is the single source of truth — listing and dispatch both derive from it.

Guidelines that matter more than they look:

- **Name it specifically.** `compare_forecasts` over `forecast_op`. The name is
  the strongest signal a model has about when to call it.
- **The description is prompt, not documentation.** Say what the tool returns and
  when to prefer it over its siblings. Iterating on a description is usually more
  effective than changing the code.
- **Return the minimum useful shape.** Every field costs the caller context.
- **Throw `ToolError` with a hint.** Turn a dead end into a next step.
- **`describe()` every input field.** It is what the model reads to fill them.

## Tests

`test/search.test.mjs` covers ranking. `test/protocol.test.mjs` runs the built
server as a subprocess and drives it with the SDK's own client — that is where a
new tool belongs, because it catches registration errors, schema rejections and
framing bugs that unit tests cannot see.

Tests import from `dist/`, so `npm test` builds first.

## Style

The existing code is the spec: four-space indent, ESM with `.js` extensions on
relative imports (required by `NodeNext`), named exports, `strict` TypeScript.

Comments explain *why*, not *what*. If a comment restates the line below it,
delete it. If a decision would look arbitrary to the next reader, write down what
the alternative was and why it lost.

## Dependencies

The runtime dependency list is two packages and should stay that way. `scripts/`
has none at all, deliberately — they run unattended in CI and only read local
files. A PR adding a dependency should say what it replaces and why the
hand-rolled version is not adequate.

## Releasing

Maintainers only.

```bash
npm version <patch|minor|major>   # also syncs mcp.config.json into the commit
git push --follow-tags
```

`publish.yml` verifies the tag matches both `package.json` and
`mcp.config.json`, refreshes the bundled snapshot from the tagged catalog, runs
`verify`, and publishes to npm with provenance.
