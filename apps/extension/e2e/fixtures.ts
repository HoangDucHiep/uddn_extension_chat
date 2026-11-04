import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EXTENSION_PATH = resolve(__dirname, '..', 'dist')

/**
 * Fixture Playwright — launch Chrome voi extension load unpacked.
 *
 * Chi ho tro extension trong headed mode (hoac headless=new cua Chrome >= 112).
 * Docs: docs/SYSTEM_DESIGN.md §7 (E2E)
 */
export interface ExtensionFixtures {
  context: BrowserContext
  extensionId: string
  sidePanel: Page
}

export const test = base.extend<ExtensionFixtures>({
  context: async (_fixtures, use) => {
    if (!existsSync(join(EXTENSION_PATH, 'manifest.json'))) {
      throw new Error('Chua build extension. Chay `pnpm build:ext` truoc khi chay E2E.')
    }

    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    })

    await use(context)
    await context.close()
  },

  extensionId: async ({ context }, use) => {
    let worker = context.serviceWorkers()[0]
    if (!worker) {
      worker = await context.waitForEvent('serviceworker')
    }
    const url = worker.url()
    const match = /^chrome-extension:\/\/([a-p]{32})\//.exec(url)
    if (!match?.[1]) {
      throw new Error(`Khong lay duoc extension id tu ${url}`)
    }
    await use(match[1])
  },

  sidePanel: async ({ context, extensionId }, use) => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)
    await use(page)
    await page.close()
  },
})

export { expect } from '@playwright/test'
