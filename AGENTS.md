# Bun/TypeScript Workspace Agent Instructions

## Scope

- This template targets Bun + TypeScript backend workspaces only.
- `apps/` contains executable application packages.
- `packages/` contains reusable library packages.
- No frontend/React/browser-specific assumptions.

## Bun Workspace Rules (Critical)

1. Never manually edit dependency versions in `package.json`; use `bun add`.
2. Add root-level devDependencies with:

   ```bash
   bun add -d <package>
   ```

3. Add workspace-specific dependencies with:

   ```bash
   bun add <package> --filter <workspace-name>
   ```

4. Use `workspace:*` protocol for internal package references.
5. Shared devDependencies (`typescript`, `vitest`, `@biomejs/biome`) belong in the root `package.json`.
6. Each workspace package must have its own `package.json` with `scripts` for `build`, `test`, `lint`, `format`, `typecheck`, and `publint` (for packages under `packages/` only).
7. Always commit `bun.lock`.

## Preferred Dependencies and Versions

When introducing new dependencies, prefer these unless compatibility requires a change:

```json
// js
// lightweight, high-performance HTTP framework
hono >= 4.12.9
// type-safe SQL ORM
drizzle-orm >= 0.45.1
// Drizzle migration toolkit
drizzle-kit >= 0.31.10
// schema validation
zod >= 4.3.6
// typed functional effects and error handling
effect >= 3.21.0
// embedded PostgreSQL
@electric-sql/pglite >= 0.2
// synchronous SQLite for Bun
better-sqlite3 >= 12.8.0
// Redis client
ioredis >= 5.10.1
// high-performance structured logging
pino >= 10.3.1
// OpenTelemetry tracing
@opentelemetry/api >= 1.9
// OpenTelemetry SDK
@opentelemetry/sdk-node >= 0.57
// tiny ID generator
nanoid >= 5.1.7
// date manipulation
date-fns >= 4.1.0
// CLI framework (for complex CLIs)
commander >= 14.0.3
// lightweight CLI framework
citty >= 0.2.1
```

## Dependency Priority and Forbidden Choices

- HTTP framework preference: `hono` over `express` and `fastify`.
- ORM preference: `drizzle-orm` over `prisma` and `typeorm`.
- Validation preference: `zod` over `joi`, `yup`, and `io-ts`.
- Logging preference: `pino` over `winston` and `bunyan`.
- ID generation preference: `nanoid` over `uuid` (unless UUIDv4/v7 is required).
- Date preference: `date-fns` or `Temporal` (when stable) over `moment` and `dayjs`.
- Forbidden by default: `express` (use `hono`), `moment` (deprecated), `lodash` (use native), `axios` (use `fetch`).

## Engineering Principles

### TypeScript Implementation Guidelines

1. Type safety:
   - Enable `strict: true` in `tsconfig.json` — no exceptions.
   - Enable `noUncheckedIndexedAccess` for safe array/object access.
   - Enable `exactOptionalPropertyTypes` for precise optional handling.
   - Never use `as` type assertions unless absolutely necessary and documented.
   - Prefer `satisfies` operator over `as` for type narrowing.
   - Use `unknown` over `any`; justify every `any` with a comment.
2. Error handling:
   - Use typed error classes extending `Error` with discriminated unions.
   - Use `Result<T, E>` pattern (via `effect` or custom) for recoverable errors in libraries.
   - Never swallow errors with empty `catch {}` blocks.
   - Use `cause` property for error chaining (`new Error('msg', { cause: err })`).
3. Async patterns:
   - Default to `async/await` for all I/O operations.
   - Use `Promise.all()` for independent concurrent operations.
   - Use `Promise.allSettled()` when partial failures are acceptable.
   - Never use callbacks where Promises are available.
   - Use `AbortController` / `AbortSignal` for cancellation.
4. Observability:
   - Logging: `pino` with JSON output in production.
   - Metrics/traces: OpenTelemetry OTLP gRPC.
   - Never use `console.log` for logging in library/production code.
5. Configuration:
   - Use environment variables validated with `zod` or `@t3-oss/env-core`.
   - Prefer TOML or JSON configuration files.
6. Security:
   - Never hardcode secrets; use environment variables.
   - Validate all external input at system boundaries with `zod`.
   - Use parameterized queries; never concatenate SQL strings.

### Key Design Principles

- Modularity: Design each package so it can be used independently with clear boundaries and explicit exports.
- Performance: Prefer zero-copy patterns, streaming, pre-allocated buffers, and Bun-native APIs.
- Extensibility: Use TypeScript interfaces and generics for pluggable implementations.
- Type Safety: Maintain strong static typing across interfaces and internals; minimize use of `any`.

### Performance Considerations

- Use Bun-native APIs (`Bun.file()`, `Bun.write()`, `Bun.serve()`) over Node.js equivalents when available.
- Prefer `TypedArray` (`Uint8Array`, `Float64Array`) over plain arrays for numeric/binary data.
- Use streaming (`ReadableStream`, `TransformStream`) for large data processing instead of buffering.
- Prefer `Map` and `Set` over plain objects for dynamic key-value storage.
- Use `structuredClone()` over JSON parse/stringify for deep cloning.
- Profile before optimizing; use `bun:test`'s built-in benchmarking or `vitest bench`.

### Concurrency and Async Execution

- Use `Promise.all()` for parallel I/O; avoid sequential awaits when operations are independent.
- Use `Promise.allSettled()` when you need all results regardless of failures.
- Use `AbortController` for timeout and cancellation patterns.
- Use `AsyncLocalStorage` for request-scoped context (tracing, auth).
- Prefer `ReadableStream` for backpressure-aware data pipelines.
- Limit concurrent operations with semaphore patterns or `p-limit`.
- Use Web Workers (`new Worker()`) for CPU-bound parallel processing.
- Channel selection:
  - Request-scoped context: `AsyncLocalStorage`
  - Stream processing: `ReadableStream` / `TransformStream` / `WritableStream`
  - CPU parallelism: Bun Workers
  - Avoid `child_process.fork()` when Workers suffice

### Memory and Allocation

- Use `Uint8Array` and `Buffer` for binary data; avoid string-based binary manipulation.
- Prefer `Bun.ArrayBufferSink` for high-throughput binary output.
- Use `WeakMap` / `WeakRef` for caches that should not prevent garbage collection.
- Avoid closure captures of large objects in long-lived callbacks or event handlers.
- Use object pooling for objects that are created and destroyed in hot paths.
- Prefer `flatMap()` over `map().flat()` to avoid intermediate array allocation.
- Use `for...of` loops over `forEach()` for better V8/JSC optimization.

### Type and Data Layout

- Use `interface` for object shapes that may be extended; `type` for unions and computed types.
- Use `as const` for literal type inference on configuration objects.
- Use discriminated unions (`type: 'success' | 'error'`) for result types.
- Use branded types (`type UserId = string & { __brand: 'UserId' }`) for domain primitives.
- Keep error types lightweight; avoid attaching large payloads to Error subclasses.
- Use `readonly` modifier on properties and arrays that should not be mutated.
- Prefer `Record<K, V>` over `{ [key: string]: V }` for index signatures.

### Native Interop and FFI

- Use `bun:ffi` for calling native C/Rust libraries directly from Bun.
- Keep the JS ↔ native boundary coarse-grained; minimize per-call overhead.
- Use `CString`, `ptr`, and typed arrays for memory-safe FFI interactions.
- Prefer Bun's built-in native modules (SQLite, hashing) over npm packages wrapping the same.

### Tooling and Quality

- Lint and format with Biome — all code must pass `biome check` with zero errors.
- Apply Ultracite conventions for additional opinionated formatting.
- Type check with `tsc --noEmit` — all code must pass with zero errors.
- Use Gherkin + `@cucumber/cucumber` for outer-loop acceptance tests.
- Use Vitest for inner-loop TDD — tests must pass before claiming completion.
- Use `vitest bench` for performance-sensitive code.
- Validate package.json publish correctness with `publint` for all packages under `packages/`.

### Common Pitfalls

- Do not use `any` without explicit justification in a comment.
- Do not use `!` (non-null assertion) without verifying the value is guaranteed non-null.
- Do not use `enum`; prefer `as const` objects or union types.
- Do not mutate function parameters; treat them as immutable.
- Do not use default exports; prefer named exports for better refactoring and tree-shaking.
- Use ESM `import` consistently; avoid mixing `require()` and `import`.
- Always use `const` (preferred) or `let`; never use `var`.

### What to Avoid

- Incomplete implementations: finish features before submitting.
- Large, sweeping changes: keep changes focused and reviewable.
- Mixing unrelated changes: keep one logical change per commit.
- Using `@ts-ignore` without a specific error code and justification comment.

## Development Workflow

When fixing failures, identify root cause first, then apply idiomatic fixes instead of suppressing warnings or patching symptoms.

Use outside-in development for behavior changes:

- **Git Restrictions:** NEVER use `git worktree`. All code modifications MUST be made directly on the current branch in the existing working directory.
- start with a failing Gherkin scenario under `features/`,
- drive implementation with failing Vitest tests,
- keep example-based Vitest tests as the default inner loop for named cases and edge cases,
- add `fast-check` properties in the same `*.test.ts` files when the rule is an invariant instead of a single named example,
- treat `jazzer.js` as conditional work for parser-like, protocol, binary-decoding, or otherwise hostile-input packages instead of baseline template scaffolding,
- make the scenario pass without duplicating business logic in step definitions.

After each feature or bug fix, run:

```bash
just format
just lint
just test
just bdd
just test-all
just publint
```

If any command fails, report the failure and do not claim completion.

## Testing Requirements

- BDD scenarios: place Gherkin features under `features/` and step definitions under `features/step_definitions/`.
- Use BDD to define acceptance behavior first, then use Vitest for the inner TDD loop.
- Unit tests: colocate with source files (`*.test.ts` next to `*.ts`).
- Keep property tests in the same Vitest-discovered `*.test.ts` path used by `just test`; do not create a separate property-test command.
- Prefer example-based tests for concrete business cases and edge cases that should stay readable in one example.
- Prefer `fast-check` properties for invariants that should hold across many valid inputs, such as arithmetic totals, preserved item order, or checkout clearing the cart.
- Fuzz tests: only plan or add `jazzer.js` when a package parses hostile input, decodes protocol or binary payloads, or exposes other security-sensitive parsing boundaries.
- Fuzz workflow: when fuzzing is justified, add it only in the affected package instead of seeding a workspace-wide fuzz harness in every starter.
- Integration tests: place in workspace-level `tests/` or `__tests__/` directories.
- Performance tests: use `vitest bench` with `*.bench.ts` files only when the work has an explicit latency SLA, throughput target, or known hot path.
- The existing Vitest benchmark discovery is sufficient for the template; do not add a separate benchmark command unless the project has a real workflow need for one.
- For `/pb-plan` work, mark fuzzing as `conditional` or `N/A` unless the scope explicitly includes parser-like, protocol, binary-decoding, or hostile-input code.
- Add tests for behavioral changes and public API changes.
- Use Vitest's `describe`/`it`/`expect` API consistently.
- Use `vi.mock()` for module mocking; `vi.spyOn()` for spy-based testing.
- Use `beforeEach`/`afterEach` for setup/teardown.
- Keep step definitions thin and delegate business rules to shared TypeScript modules.

## Language Requirement

- Documentation, comments, and commit messages must be English only.
