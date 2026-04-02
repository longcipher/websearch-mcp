# Bun Workspace Template

High-performance TypeScript backend monorepo template using Bun workspaces, Gherkin + `@cucumber/cucumber` for BDD, Vitest for TDD, Biome, and Ultracite.

## Features

- `apps/` + `packages/` workspace layout
- CLI example (`apps/cli-app`) using `node:util` parseArgs
- Shared library (`packages/common`)
- BDD acceptance tests with Gherkin + `@cucumber/cucumber`
- TDD inner loop with Vitest
- Property tests with `fast-check` inside the standard Vitest run
- Optional fuzzing with `jazzer.js` for parser-like or security-sensitive packages
- Optional benchmarks with Vitest Bench when a feature has explicit performance goals
- Strict TypeScript configuration
- Linting and formatting via Biome + Ultracite
- `just` commands for format/lint/test/bdd/build
- Changelog generation via `git-cliff`

## Quick Start

```bash
just setup
just lint
just test
just bdd
just test-all

# Run the example CLI
bun run apps/cli-app/src/index.ts --name Bun
```

## Testing Matrix

- BDD via `features/*.feature` plus `just bdd` remains the acceptance contract.
- Example-based Vitest tests in `apps/*/src/*.test.ts` or `packages/*/src/*.test.ts` remain the default inner loop for named business cases and edge cases.
- `fast-check` properties live in those same `*.test.ts` files and run through `just test` when the rule is an invariant across many valid inputs.
- Advanced modes are opt-in: use `jazzer.js` only for hostile-input or parser-like packages, and use Vitest Bench only when the work has a real performance target.

## BDD + TDD Workflow

1. Write a failing Gherkin scenario in `features/*.feature`.
2. Drive the inner implementation with failing Vitest tests in `apps/*/src/*.test.ts` or `packages/*/src/*.test.ts`.
3. Start with example-based tests for named cases and edge cases you need to explain directly.
4. Add `fast-check` properties in the same `*.test.ts` files when you need to protect an invariant across many generated inputs.
5. Run `just test` so deterministic examples and generated property checks execute together.
6. Implement the smallest shared domain change that makes the inner loop pass, then re-run `just bdd` to confirm the business scenario is green.

Use example-based tests when a concrete input/output pair explains the rule clearly. Use property tests when the rule is an invariant, such as totals matching item arithmetic or checkout always clearing the cart regardless of cart shape.

Fuzzing is also opt-in. Reach for `jazzer.js` only when a package starts parsing hostile input, decoding protocol or binary payloads, or otherwise needs crash-oriented coverage beyond the normal BDD plus Vitest loop.

Benchmarks are opt-in. Use Vitest Bench for code with an explicit latency SLA, throughput target, or known hot path, and keep ordinary business logic on the normal `just test` plus `just bdd` loop. The existing `vitest.config.ts` already discovers `*.bench.ts`, so a separate default bench command is not required for this starter.

## Project Convention

- Put application packages under `apps/*`
- Put reusable library packages under `packages/*`
- Keep shared devDependencies in root `package.json`
- Use `workspace:*` for internal package references

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
