import { expect, type BrowserContext, type Page, type Worker } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: service worker — toggle panel · context menu · phim tat
 * (T-M1-03, FR-UX-01).
 *
 * Kiem chung:
 *  - (1) Native toggle `openPanelOnActionClick` da bat (top-level SW).
 *  - (2) Phim tat `Ctrl+Shift+K` duoc khai bao trong manifest + SW da
 *        dang ky listener `chrome.commands.onCommand`.
 *  - (3) Context menu da dang ky (id `sidekick-open` ton tai → `create` lai
 *        bao duplicate).
 *  - (4) Vong doi mo/dong panel → trang thai `sidekick.panelOpen` trong
 *        `chrome.storage.session` cap nhat dung (event `onOpened`/`onClosed`).
 *
 * Ghi chu: Playwright **khong** kich hoat duoc accelerator cua browser
 * (extension command) trong headless — da verify ca `page.keyboard.press`
 * va `Input.dispatchKeyEvent` qua CDP deu khong toi `chrome.commands`.
 * Phan "bam phim tat" duoc cover bang unit test (`tests/commands.test.ts`);
 * E2E assert **dang ky** shortcut + **vong doi** trang thai panel.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.13
 */

/** Lay service worker cua extension. */
async function getWorker(context: BrowserContext): Promise<Worker> {
  let worker = context.serviceWorkers()[0]
  if (!worker) {
    worker = await context.waitForEvent('serviceworker')
  }
  return worker
}

/** Doc trang thai panel trong `chrome.storage.session` tu service worker. */
async function readPanelOpenState(worker: Worker): Promise<unknown> {
  return await worker.evaluate(async () => {
    const stored = await chrome.storage.session.get('sidekick.panelOpen')
    return stored['sidekick.panelOpen']
  })
}

/**
 * Inject nut probe vao trang extension de mo/dong panel bang **user
 * gesture that** (Playwright click → Chrome cap nhan gesture).
 *
 * @param page - Trang extension.
 * @param action - `open` hoac `close`.
 */
async function injectPanelProbe(page: Page, action: 'open' | 'close'): Promise<void> {
  await page.evaluate((mode) => {
    const existing = document.getElementById('probe-panel-action')
    if (existing !== null) existing.remove()

    const button = document.createElement('button')
    button.id = 'probe-panel-action'
    button.type = 'button'
    button.textContent = mode
    button.addEventListener('click', () => {
      void chrome.windows.getCurrent().then((win) => {
        if (win?.id === undefined) return
        if (mode === 'open') {
          return chrome.sidePanel.open({ windowId: win.id })
        }
        return chrome.sidePanel.close({ windowId: win.id })
      })
    })
    document.body.appendChild(button)
  }, action)
}

test('native toggle openPanelOnActionClick da bat', async ({ context }) => {
  const worker = await getWorker(context)

  const behavior = await worker.evaluate(async () => {
    const result = await chrome.sidePanel.getPanelBehavior()
    return { openPanelOnActionClick: result.openPanelOnActionClick === true }
  })

  expect(behavior.openPanelOnActionClick).toBe(true)
})

test('phim tat Ctrl+Shift+K duoc khai bao cho command toggle panel', async ({ context }) => {
  const worker = await getWorker(context)

  const commands = await worker.evaluate(async () => {
    const all = await chrome.commands.getAll()
    return {
      items: all.map((item) => ({
        name: item.name ?? '',
        shortcut: item.shortcut ?? '',
      })),
      hasListener: chrome.commands.onCommand.hasListeners(),
    }
  })

  const toggle = commands.items.find((item) => item.name === 'sidekick-toggle-panel')
  expect(toggle).toBeDefined()
  expect(toggle?.shortcut).toBe('Ctrl+Shift+K')

  // Service worker da dang ky handler command.
  expect(commands.hasListener).toBe(true)
})

test('context menu da dang ky (id sidekick-open ton tai)', async ({ context }) => {
  const worker = await getWorker(context)

  // `chrome.contextMenus` khong co API list → tao lai id da co de kiem tra
  // Chrome bao "duplicate id" (nghia la menu da ton tai).
  const duplicateError = await worker.evaluate(async () => {
    return await new Promise<string | null>((resolve) => {
      chrome.contextMenus.create(
        { id: 'sidekick-open', title: 'probe', contexts: ['page'] },
        () => {
          resolve(chrome.runtime.lastError?.message ?? null)
        },
      )
    })
  })

  expect(duplicateError).not.toBeNull()
  expect(duplicateError?.toLowerCase()).toContain('duplicate')
})

test('mo/dong panel → trang thai sidekick.panelOpen cap nhat dung', async ({
  context,
  extensionId,
}) => {
  const worker = await getWorker(context)

  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Panel chua mo → state phai la false (hoac undefined).
  await expect
    .poll(async () => await readPanelOpenState(worker))
    .not.toBe(true)

  // Mo panel bang user gesture that → event `onOpened` → state = true.
  await injectPanelProbe(page, 'open')
  await page.locator('#probe-panel-action').click()

  await expect.poll(async () => await readPanelOpenState(worker)).toBe(true)

  // Dong panel → event `onClosed` → state = false.
  await injectPanelProbe(page, 'close')
  await page.locator('#probe-panel-action').click()

  await expect.poll(async () => await readPanelOpenState(worker)).toBe(false)

  await page.close()
})
