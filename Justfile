# Justfile — websearch-mcp is a Bun workspace around one MCP server.
#
# `apps/` holds the runnable apps, `packages/` the libraries. The CI
# workflow installs Bun, just, typos and rumdl, then runs `just install`
# followed by `just ci` — keep those two recipe names working.
#
# `biome`, `ultracite`, `typescript`, `vitest` and `publint` come from the
# workspace `devDependencies`; `typos` and `rumdl` are installed by the
# CI workflow or by `just setup`.

# Default recipe to display help
default:
  @just --list

# Install all dependencies
install:
  bun install

# Install all dependencies and the dev tools this Justfile needs
setup:
  bun install
  cargo install typos-cli

# Format all code
format:
  rumdl fmt .
  bunx biome check --fix .
  bunx ultracite fix

# Auto-fix linting issues
fix:
  rumdl check --fix .
  bunx biome check --fix .

# Run all lints
lint:
  typos
  rumdl check .
  bunx biome check .
  bun run --filter '*' typecheck

# Run the test suite of every workspace package
test:
  bun run --filter '*' test

# Run every test suite from the workspace root
test-all:
  bun run test:all

# Run the tests with coverage
test-coverage:
  bunx vitest run --coverage

# Build all packages
build:
  bun run --filter '*' build

# Type check all packages
typecheck:
  bun run --filter '*' typecheck

# Lint package.json for publish correctness
publint:
  bun run --filter 'packages/*' publint

# Fail if Chinese characters appear anywhere
check-cn:
  ! rg --line-number --column "\p{Han}" .

# Full CI check
ci: lint test-all build publint

# ============================================================
# Maintenance & Tools
# ============================================================

# Remove build artifacts
clean:
  rm -rf node_modules
  find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
  find . -type d -name dist -exec rm -rf {} + 2>/dev/null || true

# Update all dependencies
update:
  bun update --latest
