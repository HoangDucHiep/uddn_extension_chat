import { expect, type BrowserContext, type Page, type Worker } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: selection context — bôi đen trên trang → đính kèm vào context
 * (T-M1-02, FR-CONTEXT-04).
 *
 * Kiem chung:
 *  - (1) Bôi đen tren trang that → nut nobi "Hoi Sidekick" xuat hien →
 *    click → service worker luu doan chon vao storage.
 *  - (2) Panel dang mo → click nut nobi → panel tu dinh kem → chip
 *    `data-tier="selection"` xuat hien.
 *  - (3) Duong B: nut "Dinh doan da chon" trong panel → chip xuat hien.
 *  - (4) Gui cau hoi → request co `context.items[0].tier === 'selection'`.
 *  - (5) Thu tu uu tien: dinh kem ca tab + selection → `items[0]` la selection.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.4
 */

interface CapturedChatRequest {
  context?: {
    items?: Array<{ id?: string; kind?: string; tier?: string; title?: string; text?: string }>
  }
}

/** SSE stream gia lap. */
const SSE_BODY = [
  'event: meta',
  'data: {"type":"meta","messageId":"msg-1","conversationId":"11111111-1111-4111-8111-111111111111","provider":"mock","model":"mock-model","keySource":"K1","requestId":"req-1"}',
  '',
  'event: token',
  'data: {"type":"token","delta":"Da nhan","index":0}',
  '',
  'event: done',
  'data: {"type":"done","finishReason":"stop","messageId":"msg-1"}',
  '',
  '',
].join('\n')

/** Doan text mau de boi den. */
const SELECTED_TEXT =
  'Doan van ban duoc boi den tren trang web de gui sang Sidekick AI lam context.'

/** HTML fixture — trang co mot doan text de boi den. */
const PAGE_HTML = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>Bai viet mau</title>
  </head>
  <body>
    <article>
      <h1>Bai viet mau</h1>
      <p id="doan">${SELECTED_TEXT}</p>
      <p>Doan van thu hai khong lien quan.</p>
    </article>
  </body>
</html>`

/**
 * Giu lai request body gui len BFF de assert.
 */
async function stubChat(panel: Page): Promise<CapturedChatRequest[]> {
  const captured: CapturedChatRequest[] = []

  await panel.route('**/api/chat', async (route) => {
    const raw = route.request().postData()
    if (raw !== null) {
      captured.push(JSON.parse(raw) as CapturedChatRequest)
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: SSE_BODY,
    })
  })

  return captured
}

/**
 * Mock `chrome.tabs` + `chrome.scripting` trong panel.
 *
 * `executeScript` tra ve selection gia lap o lan goi dau tien (duong B) va
 * noi dung trang o cac lan goi sau (duong A - "Them trang nay").
 */
async function mockChrome(panel: Page): Promise<void> {
  await panel.addInitScript(() => {
    const tab = {
      id: 888,
      url: 'https://example.com/bai-viet',
      title: 'Bai viet mau',
      active: true,
      windowId: 1,
    }

    const chromeApi = globalThis.chrome as unknown as {
      tabs: {
        query: (query: { active?: boolean }) => Promise<unknown[]>
        get: () => Promise<unknown>
      }
      scripting: {
        executeScript: (injection: unknown) => Promise<unknown[]>
      }
    }

    chromeApi.tabs.query = async (query: { active?: boolean }) => {
      void query
      return [tab]
    }
    chromeApi.tabs.get = async () => tab
    chromeApi.scripting.executeScript = async (injection: unknown) => {
      const func = (injection as { func?: unknown } | undefined)?.func
      const source = typeof func === 'function' ? func.toString() : ''

      // Ham doc selection (duong B) → tra selection gia lap.
      if (source.includes('getSelection')) {
        return [
          {
            result: {
              text: 'Doan van ban dang boi tren trang de gui sang Sidekick AI lam context.',
              title: 'Bai viet mau',
              url: 'https://example.com/bai-viet',
            },
          },
        ]
      }

      return [
        {
          result: {
            title: 'Bai viet mau',
            byline: '',
            url: 'https://example.com/bai-viet',
            text: 'Noi dung chinh cua trang khi them tab.',
            excerpt: 'Noi dung chinh cua trang.',
            strategy: 'article',
            wordCount: 8,
          },
        },
      ]
    }
  })
}

/**
 * Mo trang that + boi den mot doan text.
 *
 * Content script chay trong "isolated world" → phai dung `page.evaluate`
 * de tao selection trong DOM.
 */
async function selectTextOnPage(page: Page): Promise<void> {
  await page.evaluate(() => {
    const paragraph = document.getElementById('doan')
    if (paragraph === null) return

    const range = document.createRange()
    range.selectNodeContents(paragraph)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  })
}

/** Lay service worker (noi co `chrome.storage` + `chrome.sidePanel`). */
async function getWorker(context: BrowserContext): Promise<Worker> {
  let worker = context.serviceWorkers()[0]
  if (!worker) {
    worker = await context.waitForEvent('serviceworker')
  }
  return worker
}

test('boi den → nut nobi xuat hien → click → SW luu doan chon vao storage', async ({
  context,
}) => {
  const page = await context.newPage()
  await page.route('http://sidekick.test/bai-viet', (route) => {
    route.fulfill({ status: 200, contentType: 'text/html', body: PAGE_HTML })
  })
  await page.goto('http://sidekick.test/bai-viet')

  // Cho content script inject xong (document_idle).
  await page.waitForTimeout(1000)

  await selectTextOnPage(page)
  await page.mouse.up()

  // Nut nobi nam trong shadow DOM → locator xuyen qua shadow root.
  const affordance = page.locator('[data-testid="selection-affordance"]')
  await expect(affordance).toBeVisible({ timeout: 20_000 })

  await affordance.click()

  const worker = await getWorker(context)
  const stored = (await worker.evaluate(async () => {
    const data = await chrome.storage.local.get('sidekick.pendingSelection')
    return data['sidekick.pendingSelection'] ?? null
  })) as { text?: string } | null

  expect(stored).not.toBeNull()
  expect(stored?.text).toContain('boi den')

  await page.close()
})

test('panel dang mo → click nut nobi → panel tu dinh kem chip selection', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage()
  await page.route('http://sidekick.test/bai-viet', (route) => {
    route.fulfill({ status: 200, contentType: 'text/html', body: PAGE_HTML })
  })
  await page.goto('http://sidekick.test/bai-viet')
  await page.waitForTimeout(1000)

  const panel = await context.newPage()
  await mockChrome(panel)
  await stubChat(panel)
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await selectTextOnPage(page)
  await page.mouse.up()

  const affordance = page.locator('[data-testid="selection-affordance"]')
  await expect(affordance).toBeVisible({ timeout: 20_000 })
  await affordance.click()

  const chip = panel.getByTestId('context-chip')
  await expect(chip).toBeVisible({ timeout: 20_000 })
  await expect(chip).toHaveAttribute('data-tier', 'selection')

  await panel.close()
  await page.close()
})

test('duong B: nut "Dinh doan da chon" trong panel → chip selection', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await mockChrome(panel)
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('context-add-selection').click()

  const chip = panel.getByTestId('context-chip')
  await expect(chip).toBeVisible({ timeout: 20_000 })
  await expect(chip).toHaveAttribute('data-tier', 'selection')
  await expect(chip).toHaveAttribute('data-item-id', /^selection-/)

  await panel.close()
})

test('gui cau hoi → request co context.items[0].tier === selection', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await mockChrome(panel)
  const captured = await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('context-add-selection').click()
  await expect(panel.getByTestId('context-chip')).toBeVisible({ timeout: 20_000 })

  await panel.getByTestId('composer-input').fill('Yeu cau dinh nghia doan nay')
  await panel.getByTestId('composer-send').click()
  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  await expect.poll(() => captured.length, { timeout: 20_000 }).toBeGreaterThan(0)

  const request = captured[0]
  expect(request?.context?.items).toHaveLength(1)
  expect(request?.context?.items?.[0]?.tier).toBe('selection')
  expect(request?.context?.items?.[0]?.kind).toBe('selection')

  await panel.close()
})

test('thu tu uu tien: selection duoc dat truoc tab trong context', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await mockChrome(panel)
  const captured = await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Them tab truoc (tier `attachment`).
  await panel.getByTestId('context-add-tab').click()
  await expect(panel.getByTestId('context-chip')).toHaveCount(1, { timeout: 20_000 })

  // Them selection sau (tier `selection` — cao hon).
  await panel.getByTestId('context-add-selection').click()
  await expect(panel.getByTestId('context-chip')).toHaveCount(2, { timeout: 20_000 })

  await panel.getByTestId('composer-input').fill('So sanh')
  await panel.getByTestId('composer-send').click()
  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  await expect.poll(() => captured.length, { timeout: 20_000 }).toBeGreaterThan(0)

  const items = captured[0]?.context?.items ?? []
  expect(items).toHaveLength(2)
  // Tier `selection` phai dung dau.
  expect(items[0]?.tier).toBe('selection')
  expect(items[1]?.tier).toBe('attachment')

  await panel.close()
})
