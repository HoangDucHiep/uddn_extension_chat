import { defineConfig } from '@playwright/test'

/**
 * Playwright config — E2E cho Chrome extension.
 *
 * Load unpacked extension tu `dist/` roi mo side panel.
 * Docs: docs/SYSTEM_DESIGN.md §7 (E2E)
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
