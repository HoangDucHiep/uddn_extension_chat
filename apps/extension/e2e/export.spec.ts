import { expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { test } from './fixtures.js'

/**
 * E2E: xuất cuộc trò chuyện (FR-CHAT-10 — T-M1-13).
 *
 * Kiem chung:
 *  - (1) Thread rỗng → **không** hiện nút xuất.
 *  - (2) Có tin nhắn → nút xuất hiện → bấm ra menu 3 mục.
 *  - (3) "Xuất tệp .md" → download file `.md` chứa nội dung assistant.
 *  - (4) "Xuất tệp .json" → download file `.json` parse được, có `version`
 *      + `messages[]`.
 *
 * BFF được stub bằng `page.route` → test chạy độc lập, không cần Docker.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.20
 */

/** SSE stream giả lập — đủ để panel có token và kết thúc stream. */
const SSE_BODY = [
  'event: meta',
  'data: {"type":"meta","messageId":"msg-1","conversationId":"11111111-1111-4111-8111-111111111111","provider":"mock","model":"mock-model","keySource":"K1","requestId":"req-1"}',
  '',
  'event: token',
  'data: {"type":"token","delta":"Cau tra loi mau","index":0}',
  '',
  'event: done',
  'data: {"type":"done","finishReason":"stop","messageId":"msg-1"}',
  '',
  '',
].join('\n')

/**
 * Stub route `/api/chat` với SSE giả lập.
 *
 * @param panel - Trang side panel.
 */
async function stubChat(panel: Page): Promise<void> {
  await panel.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: SSE_BODY,
    })
  })
}

/**
 * Gửi 1 lượt chat trong panel.
 *
 * @param panel - Trang side panel.
 * @param text - Nội dung câu hỏi.
 */
async function send(panel: Page, text: string): Promise<void> {
  await panel.getByTestId('composer-input').fill(text)
  await panel.getByTestId('composer-send').click()
}

test('thread rỗng → không hiện nút xuất', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await expect(panel.getByTestId('prompt-gallery')).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('export-button')).toHaveCount(0)

  await panel.close()
})

test('có tin nhắn → menu xuất hiện 3 mục', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await expect(panel.getByTestId('prompt-gallery')).toBeVisible({ timeout: 20_000 })
  await send(panel, 'Xin chào')

  await expect(panel.getByTestId('message-assistant')).toBeVisible({ timeout: 20_000 })

  const exportButton = panel.getByTestId('export-button')
  await expect(exportButton).toBeVisible()
  await exportButton.click()

  await expect(panel.getByTestId('export-menu')).toBeVisible()
  await expect(panel.getByTestId('export-copy-markdown')).toBeVisible()
  await expect(panel.getByTestId('export-download-markdown')).toBeVisible()
  await expect(panel.getByTestId('export-download-json')).toBeVisible()

  await panel.close()
})

test('xuất .md → file chứa nội dung assistant', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await expect(panel.getByTestId('prompt-gallery')).toBeVisible({ timeout: 20_000 })
  await send(panel, 'Xin chào')

  await expect(panel.getByTestId('message-assistant')).toBeVisible({ timeout: 20_000 })

  await panel.getByTestId('export-button').click()
  await expect(panel.getByTestId('export-menu')).toBeVisible()

  const [download] = await Promise.all([
    panel.waitForEvent('download'),
    panel.getByTestId('export-download-markdown').click(),
  ])

  expect(download.suggestedFilename()).toMatch(/^sidekick-.+\.md$/)

  const path = await download.path()
  expect(path).not.toBeNull()

  // Noi dung file phai chua cua hoi + cau tra loi cua assistant.
  const content = await readFile(path as string, 'utf-8')
  expect(content).toContain('Xin chào')
  expect(content).toContain('Cau tra loi mau')
  expect(content).toContain('mock-model')

  await panel.close()
})

test('xuất .json → file parse được', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await expect(panel.getByTestId('prompt-gallery')).toBeVisible({ timeout: 20_000 })
  await send(panel, 'Xin chào')

  await expect(panel.getByTestId('message-assistant')).toBeVisible({ timeout: 20_000 })

  await panel.getByTestId('export-button').click()
  await expect(panel.getByTestId('export-menu')).toBeVisible()

  const [download] = await Promise.all([
    panel.waitForEvent('download'),
    panel.getByTestId('export-download-json').click(),
  ])

  expect(download.suggestedFilename()).toMatch(/^sidekick-.+\.json$/)

  const path = await download.path()
  expect(path).not.toBeNull()

  const raw = await readFile(path as string, 'utf-8')
  const payload = JSON.parse(raw) as {
    version: number
    exportedAt: string
    messages: Array<{ role: string; content: string }>
  }

  expect(payload.version).toBe(1)
  expect(payload.exportedAt.length).toBeGreaterThan(0)
  expect(payload.messages.length).toBeGreaterThanOrEqual(2)
  expect(payload.messages[0]?.content).toContain('Xin chào')
  expect(payload.messages[1]?.content).toContain('Cau tra loi mau')

  await panel.close()
})
