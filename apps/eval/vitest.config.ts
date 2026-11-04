import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * Vitest config cho apps/eval.
 *
 * ALIAS `@sidekick/shared` -> `packages/shared/src` (nguon su that):
 * giong apps/extension + apps/server — test phai chay tren source, khong
 * phai ban build trong `packages/shared/dist`.
 * Docs: docs/SYSTEM_DESIGN.md §7
 */

const SHARED_SRC = resolve(import.meta.dirname, '../../packages/shared/src')

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@sidekick\/shared\/constants$/,
        replacement: resolve(SHARED_SRC, 'constants.ts'),
      },
      {
        find: /^@sidekick\/shared$/,
        replacement: resolve(SHARED_SRC, 'index.ts'),
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
