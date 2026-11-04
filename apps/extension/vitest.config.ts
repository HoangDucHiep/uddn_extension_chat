import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * Vitest config rieng cho extension (khong dung config cua Vite build).
 *
 * ALIAS `@sidekick/shared` -> `packages/shared/src` (nguon su that):
 * - Khong phai resolve qua `packages/shared/dist` (ban build) → test se
 *   chay tren CODE CU khi `src` vua sua ma quen build.
 * - Khong can `pnpm build` truoc khi `pnpm test` → fresh clone chay duoc.
 * Docs: docs/SYSTEM_DESIGN.md §7
 */

const SHARED_SRC = resolve(import.meta.dirname, '../../packages/shared/src')

export default defineConfig({
  resolve: {
    alias: [
      // Thuong dung `@sidekick/shared/constants` → phai khai bao TRUOC
      // alias chung `@sidekick/shared` de khong bi che.
      {
        find: /^@sidekick\/shared\/constants$/,
        replacement: resolve(SHARED_SRC, 'constants.ts'),
      },
      {
        find: /^@sidekick\/shared$/,
        replacement: resolve(SHARED_SRC, 'index.ts'),
      },
      {
        find: '@',
        replacement: resolve(import.meta.dirname, './src'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
  },
})
