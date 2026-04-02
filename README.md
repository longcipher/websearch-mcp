# Web Search MCP

A Model Context Protocol (MCP) server that provides web search and content extraction tools for AI assistants. Built with Bun, Hono, and the MCP SDK.

## Features

- **MCP Server** with stdio and HTTP transports
- **Web Search** via Brave Search and DuckDuckGo with aggregated, ranked results
- **Content Extraction** — fetch any URL and extract clean Markdown via readability parsing
- **Content Resolution** — built-in resolvers for GitHub issues, Stack Exchange, and Wikipedia
- **Security** — URL validation, anti-bot detection, proxy agent support
- **Structured Logging** via `pino`
- **Schema Validation** via `zod`

## Packages

| Package | Description |
|---|---|
| `apps/web-search-mcp` | CLI application — starts the MCP server (stdio or HTTP) |
| `packages/web-search-mcp` | MCP server and tool definitions (`web_search`, `web_fetch`, `get_content`) |
| `packages/web-search-core` | Search aggregation, content extraction, security, and configuration |
| `packages/common` | Shared utilities |

## Quick Start

```bash
just setup
just lint
just test
just bdd
just test-all

# Start MCP server over stdio (for use with Claude Desktop, Cursor, etc.)
bun run apps/web-search-mcp/src/cli.ts stdio

# Start HTTP server (default port 3000)
bun run apps/web-search-mcp/src/cli.ts http --port 3000
```

## MCP Tools

### `web_search`

Search the web and return aggregated, ranked results from multiple providers.

### `web_fetch`

Fetch a URL and return its content as Markdown.

### `get_content`

Resolve structured content from known sources (GitHub issues, Stack Exchange, Wikipedia).

## Testing Matrix

- BDD acceptance tests via `features/*.feature` and `just bdd`.
- Unit tests via Vitest in `apps/*/src/*.test.ts` and `packages/*/src/*.test.ts`.
- Property tests with `fast-check` inside the standard Vitest run for invariants.
- Optional fuzzing with `jazzer.js` for parser-like or security-sensitive packages.
- Optional benchmarks with Vitest Bench for code with explicit performance targets.

## BDD + TDD Workflow

1. Write a failing Gherkin scenario in `features/*.feature`.
2. Drive implementation with failing Vitest tests.
3. Add `fast-check` properties for invariants across many generated inputs.
4. Run `just test` so deterministic examples and generated property checks execute together.
5. Implement the smallest change that makes the inner loop pass, then re-run `just bdd`.

## Project Convention

- Application packages under `apps/*`
- Reusable library packages under `packages/*`
- Shared devDependencies in root `package.json`
- `workspace:*` for internal package references

## Common Commands

```bash
just format
just lint
just test
just bdd
just test-all
just build
just typecheck
```

## License

Apache-2.0
