import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: render Markdown trong side panel (T-M1-07).
 *
 * Kiem chung:
 *  - (1) Markdown render dung: heading + bang + code block.
 *  - (2) Click copy → toast "Đã sao chép".
 *  - (3) Khong co `script` trong DOM sau khi nhan noi dung `<script>`.
 *  - (4) Khong loi console khi render.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can server that.
 * Docs: docs/SYSTEM_DESIGN.md §7.8
 */

/** Noi dung markdown gia lap cho response SSE. */
const MARKDOWN = [
  '## Tieu de Markdown',
  '',
  '| Cot A | Cot B |',
  '| - | - |',
  '| 1 | 2 |',
  '',
  '```typescript',
  'const x: number = 1',
  '```',
].join('\n')

/** Noi dung XSS gia lap (script + img onerror). */
const XSS_MARKDOWN = [
  'Van ban an toan',
  '',
  '<script>window.__xss = true</script>',
  '',
  '<img src="x" onerror="window.__xss = true">',
].join('\n')

/**
 * Tao SSE stream gia lap tu noi dung markdown.
 *
 * @param markdown - Noi dung markdown tra ve.
 * @returns Body SSE.
 */
function sseBody(markdown: string): string {
  return [
    'event: meta',
    'data: {"type":"meta","messageId":"msg-1","conversationId":"11111111-1111-4111-8111-111111111111","provider":"mock","model":"mock-model","keySource":"K1","requestId":"req-1"}',
    '',
    'event: token',
    `data: ${JSON.stringify({ type: 'token', delta: markdown, index: 0 })}`,
    '',
    'event: done',
    'data: {"type":"done","finishReason":"stop","messageId":"msg-1"}',
    '',
    '',
  ].join('\n')
}

/**
 * Stub endpoint chat bang SSE gia lap.
 *
 * @param panel - Page cua side panel.
 * @param markdown - Noi dung markdown tra ve.
 */
async function stubChat(panel: Page, markdown: string): Promise<void> {
  await panel.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: sseBody(markdown),
    })
  })
}

/**
 * Gui mot luot chat va cho assistant message xuat hien.
 *
 * @param panel - Page cua side panel.
 */
async function sendChat(panel: Page): Promise<void> {
  await panel.getByTestId('composer-input').fill('Viet markdown')
  await panel.getByTestId('composer-send').click()
  await expect(panel.getByTestId('message-assistant')).toBeVisible({ timeout: 20_000 })
}

test('markdown render dung: heading + bang + code block', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await stubChat(panel, MARKDOWN)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await sendChat(panel)

  // Heading markdown → <h2>.
  await expect(panel.getByRole('heading', { name: 'Tieu de Markdown' })).toBeVisible({
    timeout: 20_000,
  })

  // Bang GFM → wrapper scroll ngang + 2 cot.
  const wrapper = panel.getByTestId('markdown-table-wrapper')
  await expect(wrapper).toBeVisible({ timeout: 20_000 })
  await expect(wrapper.locator('thead th')).toHaveCount(2)

  // Code block → co nhan ngon ngu + token highlight.
  const codeBlock = panel.getByTestId('code-block')
  await expect(codeBlock).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('code-block-language')).toHaveText('typescript')
  await expect(codeBlock.locator('.hljs-keyword')).toHaveCount(1)

  await panel.close()
})

test('click copy → hien toast "Đã sao chép"', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel, MARKDOWN)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await sendChat(panel)

  const codeBlock = panel.getByTestId('code-block')
  await expect(codeBlock).toBeVisible({ timeout: 20_000 })

  await panel.getByTestId('code-block-copy').click()

  await expect(panel.getByText('Đã sao chép')).toBeVisible({ timeout: 20_000 })

  await panel.close()
})

test('khong render script trong DOM (XSS)', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel, XSS_MARKDOWN)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await sendChat(panel)

  await expect(panel.getByTestId('message-assistant')).toContainText('Van ban an toan', {
    timeout: 20_000,
  })

  const scriptCount = await panel.getByTestId('message-assistant').locator('script').count()
  expect(scriptCount).toBe(0)

  const xssFlag = await panel.evaluate(() => (window as unknown as { __xss?: boolean }).__xss)
  expect(xssFlag).toBeUndefined()

  await panel.close()
})

test('khong loi console khi render markdown', async ({ context, extensionId }) => {
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

  await stubChat(panel, MARKDOWN)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await sendChat(panel)

  await expect(panel.getByTestId('code-block')).toBeVisible({ timeout: 20_000 })

  expect(errors).toEqual([])

  await panel.close()
})
