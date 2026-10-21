# Web Search MCP Agent Instructions

## Non-negotiables

- Surgical edits only: every changed line must trace to the request. No drive-by refactors, no reformatting untouched code, no deleting pre-existing dead code (mention it instead).
- Fix root causes. Never silence a warning, weaken a check, or patch a symptom to make a gate pass.
- Never report completion while any `just` gate below fails. Report the failure verbatim and stop.
- Stop and ask when a request is ambiguous, conflicts with existing conventions, or requires credentials, publishing, or destructive operations.
- When a correction reveals a missing rule, add one specific rule here ("always X for Y", never "be careful with Y"); delete rules that never catch real errors.

## Scope

- `websearch-mcp` is a Bun + TypeScript monorepo around one MCP server: it searches the web through several providers, extracts page content as Markdown, and resolves structured content from GitHub issues, Stack Exchange and Wikipedia.
- `apps/` holds the runnable apps: `apps/web-search-mcp` is the CLI that starts the server over stdio or HTTP, `apps/cli-app` is a scratch app. `packages/` holds the libraries: `web-search-core` (all business logic), `web-search-mcp` (the MCP server and its tool definitions) and `common` (shared utilities).
- `packages/web-search-core` owns every decision: search aggregation, provider selection, URL policy, content resolution, fetching, parsing, sanitization, configuration and logging. The transports in `apps/` and the tool wrappers in `packages/web-search-mcp/src/tools/` are thin — never put business logic in them.
- The server exposes exactly three tools — `web_search`, `web_fetch` and `get_content`. A new tool means a new `register*Tool` call in `packages/web-search-mcp/src/server.ts` plus a zod schema in `packages/web-search-core/src/schemas.ts`.
- Three transports share that core: stdio (`apps/web-search-mcp/src/cli.ts`), a Bun HTTP server (`bun-http.ts`) and the Hono app used for serverless and Streamable HTTP (`hono-app.ts`, routes `/mcp`, `/health`, `/`).
- Known drift, do not "fix" silently: `README.md`'s Testing Matrix still advertises a `features/*.feature` BDD suite and a `bdd` recipe. Neither exists in this repo — there is no BDD harness and no recipe for it.

## Execution

- Parallelize aggressively: dispatch subagents for independent research, exploration, and implementation.
- The core, the MCP tool layer and the two transports are separate tracks with clean dependency edges — dispatch them in parallel, but never let two agents write the same file.
- NEVER use `git worktree`. Edit the current branch in place.
- TDD for behavior changes: add the failing Vitest case in the owning package first, make the smallest change that passes it, then run the whole `just test` suite.

## Verification loop

After each feature or bug fix, in order; any failure means the task is not done:

```bash
just format
just lint
just test
```

`format` runs `rumdl fmt`, Biome's fixer and `ultracite fix`. `lint` runs `typos`, the Markdown lint, `biome check` and `tsc --noEmit` across every workspace. `test` runs the Vitest suite in each workspace package.

## TypeScript rules

- `tsconfig.json` is strict everywhere: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `isolatedModules` and `verbatimModuleSyntax`. Do not relax a flag to make a change compile.
- `verbatimModuleSyntax` means type-only imports must use `import type`. Biome enforces this too (`useImportType`).
- Prefer `satisfies` over `as`; avoid `as` entirely unless the cast is unavoidable and commented. Use `unknown` over `any` and justify every `any`.
- No `enum` — use `as const` objects or union types. No default exports — use named exports. ESM `import` only; never mix `require()` and `import`.
- Use `const` (preferred) or `let`; never `var`. Do not mutate function parameters.
- `strict` plus `exactOptionalPropertyTypes` means `{ x?: string }` and `{ x: string | undefined }` are different types. Be explicit about which one you mean.
- The `.js` extension on relative imports is mandatory (`./errors.js`) — `moduleResolution` is `bundler` but the emitted code must resolve at runtime.

## Repository rules

- Configuration is a zod schema in `packages/web-search-core/src/config.ts`. Every environment variable is read there and nowhere else; a new setting is a new schema field plus a new `env.` mapping.
- URL safety is a hard gate. `validateUrl` rejects any scheme other than `http:`/`https:` and blocks private, loopback and link-local hosts. `resolveAndValidateUrl` then resolves the hostname and rejects private answers, which is the DNS-rebinding defence. `ALLOW_PRIVATE_NETWORK_FETCH=true` is the only override — never widen the private ranges without an explicit security decision.
- Search providers are opt-in by credential: Brave and DuckDuckGo always run; Serper, Tavily and SearXNG are enabled only when their key or URL is configured. Add a provider in `packages/web-search-core/src/search/providers/` and register it in `getProviders` in `search/aggregate.ts`.
- One provider failing must not fail the search: `aggregateSearch` uses `Promise.allSettled` and drops the rejected ones. Preserve that behaviour when adding providers.
- Results are merged by normalized URL (`search/normalize.ts` strips tracking parameters, drops `www.`, removes the trailing slash and the hash), and a merged result accumulates every `source_providers` entry. Ranking then adds a multi-provider bonus, a position bonus and the `TRUSTED_DOMAINS` boost from `search/rank.ts`.
- Timeouts are layered and must stay that way: `searchTimeoutMs` per provider, `searchTotalTimeoutMs` for the whole query, `fetchTimeoutMs` per page. The total timer is cleared in a `finally` block.
- `fetchPage` only accepts `text/html` and `application/xhtml` and aborts above 10 MiB. Keep both limits.
- Content resolution walks a chain: GitHub issue → Stack Exchange → Wikipedia → generic HTML (readability, then Turndown, then the sanitizer). A resolver returns `null` to fall through to the next one; it must not throw because the page is not its kind of content.
- Errors form a closed hierarchy under `WebSearchError` with a `code` string (`ConfigurationError`, `ProviderError`, `TimeoutError`, `UnsupportedContentError`, `AntiBotBlockError`, `SecurityBlockError`, `ParseError`). Add a new failure mode as a new subclass — never throw a bare `Error` across the package boundary.
- Logging is `pino`, created by `createLogger`. Library and server code must not call `console.log`.
- Bun workspace rules: `bun add` for a dependency, `bun add -d` for a root devDependency, `bun add <pkg> --filter <workspace>` for a workspace dependency. Never hand-edit a version.
- Internal packages are referenced with `workspace:*`. Shared devDependencies (`typescript`, `vitest`, `@biomejs/biome`, `fast-check`, `publint`, `tsx`, `ultracite`) live in the root `package.json`; each workspace package keeps its own `build`, `test`, `lint`, `format` and `typecheck` scripts, plus `publint` for the packages under `packages/`.
- Always commit `bun.lock`.

## Dependency choices

- HTTP framework: `hono`, not `express` or `fastify`. Validation: `zod`, not `joi`, `yup` or `io-ts`. Logging: `pino`, not `winston` or `bunyan`. ID generation: `nanoid`, not `uuid` unless UUIDv4/v7 is required. The CLI uses `citty`, not `commander`.
- Forbidden by default: `express` (use `hono`), `moment` and `dayjs` (use `Temporal` when stable), `lodash` (use the language built-ins), `axios` (use `fetch`).
- `undici` supplies the `Dispatcher` used for proxy-aware requests; the proxy agents are created in `packages/web-search-core/src/security/proxy-agent.ts`.
- The extraction pipeline uses `cheerio`, `turndown` and `@mozilla/readability`; the MCP protocol uses `@modelcontextprotocol/sdk`.
- Biome is the linter and formatter, `ultracite` adds the opinionated conventions on top, and `tsc --noEmit` is the type check. `typos` and `rumdl` guard the Markdown.
- There is no database, no ORM and no Redis in this repo — do not add them.
- `publint` runs for the packages under `packages/` only, because only they are publishable.

## Code conventions

- Tests are colocated as `*.test.ts` next to the source, use the Vitest globals enabled in `vitest.config.ts`, and rely on `describe`/`it`/`expect` plus `vi.mock()` / `vi.spyOn()` and `beforeEach`/`afterEach`.
- Property tests use `fast-check` inside the same `*.test.ts` file as the example-based tests — there is no separate property-test command.
- Fuzzing with `jazzer.js` is conditional: add it only in the package that parses hostile input. Do not seed a workspace-wide fuzz harness.
- Benchmarks are `*.bench.ts` files picked up by the existing Vitest benchmark config, and only for code with an explicit latency or throughput target.
- Error handling: typed error classes, `cause` for chaining, never an empty `catch {}`. Never swallow a provider failure silently — it is logged and the search continues.
- Async: `async`/`await` everywhere, `Promise.all` for independent work, `Promise.allSettled` where partial failure is acceptable, and `AbortController` for every timeout and cancellation.
- Do not mutate function parameters. Use `readonly` arrays and properties for inputs that must not change.
- Markdown is linted by `rumdl` with the repo's `.rumdl.toml`: ATX headings, `-` bullets, fenced blocks with a language tag.
