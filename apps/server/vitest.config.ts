import { defineConfig } from 'vitest/config'

/**
 * Vitest config cho server.
 * Docs: docs/SYSTEM_DESIGN.md §7
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/providers/**', 'src/lib/**', 'src/services/**'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
})
