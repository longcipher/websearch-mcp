# Unified Web Search MCP Server Design

## 1. Summary

This document defines a practical design for a new `web-search-mcp` server built with Bun, TypeScript, and Hono.

The target system combines:

- Kindly's strongest capability: source-aware, LLM-oriented content extraction for developer-centric sources.
- Orz-MCP's strongest capability: lightweight TypeScript implementation, free multi-engine search aggregation, proxy friendliness, and easy remote deployment.

The result is a single codebase that supports:

- local MCP usage over `stdio`
- local HTTP serving for testing and self-hosting
- serverless deployment over Streamable HTTP

The design is intentionally optimized for developer workflows rather than general-purpose web scraping.

## 2. Problem Statement

Current web-search MCP servers usually fail in one of two ways:

- They are good at finding URLs but weak at returning useful page content.
- They are good at extracting content but too heavy to deploy broadly.

The two reference projects illustrate this split clearly.

### 2.1 Kindly strengths

- Strong source-specific extraction pipeline.
- Specialized handling for StackExchange, GitHub Issues, GitHub Discussions, Wikipedia, and arXiv.
- Good timeout discipline and deterministic fallback notes instead of opaque failures.
- Diagnostic hooks that make operational debugging easier.
- Ability to return search results together with `page_content`, which reduces follow-up tool calls.

### 2.2 Kindly weaknesses

- Python runtime does not align with the current Bun workspace.
- Universal extraction relies on `nodriver` plus a local Chromium-based browser.
- Heavy browser dependency makes serverless deployment difficult and operationally expensive.
- Search provider selection is exclusive rather than aggregative: Serper wins over Tavily, Tavily wins over SearXNG, instead of combining sources.
- The runtime model is optimized for local power users, not portable TypeScript deployment.

### 2.3 Orz strengths

- TypeScript implementation with a small dependency surface.
- Parallel free search across Brave and DuckDuckGo.
- URL normalization and deduplication logic are simple and effective.
- Local proxy support is built into the stdio variant.
- Streamable HTTP deployment exists already using Hono on Netlify Functions.
- Tool surface is minimal and easy for MCP clients to understand: `web_search` and `web_fetch`.

### 2.4 Orz weaknesses

- Extraction quality is shallow for complex developer sources.
- HTML simplification is mostly regex-driven and can lose structure or keep noise.
- Business logic is duplicated across transports instead of being isolated in reusable modules.
- There is no source-specific resolver layer, so GitHub and StackOverflow pages are treated like generic HTML.
- Operational controls are limited: no structured diagnostics, limited fetch metadata, and limited failure taxonomy.

## 3. Design Goals

### 3.1 Primary goals

- Keep the implementation fully inside the Bun + TypeScript monorepo.
- Preserve a lightweight default runtime with no mandatory browser dependency.
- Make `web_search` useful in one call by optionally enriching the top results with structured `page_content`.
- Preserve a simple MCP tool surface for agents.
- Support both local `stdio` and remote Streamable HTTP from the same core logic.
- Run well on Bun locally and on Node-compatible serverless platforms through Hono.
- Keep the architecture modular enough that source adapters and search providers can be extended independently.

### 3.2 Secondary goals

- Support proxy configuration for local users behind restrictive networks.
- Favor free search providers by default, while allowing API providers to improve reliability when configured.
- Provide deterministic, bounded outputs under timeout, anti-bot, or unsupported-content conditions.
- Make the system testable with the repository's BDD plus TDD workflow.

### 3.3 Non-goals for the first version

- Browser automation in the default runtime.
- Full parity with Kindly's Python PDF pipeline.
- Cloudflare Workers or Vercel Edge as first-class targets.
- Full-document archival or crawler behavior.
- Sessionful remote MCP behavior that requires sticky load balancing.

## 4. Key Architectural Decisions

### 4.1 One shared core, multiple thin transports

The new server must not repeat the Orz pattern where transport and business logic are bundled together.

The architecture will split into three layers:

1. `packages/web-search-core`
   Responsible for search aggregation, content resolution, fetch policies, parsing, normalization, sanitization, and configuration.

2. `packages/web-search-mcp`
   Responsible for MCP tool registration, schemas, response shaping, and transport-agnostic server construction.

3. `apps/web-search-mcp`
   Responsible for executable entrypoints.
   This app package exposes a Bun `stdio` entrypoint and a Hono HTTP entrypoint.

This gives clean boundaries:

- core logic is reusable and unit-testable
- MCP behavior is centralized once
- runtime-specific code stays minimal

### 4.2 Streamable HTTP, not SSE, as the remote transport

The remote transport should be Streamable HTTP rather than SSE.

Reasons:

- Orz already proves the HTTP deployment shape is useful.
- The current MCP TypeScript SDK supports Streamable HTTP directly.
- Hono integrates cleanly with a fetch-style request/response model.
- Streamable HTTP works better than legacy SSE for serverless routing.

The remote server should default to stateless operation by using a transport configuration without server-side session persistence. This is important for multi-instance serverless deployments.

### 4.3 Serverless target scope

Hono is runtime-portable, but not every dependency in the extraction stack is edge-portable.

The first supported deployment targets are:

- Bun local process
- Bun self-hosted HTTP server
- Netlify Functions
- Vercel Functions
- AWS Lambda through a Hono-compatible adapter

Edge runtimes such as Cloudflare Workers should be marked as deferred until the extractor stack is verified without Node-heavy DOM shims.

## 5. Target Workspace Layout

The implementation should live in the existing workspace rather than inside the ignored reference directories.

```text
apps/
  web-search-mcp/
    package.json
    tsconfig.json
    src/
      cli.ts
      hono-app.ts
      bun-http.ts
      serverless.ts
      index.test.ts

packages/
  web-search-core/
    package.json
    tsconfig.json
    src/
      index.ts
      config.ts
      schemas.ts
      errors.ts
      logger.ts
      security/
        url-policy.ts
      search/
        aggregate.ts
        normalize.ts
        rank.ts
        providers/
          brave.ts
          duckduckgo.ts
          serper.ts
          tavily.ts
          searxng.ts
      content/
        resolve.ts
        universal/
          fetch-page.ts
          extract-main-content.ts
          markdown.ts
          sanitize.ts
        sources/
          github-issue.ts
          github-discussion.ts
          stackexchange.ts
          wikipedia.ts
          arxiv.ts
      search.test.ts
      resolve.test.ts

  web-search-mcp/
    package.json
    tsconfig.json
    src/
      index.ts
      server.ts
      tools/
        web-search.ts
        web-fetch.ts
        get-content.ts
      server.test.ts

features/
  web-search.feature
  web-fetch.feature
  step_definitions/
    web-search.steps.ts
    web-fetch.steps.ts

docs/
  design.md
```

## 6. Tool Surface

The canonical tool names should remain simple and compatible with existing MCP clients.

### 6.1 `web_search`

Purpose:
Search the web across multiple providers, deduplicate results, and enrich the top results with source-aware `page_content` when enabled.

Proposed input:

```json
{
  "query": "string",
  "num_results": 5,
  "include_page_content": true,
  "max_enriched_results": 3
}
```

Proposed output:

```json
{
  "query": "string",
  "num_results": 5,
  "results": [
    {
      "url": "string",
      "title": "string",
      "summary": "string",
      "source_providers": ["brave", "duckduckgo"],
      "content_kind": "github_issue",
      "fetch_status": "ok",
      "page_content": "string"
    }
  ]
}
```

Behavior:

- `include_page_content` defaults to `true` because that is the main value inherited from Kindly.
- `max_enriched_results` defaults to a small number such as `3` to keep latency and token use bounded.
- When enrichment is disabled, `fetch_status` becomes `not_requested`.

### 6.2 `web_fetch`

Purpose:
Fetch one URL and resolve it through the same source-aware pipeline used by `web_search`.

Proposed input:

```json
{
  "url": "string",
  "max_char_size": 50000
}
```

Proposed output:

```json
{
  "url": "string",
  "content_kind": "stackexchange",
  "fetch_status": "ok",
  "content_length": 12345,
  "content": "string"
}
```

### 6.3 `get_content`

Purpose:
Backward-compatible alias for clients or prompts that expect Kindly-style naming.

Behavior:

- Internally dispatches to `web_fetch`.
- Returns the same structured content shape.
- Marked as compatibility tooling in the tool description.

## 7. Search Architecture

### 7.1 Provider model

The new server should support two provider classes.

Class A: free providers

- Brave HTML search
- DuckDuckGo HTML search
- optional SearXNG instance

Class B: API providers

- Serper
- Tavily

Unlike Kindly, these providers should not be mutually exclusive. The aggregator should query all enabled providers concurrently, then merge results.

### 7.2 Aggregation policy

Search aggregation pipeline:

1. Build the active provider list from configuration.
2. Launch provider queries concurrently with provider-specific timeouts.
3. Normalize each result URL.
4. Filter ads, tracking URLs, and blocked domains.
5. Merge duplicates across providers.
6. Rank merged results.
7. Enrich only the top `K` results with `page_content`.

### 7.3 URL normalization

Normalization should remove low-value differences such as:

- `www.` prefixes
- trailing slashes
- common tracking query parameters such as `utm_*`, `fbclid`, `gclid`, `ref`, `spm`

This logic should be ported and extended from Orz's normalization routine.

### 7.4 Ranking heuristic

The ranking algorithm does not need machine learning.
It should be deterministic and transparent.

Recommended scoring signals:

- provider agreement: URLs seen in more than one provider move up
- provider confidence: API results can receive a mild boost when present
- result position: earlier positions score better
- trusted domain boost: GitHub, StackOverflow, MDN, vendor docs, RFCs
- ad or redirect penalty: already filtered whenever possible

This keeps the ranking understandable and easy to tune.

## 8. Content Resolution Architecture

### 8.1 Resolution order

The content resolver should follow a staged routing model inspired by Kindly.

1. GitHub Issue resolver
2. GitHub Discussion resolver
3. StackExchange resolver
4. Wikipedia resolver
5. arXiv resolver
6. Universal HTML resolver
7. Optional local-only renderer plugin in a future phase

This routing should be implemented through a common interface such as:

```ts
export interface ContentResolver {
  canHandle(url: URL): boolean;
  resolve(url: URL, context: ResolveContext): Promise<ResolvedContent | null>;
}
```

### 8.2 GitHub Issue and Discussion strategy

Preferred path:

- Use GitHub GraphQL or REST when `GITHUB_TOKEN` is available.
- Return title, body, comment thread, reactions, author metadata, timestamps, and permalink metadata.

Fallback path:

- Use targeted HTML extraction for public GitHub pages if the token is missing or rate-limited.
- Fall back to the universal extractor only if the targeted HTML path fails.

This preserves Kindly's strongest feature without requiring a browser.

### 8.3 StackExchange strategy

Use the StackExchange API first.

Returned structure should preserve:

- question title and body
- accepted answer marker
- answer ordering by accepted status and score
- author and timestamp metadata

This is one of the highest-value adapters because developer troubleshooting often depends on answer ordering.

### 8.4 Wikipedia strategy

Use MediaWiki APIs first and return cleaned article content in Markdown with title and section structure.

### 8.5 arXiv strategy

The first Bun implementation should be intentionally conservative.

Phase 1 behavior:

- fetch metadata and abstract through the arXiv API
- return canonical links and abstract-oriented content

Phase 2 behavior:

- optional PDF text extraction behind a feature flag if a Bun-compatible solution proves stable

This avoids blocking the Bun implementation on a difficult PDF pipeline port.

### 8.6 Universal HTML strategy

The universal resolver replaces Kindly's browser-heavy fallback.

Pipeline:

1. Fetch the URL with browser-like headers.
2. Enforce timeout, redirect, and response size limits.
3. Reject unsupported content types early.
4. Extract likely main content areas using selectors such as `main`, `article`, `[role=main]`, and common documentation containers.
5. Run a readability-style extraction pass as fallback.
6. Convert extracted HTML to Markdown.
7. Sanitize whitespace, code blocks, and truncation boundaries.

Recommended libraries:

- `cheerio` for selector-based extraction
- `@mozilla/readability` for fallback main-content extraction
- `turndown` for HTML-to-Markdown conversion

Important constraint:

If `jsdom` is used to support Readability, the first serverless target should remain Node-compatible serverless, not edge workers.

## 9. Runtime and Transport Design

### 9.1 Stdio mode

Use the MCP TypeScript SDK's `StdioServerTransport`.

Entry point responsibilities:

- load validated configuration
- build the shared MCP server instance
- connect via stdio transport
- log only to `stderr`

### 9.2 HTTP mode

Use Hono as the HTTP shell and the MCP SDK's Streamable HTTP transport for `/mcp`.

Routes:

- `GET /health` for health checks
- `GET /` for a small informational response
- `ALL /mcp` for MCP transport handling

The Hono app should be written once and exposed in two shapes:

- Bun local server entry
- serverless export entry

### 9.3 Stateless remote mode

Remote MCP should default to stateless HTTP mode.

Reasons:

- serverless instances may scale horizontally
- no need for sticky sessions
- the tool set is naturally request-bounded
- debugging becomes simpler when session state is not required

If future features require resumable long-lived sessions, that should be added as a separate mode rather than the default.

## 10. Configuration Model

Configuration must be environment-driven and validated with `zod`.

Recommended environment variables:

| Variable | Purpose |
|---|---|
| `SERPER_API_KEY` | Optional API search provider |
| `TAVILY_API_KEY` | Optional API search provider |
| `SEARXNG_BASE_URL` | Optional self-hosted search source |
| `GITHUB_TOKEN` | Better GitHub issue/discussion extraction |
| `HTTP_PROXY` / `HTTPS_PROXY` | Outbound proxy support |
| `WEB_SEARCH_TIMEOUT_MS` | Per-provider search timeout |
| `WEB_FETCH_TIMEOUT_MS` | Single page fetch timeout |
| `WEB_SEARCH_TOTAL_TIMEOUT_MS` | Total enrichment budget per `web_search` call |
| `WEB_SEARCH_MAX_CONCURRENCY` | Concurrent enrichment limit |
| `WEB_SEARCH_MAX_RESULTS` | Upper bound for returned results |
| `WEB_FETCH_MAX_CHARS` | Max returned content length |
| `ALLOW_PRIVATE_NETWORK_FETCH` | SSRF escape hatch for trusted local deployments |
| `LOG_LEVEL` | Structured logging level |

Preferred behavior:

- sensible defaults for local development
- strict validation at process start
- deterministic tool-level error notes when configuration is incomplete

## 11. Security and Safety Boundaries

This project is effectively a controlled web fetcher, so explicit safety boundaries are required.

### 11.1 URL policy

By default, allow only:

- `http:`
- `https:`

Reject by default:

- loopback addresses
- private IP ranges
- link-local addresses
- non-HTTP schemes

This protects serverless deployments from accidental SSRF exposure.

### 11.2 Response limits

Enforce:

- request timeouts
- redirect limits
- maximum response size
- maximum returned Markdown size

### 11.3 Logging hygiene

- Never log raw tokens.
- Never log full response bodies by default.
- Log structured metadata and bounded samples only.

## 12. Observability and Failure Model

The new implementation should adopt Kindly's disciplined failure behavior, but in TypeScript.

### 12.1 Structured logging

Use `pino` for logs.

Each request should emit:

- request id
- tool name
- provider list
- elapsed time
- timeout or failure reason

### 12.2 Deterministic failure notes

When content cannot be fetched, return a deterministic text note instead of an empty string.

Example:

```text
Failed to retrieve page content: TimeoutError
Source: https://example.com
```

This keeps MCP outputs useful to LLMs and easier to debug.

### 12.3 Failure taxonomy

Recommended internal error categories:

- `configuration_error`
- `provider_error`
- `timeout_error`
- `unsupported_content`
- `anti_bot_block`
- `security_block`
- `parse_error`

These categories should map to user-readable output while remaining available as structured metadata.

## 13. Testing Strategy

The repository already expects BDD plus TDD, so the design should use that workflow directly.

### 13.1 BDD scenarios

Add feature scenarios that verify behavior at the MCP contract level.

Required scenarios:

- `web_search` aggregates results from multiple providers and removes duplicates
- `web_search` enriches top results with `page_content`
- `web_fetch` returns structured GitHub issue content without page chrome
- `web_fetch` returns StackExchange answers ordered correctly
- HTTP `/mcp` works in stateless mode
- stdio entrypoint exposes the same tools as the HTTP entrypoint
- timeout failures return deterministic notes instead of crashing

### 13.2 Unit and integration tests

Unit-test targets:

- URL normalization
- ranking heuristics
- provider parsing
- source resolver routing
- universal HTML extraction sanitization
- URL security policy

Integration-test targets:

- MCP tool registration
- Hono `/mcp` transport handling
- Bun stdio smoke test

Fixture strategy:

- store representative HTML fixtures for GitHub, StackOverflow, docs pages, and generic articles
- use snapshot-like assertions only for stable Markdown blocks, not entire responses

## 14. Migration Strategy from the Reference Projects

The two reference directories should be treated as behavior references, not reusable runtime dependencies.

### 14.1 What to port conceptually from Kindly

- staged resolver routing
- source-aware Markdown rendering
- timeout budgeting
- deterministic fallback notes
- diagnostics mindset

### 14.2 What to port conceptually from Orz

- free-provider-first search aggregation
- URL normalization and deduplication
- proxy support
- simple tool naming
- Hono-based Streamable HTTP deployment shape

### 14.3 What not to port directly

- Kindly's Python runtime and `nodriver`
- Orz's duplicated transport-specific business logic
- Orz's regex-only content extraction strategy as the primary universal path

## 15. Delivery Phases

### Phase 1: Core skeleton

- scaffold `packages/web-search-core`
- scaffold `packages/web-search-mcp`
- scaffold `apps/web-search-mcp`
- implement `stdio` and stateless Hono HTTP transport
- implement provider config validation

### Phase 2: Search aggregation

- implement Brave and DuckDuckGo providers
- port normalization and dedup logic
- add ranking heuristic
- add `web_search` tool

### Phase 3: Content extraction

- implement `web_fetch`
- implement GitHub Issue, StackExchange, Wikipedia, and generic HTML resolvers
- add `get_content` alias

### Phase 4: Hardening

- add GitHub Discussions support
- add Serper, Tavily, and SearXNG providers
- add SSRF guardrails and structured logging
- add deployment templates for Netlify and Vercel

### Phase 5: Optional deep-content extensions

- evaluate arXiv PDF extraction
- evaluate local-only renderer fallback for JavaScript-heavy sites
- evaluate cache adapters for self-hosted deployments

## 16. Main Risks and Mitigations

### Risk 1: HTML scraping instability

Mitigation:

- prefer APIs for high-value sources
- keep HTML resolvers source-specific where possible
- maintain fixture-based regression tests

### Risk 2: Anti-bot blocking on free providers

Mitigation:

- support both free and API providers
- keep provider failures isolated
- degrade gracefully when only partial search coverage is available

### Risk 3: Serverless runtime mismatch

Mitigation:

- target Node-compatible serverless first
- keep extractor internals isolated from transport code
- defer edge runtimes until the dependency graph is verified

### Risk 4: Latency explosion when enriching search results

Mitigation:

- enrich only top `K` results
- use strict total timeout budgets
- cap concurrency
- return deterministic timeout notes instead of retry loops

## 17. Final Recommendation

The new server should not be a literal port of Kindly and should not be a cosmetic extension of Orz.

It should be a new Bun-native implementation with the following stance:

- Orz supplies the deployment and search-aggregation philosophy.
- Kindly supplies the content-resolution philosophy.
- Hono supplies the portable HTTP shell.
- the MCP TypeScript SDK supplies `stdio` and stateless Streamable HTTP transports.

This design is specific enough to implement in the current repository, honest about first-version limits, and preserves the most valuable behavior from both reference projects without inheriting their main operational weaknesses.