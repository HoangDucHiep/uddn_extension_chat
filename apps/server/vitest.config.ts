import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * Vitest config cho server.
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
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // PDF/YouTube extractor parse file thuoc → cham hon giay. Khi chay song
    // song nhieu worker, may tai thap bi timeout gia (5s mac dinh).
    testTimeout: 30_000,
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
