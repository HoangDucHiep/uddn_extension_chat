import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EXTENSION_PATH = resolve(__dirname, '..', 'dist')

/**
 * Fixture Playwright — launch Chrome voi extension load unpacked.
 *
 * Dung `channel: 'chromium'` vi day la ban Chromium moi ho tro
 * `--load-extension`; Chromium cu (headless shell) khong nap duoc.
 * Docs: docs/SYSTEM_DESIGN.md §7 (E2E)
 */
export interface ExtensionFixtures {
  context: BrowserContext
  extensionId: string
  sidePanel: Page
}

export const test = base.extend<ExtensionFixtures>({
  // Playwright yeu cau tham so dau tien la object destructuring.
  context: async ({ browserName: _browserName }, use) => {
    if (!existsSync(join(EXTENSION_PATH, 'manifest.json'))) {
      throw new Error('Chua build extension. Chay `pnpm build:ext` truoc khi chay E2E.')
    }

    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
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
