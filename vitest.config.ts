import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['**/src/**/*.ts'],
      exclude: ['**/src/**/*.test.ts', '**/node_modules/**', '**/dist/**'],
    },
    benchmark: {
      include: ['**/*.bench.ts'],
    },
  },
});
