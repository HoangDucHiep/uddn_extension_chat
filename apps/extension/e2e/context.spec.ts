import { expect } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: model "attach chu dong" + meter ngan sach context (FR-CONTEXT-07).
 *
 * Kiem chung:
 *  - (1) Khong dinh kem gi → request **khong** co key `context` (chat thuan LLM).
 *  - (2) Bam "Them trang nay" → chip hien + request co `context.items[0]`.
 *  - (3) Meter hien "Da dung X / Y token".
 *  - (4) Tat toggle → request lai khong co `context`.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can server that.
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §8
 */

interface CapturedChatRequest {
  messages?: Array<{ role: string; content: string }>
  context?: { items?: Array<{ id?: string; tier?: string; title?: string }> }
}

/** SSE stream gia lap — du de panel co token va ket thuc stream. */
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

/**
 * Giu lai request body gui len BFF de assert.
 */
async function stubChat(panel: import('@playwright/test').Page): Promise<CapturedChatRequest[]> {
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
 * Mock `chrome.tabs` + `chrome.scripting` trong panel de "trang dang xem"
 * la mot trang HTML co noi dung.
 */
async function mockHtmlTab(panel: import('@playwright/test').Page): Promise<void> {
  await panel.addInitScript(() => {
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
          text: 'Day la noi dung chinh cua bai viet mau, rat dai va chi tiet.',
          excerpt: 'Day la noi dung chinh cua bai viet mau.',
          strategy: 'article',
          wordCount: 16,
        },
      },
    ]
  })
}

test('khong dinh kem gi → request khong co context (chat thuan LLM)', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await mockHtmlTab(panel)
  const captured = await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('composer-input').fill('Xin chao, ban la ai?')
  await panel.getByTestId('composer-send').click()

  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  expect(captured.length).toBeGreaterThan(0)
  expect(captured[0]?.context).toBeUndefined()

  await panel.close()
})

test('dinh kem trang → chip hien + request co context.items', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await mockHtmlTab(panel)
  const captured = await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('context-add-tab').click()

  const chip = panel.getByTestId('context-chip')
  await expect(chip).toBeVisible({ timeout: 20_000 })
  await expect(chip).toContainText('Bai viet mau')

  await panel.getByTestId('composer-input').fill('Tom tat trang nay')
  await panel.getByTestId('composer-send').click()

  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  const request = captured[0]
  expect(request?.context?.items).toHaveLength(1)
  expect(request?.context?.items?.[0]?.tier).toBe('attachment')
  expect(request?.context?.items?.[0]?.title).toBe('Bai viet mau')

  await panel.close()
})

test('meter ngan sach context hien "Da dung X / Y token"', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await mockHtmlTab(panel)
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Chua co context → chua co meter.
  await expect(panel.getByTestId('context-budget')).toHaveCount(0)

  await panel.getByTestId('context-add-tab').click()

  const meter = panel.getByTestId('context-budget')
  await expect(meter).toBeVisible({ timeout: 20_000 })
  await expect(meter).toContainText('token')
  await expect(meter).toContainText('/')

  await panel.close()
})

test('tat toggle context → request khong con gui context', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await mockHtmlTab(panel)
  const captured = await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('context-add-tab').click()
  await expect(panel.getByTestId('context-chip')).toBeVisible({ timeout: 20_000 })

  // Tat toggle → chat thuan LLM du van co chip.
  await panel.getByTestId('context-toggle').click()
  await expect(panel.getByTestId('context-toggle')).toHaveAttribute('aria-checked', 'false')

  await panel.getByTestId('composer-input').fill('Hoi khong can context')
  await panel.getByTestId('composer-send').click()

  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  expect(captured.length).toBeGreaterThan(0)
  expect(captured[0]?.context).toBeUndefined()

  await panel.close()
})
