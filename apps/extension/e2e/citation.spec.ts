import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: citation chip + popover (FR-CONTEXT-10 — T-M1-08).
 *
 * Kiem chung:
 *  - (1) Marker `[1]` trong cau tra loi → chip inline hien thi.
 *  - (2) Click chip → popover hien doan nguon (tieu de + domain + snippet).
 *  - (3) Nut "Mở trang gốc" → mo tab moi dung URL.
 *  - (4) Khong loi console khi render message co citation.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can server that.
 * Docs: docs/SYSTEM_DESIGN.md §7.9
 */

/** Noi dung cau tra loi co marker trich dan. */
const ANSWER = 'Gia do la 30% [1] va 40% [2] theo nguon.' /** Metadata nguon trich dan. */
const CITATION_1 = {
  type: 'citation' as const,
  index: 1,
  url: 'https://example.com/bai-viet',
  title: 'Bai viet ve Sidekick',
  snippet: 'Doan trich dan ngan cua bai viet.',
  tabId: 11,
}
const CITATION_2 = {
  type: 'citation' as const,
  index: 2,
  url: 'https://blog.example.org/bai-2',
  title: 'Bai so 2',
  snippet: 'Doan trich dan thu hai.',
}

/**
 * Tao SSE stream gia lap co event `citation`.
 *
 * @param answer - Noi dung cau tra loi.
 * @param citations - Danh sach nguon trich dan.
 * @returns Body SSE.
 */
function sseBody(answer: string, citations: readonly unknown[]): string {
  const lines = [
    'event: meta',
    'data: {"type":"meta","messageId":"msg-1","conversationId":"11111111-1111-4111-8111-111111111111","provider":"mock","model":"mock-model","keySource":"K1","requestId":"req-1"}',
    '',
    'event: token',
    `data: ${JSON.stringify({ type: 'token', delta: answer, index: 0 })}`,
    '',
  ]

  for (const citation of citations) {
    lines.push('event: citation', `data: ${JSON.stringify(citation)}`, '')
  }

  lines.push(
    'event: done',
    'data: {"type":"done","finishReason":"stop","messageId":"msg-1"}',
    '',
    '',
  )

  return lines.join('\n')
}

/**
 * Stub endpoint chat bang SSE gia lap.
 *
 * @param panel - Page cua side panel.
 * @param answer - Noi dung cau tra loi.
 * @param citations - Danh sach nguon trich dan.
 */
async function stubChat(
  panel: Page,
  answer: string,
  citations: readonly unknown[],
): Promise<void> {
  await panel.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: sseBody(answer, citations),
    })
  })
}

/**
 * Gui mot luot chat va cho assistant message xuat hien.
 *
 * @param panel - Page cua side panel.
 */
async function sendChat(panel: Page): Promise<void> {
  await panel.getByTestId('composer-input').fill('Tóm tắt trang')
  await panel.getByTestId('composer-send').click()
  await expect(panel.getByTestId('message-assistant')).toBeVisible({ timeout: 20_000 })
}

test('marker [N] → chip inline + dong tom tat nguon', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel, ANSWER, [CITATION_1, CITATION_2])

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await sendChat(panel)

  // Chip inline: 2 chip (cho 2 nguon).
  await expect(panel.getByTestId('citation-chip-1')).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('citation-chip-2')).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('citation-chip-1')).toHaveText('[1]')

  // Dong tom tat nguon duoi bubble.
  const list = panel.getByTestId('citation-list')
  await expect(list).toBeVisible({ timeout: 20_000 })
  await expect(list.locator('li')).toHaveCount(2)

  await panel.close()
})

test('click chip → popover hien doan nguon', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel, ANSWER, [CITATION_1, CITATION_2])

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await sendChat(panel)

  await panel.getByTestId('citation-chip-1').click()

  const popover = panel.getByTestId('citation-popover-1')
  await expect(popover).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('citation-title')).toHaveText('Bai viet ve Sidekick')
  await expect(panel.getByTestId('citation-domain')).toHaveText('example.com')
  await expect(panel.getByTestId('citation-snippet')).toContainText('Doan trich dan ngan')

  await panel.close()
})

test('nut "Mở trang gốc" → mo tab moi dung URL', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel, ANSWER, [CITATION_1])

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await sendChat(panel)

  await panel.getByTestId('citation-chip-1').click()
  await expect(panel.getByTestId('citation-open-source')).toBeVisible({ timeout: 20_000 })
  await panel.getByTestId('citation-open-source').click()

  // Tab moi duoc tao → URL co the can mot chuc de nap → poll.
  await expect
    .poll(
      async () =>
        panel.evaluate(async () => {
          const tabs = await chrome.tabs.query({})
          return tabs.map((tab) => tab.url ?? '').find((url) => url.includes('example.com'))
        }),
      { timeout: 20_000, message: 'Khong mo duoc tab goc cua nguon trich dan' },
    )
    .toBe('https://example.com/bai-viet')

  await panel.close()
})

test('khong loi console khi render message co citation', async ({ context, extensionId }) => {
  const panel = await context.newPage()

  const errors: string[] = []
  panel.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
  panel.on('pageerror', (error) => {
    errors.push(error.message)
  })

  await stubChat(panel, ANSWER, [CITATION_1, CITATION_2])

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await sendChat(panel)

  await expect(panel.getByTestId('citation-chip-1')).toBeVisible({ timeout: 20_000 })

  expect(errors).toEqual([])

  await panel.close()
})
