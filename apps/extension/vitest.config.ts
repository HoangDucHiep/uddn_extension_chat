import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * Vitest config rieng cho extension (kh dung config cua Vite build).
 * Docs: docs/SYSTEM_DESIGN.md §7 (test)
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
  },
})
