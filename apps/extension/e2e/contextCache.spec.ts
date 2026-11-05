import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: cache context theo URL + hash (T-M1-06).
 *
 * Kiem chung:
 *  - (1) Bam "Them trang nay" 2 lan → chi co **1** chip (tab da dinh kem).
 *  - (2) Request gui di co `context.items[0].text` **khop** noi dung goc
 *        (cache khong lam sai du lieu).
 *  - (3) Cache duoc luu trong `chrome.storage.local` va dung lai khi trang
 *        dang loi (extractor tra ve rong).
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can server that.
 * Docs: docs/SYSTEM_DESIGN.md §7.3.5
 */

interface CapturedChatRequest {
  messages?: Array<{ role: string; content: string }>
  context?: { items?: Array<{ id?: string; tier?: string; title?: string; text?: string }> }
}

/** SSE stream gia lap. */
const SSE_BODY = [
  'event: meta',
  'data: {"type":"meta","messageId":"msg-1","conversationId":"11111111-1111-4111-8111-111111111111","provider":"mock","model":"mock-model","keySource":"K1","requestId":"req-1"}',
  '',
  'event: token',
  'data: {"type":"token","delta":"Xin chao","index":0}',
  '',
  'event: done',
  'data: {"type":"done","finishReason":"stop","messageId":"msg-1"}',
  '',
  '',
].join('\n')

/** Noi dung trang gia lap. */
const PAGE_TEXT = 'Day la noi dung chinh cua bai viet mau, rat dai va chi tiet.'

/** Giu lai request body gui len BFF de assert. */
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
 * Mock `chrome.tabs` + `chrome.scripting`.
 *
 * @param options.text - Noi dung extractor tra ve (chuoi rong → trang "hong doc duoc").
 */
async function mockHtmlTab(panel: Page, options: { text: string }): Promise<void> {
  await panel.addInitScript((pageText: string) => {
    const tab = {
      id: 777,
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

    chromeApi.tabs.query = async (query: { active?: boolean }) =>
      query && query.active ? [tab] : []
    chromeApi.tabs.get = async () => tab
    chromeApi.scripting.executeScript = async () => [
      {
        result: {
          title: 'Bai viet mau',
          byline: '',
          url: 'https://example.com/bai-viet',
          text: pageText,
          excerpt: pageText,
          strategy: 'article',
          wordCount: 16,
        },
      },
    ]
  }, options.text)
}

test('dinh kem 2 lan → chi 1 chip, context gui di dung noi dung goc', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await mockHtmlTab(panel, { text: PAGE_TEXT })
  const captured = await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('context-add-tab').click()
  await expect(panel.getByTestId('context-chip')).toBeVisible({ timeout: 20_000 })

  // Bam lai → van chi 1 chip (tab da dinh kem → khong nhan ban).
  await panel.getByTestId('context-add-tab').click()
  await expect(panel.getByTestId('context-chip')).toHaveCount(1)

  await panel.getByTestId('composer-input').fill('Tom tat trang nay')
  await panel.getByTestId('composer-send').click()

  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  const request = captured[0]
  expect(request?.context?.items).toHaveLength(1)
  // Cache khong lam sai du lieu: text gui di phai khop noi dung goc.
  expect(request?.context?.items?.[0]?.text).toBe(PAGE_TEXT)

  await panel.close()
})

test('cache context duoc luu vao chrome.storage.local', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await mockHtmlTab(panel, { text: PAGE_TEXT })
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('context-add-tab').click()
  await expect(panel.getByTestId('context-chip')).toBeVisible({ timeout: 20_000 })

  const cached = await panel.evaluate(async () => {
    const stored = await chrome.storage.local.get('sidekick.contextCache')
    return stored['sidekick.contextCache'] as Record<string, { text?: string }> | undefined
  })

  expect(cached).toBeDefined()
  const entries = Object.values(cached ?? {})
  expect(entries.length).toBeGreaterThan(0)
  expect(entries.some((entry) => entry.text === PAGE_TEXT)).toBe(true)

  await panel.close()
})

test('trang dang loi → fallback ve noi dung da cache', async ({ context, extensionId }) => {
  const panel = await context.newPage()

  // Lan 1: trang doc duoc → giu cache.
  await mockHtmlTab(panel, { text: PAGE_TEXT })
  await stubChat(panel)
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('context-add-tab').click()
  await expect(panel.getByTestId('context-chip')).toBeVisible({ timeout: 20_000 })

  // Lan 2: trang "hong doc duoc" (extractor rong) → phai fallback cache.
  const panel2 = await context.newPage()
  await mockHtmlTab(panel2, { text: '' })
  const captured2 = await stubChat(panel2)
  await panel2.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel2.getByTestId('context-add-tab').click()
  await expect(panel2.getByTestId('context-chip')).toBeVisible({ timeout: 20_000 })

  await panel2.getByTestId('composer-input').fill('Tom tat trang nay')
  await panel2.getByTestId('composer-send').click()

  await expect(panel2.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  const request = captured2[0]
  expect(request?.context?.items).toHaveLength(1)
  // Fallback: text lay tu cache cua lan truoc.
  expect(request?.context?.items?.[0]?.text).toBe(PAGE_TEXT)

  await panel2.close()
  await panel.close()
})
