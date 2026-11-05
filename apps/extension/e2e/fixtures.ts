import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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
  /** Panel **chua** hoan thanh onboarding (lan dau mo). */
  sidePanelFresh: Page
}

/** Tham so launch Chrome voi extension load unpacked. */
function launchArgs(): string[] {
  return [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
  ]
}

/** Lay extension id tu service worker. */
async function readExtensionId(context: BrowserContext): Promise<string> {
  let worker = context.serviceWorkers()[0]
  if (!worker) {
    worker = await context.waitForEvent('serviceworker')
  }
  const url = worker.url()
  const match = /^chrome-extension:\/\/([a-p]{32})\//.exec(url)
  if (!match?.[1]) {
    throw new Error(`Khong lay duoc extension id tu ${url}`)
  }
  return match[1]
}

/**
 * Danh dau onboarding da hoan thanh trong storage cua extension.
 *
 * Mo mot trang extension, set co, roi dong lai → moi page mo sau do thay
 * onboarding da xong (khong che man hinh chat).
 */
async function seedOnboardingCompleted(context: BrowserContext): Promise<void> {
  const extensionId = await readExtensionId(context)
  const page = await context.newPage()
  try {
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)
    await page.evaluate(async () => {
      await chrome.storage.local.set({ 'sidekick.onboarding.completed': true })
    })
  } finally {
    await page.close()
  }
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
      args: launchArgs(),
    })

    // FR-UX-02 (T-M1-25): onboarding hien thi o lan dau → danh dau "da hoan
    // thanh` cho **ca context** truoc khi mo panel. Cach nay dam bao ca
    // spec nao tu tao page rieng (`context.newPage()`) cung khong bi man hinh
    // onboarding che.
    await seedOnboardingCompleted(context)

    await use(context)
    await context.close()
  },

  extensionId: async ({ context }, use) => {
    await use(await readExtensionId(context))
  },

  sidePanel: async ({ context, extensionId }, use) => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)

    await use(page)
    await page.close()
  },

  // Panel onboarding dung **context rieng** (profile tam) → storage tach biet
  // voi fixture `sidePanel`, khong anh huong nhau khi mot test dung ca hai.
  sidePanelFresh: async ({ browserName: _browserName }, use) => {
    if (!existsSync(join(EXTENSION_PATH, 'manifest.json'))) {
      throw new Error('Chua build extension. Chay `pnpm build:ext` truoc khi chay E2E.')
    }

    const userDataDir = await mkdtemp(join(tmpdir(), 'sidekick-onboarding-'))
    const freshContext = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: launchArgs(),
    })

    try {
      const extensionId = await readExtensionId(freshContext)
      const page = await freshContext.newPage()
      await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)

      // Xoá co "da hoan thanh" → panel mo ra se hien thi onboarding 3 buoc.
      await page.evaluate(async () => {
        await chrome.storage.local.remove('sidekick.onboarding.completed')
      })
      await page.reload()

      await use(page)
      await page.close()
    } finally {
      await freshContext.close()
      await rm(userDataDir, { recursive: true, force: true })
    }
  },
})

export { expect } from '@playwright/test'