# AOSSIE MCP Template

A template for giving any AOSSIE project an MCP server **with no server**.

The MCP server runs as a subprocess on the user's own machine over stdio, shipped
as a public npm package. Its data is static JSON on GitHub Pages. Both are free
forever, there is no uptime to own, no OAuth to implement, and no rate limit to
budget for. This is how the official filesystem, git and memory MCP servers ship.

```
                        ┌─────────────────────────────┐
   the code rail        │ npm  @aossie/<project>-mcp  │   changes rarely
   ─────────────        └──────────────┬──────────────┘
                                       │ npx spawns it
                        ┌──────────────▼──────────────┐
                        │  MCP client (Claude, IDE…)  │
                        │  stdio · JSON-RPC · local   │
                        └──────────────┬──────────────┘
                                       │ HTTPS GET, cached
   the data rail        ┌──────────────▼──────────────┐
   ─────────────        │ <org>.github.io/<repo>/     │   changes constantly
                        │        catalog.json         │
                        └─────────────────────────────┘
```

**Code and data ship on separate rails.** The npm package holds logic. The
catalog holds content. Adding an entry is a Pages deploy, not an npm release —
which is the property that makes this workable across a large number of repos.

---

## Try it in two minutes

```bash
git clone https://github.com/AOSSIE-Org/MCP-Template.git
cd MCP-Template
npm install
npm run verify        # stdout guard, catalog validation, typecheck, e2e tests
npm run inspect       # drive it by hand in the MCP Inspector
```

Point any MCP client at your local build:

```json
{
  "mcpServers": {
    "aossie-template": {
      "command": "node",
      "args": ["/absolute/path/to/MCP-Template/dist/index.js"]
    }
  }
}
```

Once published, users need this and nothing else — no install step, no account,
no endpoint:

```json
{
  "mcpServers": {
    "aossie-template": {
      "command": "npx",
      "args": ["-y", "@aossie/mcp-template"]
    }
  }
}
```

See [docs/CLIENTS.md](docs/CLIENTS.md) for per-client config paths.

## Onboard your project

```bash
npm run onboard
```

It asks for a project slug, repo, and what one catalog entry is called, then
rewrites `package.json`, `mcp.config.json`, `catalog/catalog.meta.json` and this
README in one pass. Non-interactively:

```bash
npm run onboard -- --project=solar-oracle --repo=AOSSIE-Org/SolarOracle \
                   --noun=forecast --nouns=forecasts --clean --yes
```

Then replace `catalog/sources/**` with your content — one Markdown file per
entry — and run `npm run catalog -- --snapshot`.

Full walkthrough: **[docs/ONBOARDING.md](docs/ONBOARDING.md)**.

## What the server exposes

Four tools. Their names follow `naming.itemNoun` in `mcp.config.json`, so a docs
project gets `search_pages` / `get_page` and a skills project gets
`search_skills` / `get_skill`.

| Tool              | Returns                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `search_items`    | Ranked summaries — id, title, summary, category, tags. No bodies. |
| `get_item`        | One entry in full, by exact id, including its body.               |
| `list_categories` | The category vocabulary with per-category counts.                 |
| `catalog_info`    | Where the data came from, when, and whether it is stale.          |

Three specific tools beat one `query` tool with a mode flag: a model picks
correctly from clear names far more reliably than it fills a discriminated union.
And search deliberately withholds bodies — every field returned costs the calling
model context, so the body waits for an explicit `get_item`.

Plus MCP resources (`aossie://catalog`, `aossie://item/{id}`) when
`resources.enabled` is true, for clients that render a resource picker.

## Repo layout

```
mcp.config.json            ← the onboarding surface: identity, catalog URL, naming
catalog/
  catalog.meta.json        ← project identity + category vocabulary
  catalog.schema.json      ← the published data contract
  sources/**/*.md          ← YOUR CONTENT. one file = one entry
  snapshot.json            ← generated offline fallback, bundled into npm
src/
  index.ts                 ← stdio transport wiring, and nothing else
  server.ts                ← createServer(): registers everything, transport-agnostic
  core/                    ← never edited when onboarding
    config.ts              ·  compiled config + derived tool names
    catalog-client.ts      ·  fetch, ETag, retry, TTL cache, snapshot fallback
    search.ts              ·  dependency-free weighted ranking
    schemas.ts logger.ts errors.ts types.ts
  tools/
    index.ts               ← ADD YOUR TOOLS HERE (one array, one source of truth)
    registry.ts            ·  defineTool(): schema + error wrapping
    search-items.ts get-item.ts list-categories.ts catalog-info.ts
  resources/items.ts
scripts/
  generate-runtime.mjs     ← compiles mcp.config.json into the build
  build-catalog.mjs        ← sources/**  →  catalog.json  (zero dependencies)
  check-stdout.mjs         ← build gate: nothing in src/ may write to stdout
  onboard.mjs              ← rewrites the template for one project
  sync-version.mjs         ← keeps mcp.config.json's version equal to package.json's
.github/workflows/
  ci.yml                   ← verify on 20.10 + 22, then install-from-tarball
  catalog.yml              ← push to main → GitHub Pages
  publish.yml              ← tag v* → npm with provenance
```

## The four things that actually matter

**1. stdout belongs to the protocol.** On stdio, stdout *is* the JSON-RPC
framing. One `console.log` lands mid-frame and the client reports an opaque
disconnect with nothing pointing at the cause. Everything diagnostic goes through
`src/core/logger.ts` to stderr, and `npm run check:stdout` fails the build on any
stdout write under `src/`. It is the most common way a working MCP server appears
broken and it is trivially preventable, so it is a gate rather than a convention.

**2. Ship a bundled snapshot.** If Pages is unreachable, the server degrades to
`catalog/snapshot.json` — stale but working, instead of dead. `publish.yml`
refreshes it from the tagged content, so it is never more than one release
behind. The degradation ladder is: fresh remote → unexpired cache → stale cache →
snapshot.

**3. The cache lives in the process, not on disk.** The subprocess lives as long
as the client session, so a TTL over an in-memory value is the whole cache. Disk
caching would add path-resolution and permission bugs across Windows, macOS and
Linux for almost no gain.

**4. One registry, not a switch statement.** `src/tools/index.ts` holds a single
array. Listing and dispatch both derive from it, so there is no separate list
handler to forget to update when you add a tool.

## Configuration

Everything lives in [`mcp.config.json`](mcp.config.json) — server identity,
catalog URL, cache TTL, tool naming, response size limits. It is compiled into
the build by `scripts/generate-runtime.mjs`, so run `npm run gen` (or any
`npm run build`) after editing it. Field-by-field reference:
[docs/ONBOARDING.md](docs/ONBOARDING.md#configuration-reference).

For local development, four environment variables override the compiled values
without a rebuild:

```bash
AOSSIE_MCP_CATALOG_URL=./catalog/dist/catalog.json \
AOSSIE_MCP_LOG_LEVEL=debug \
node dist/index.js
```

Also `AOSSIE_MCP_CACHE_TTL` and `AOSSIE_MCP_FETCH_TIMEOUT_MS`.

## If you ever do need a hosted endpoint

You probably do not. It is only worth it for shared state, secrets you cannot
hand to users, or browser-based clients that cannot spawn a subprocess.

GitHub Pages cannot be that endpoint — it serves static files, and MCP needs to
accept `POST` with JSON-RPC bodies. Cloudflare Workers' free tier (100k
requests/day) is the usual answer, and `src/server.ts` is already transport-free
so a Worker imports `createServer()` and wires it to
`StreamableHTTPServerTransport`. The tool implementations do not change.

Two warnings. Do not build on HTTP+SSE — it was deprecated in the 2025-03-26
spec revision. And moving from stdio to HTTP is an application redesign, not a
hosting toggle: auth, identity and multi-tenant isolation all become your
problem. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#if-you-outgrow-stdio).

## Docs

- **[docs/ONBOARDING.md](docs/ONBOARDING.md)** — adapt this template, step by step
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — why it is built this way
- **[docs/CLIENTS.md](docs/CLIENTS.md)** — client-by-client install snippets
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — working on the template itself
- **[catalog/catalog.schema.json](catalog/catalog.schema.json)** — the data contract

## Licence

MIT © AOSSIE. See [LICENSE](LICENSE).
