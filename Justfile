# Default recipe to display help
default:
  @just --list

# Install all dependencies
install:
  bun install

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

# Run tests
test:
  bun run --filter '*' test

# Run BDD scenarios
bdd:
  bun run bdd

# Run both TDD and BDD suites
test-all:
  bun run test:all

# Run tests with coverage
test-coverage:
  bunx vitest run --coverage

# Build all packages
build:
  bun run --filter '*' build

# Type check all packages
typecheck:
  bun run --filter '*' typecheck

# Check for Chinese characters
check-cn:
  rg --line-number --column "\p{Han}"

# Lint package.json for publish correctness
publint:
  bun run --filter 'packages/*' publint

# Full CI check
ci: lint test-all build publint

# ============================================================
# Maintenance & Tools
# ============================================================

# Clean build artifacts
clean:
  rm -rf node_modules
  find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
  find . -type d -name dist -exec rm -rf {} + 2>/dev/null || true

# Install all required development tools
setup:
  bun install
  cargo install typos-cli

# Update all dependencies
update:
  bun update --latest
