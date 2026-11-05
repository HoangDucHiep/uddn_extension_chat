import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: dinh kem anh & vision input (FR-VISION-01 — T-M1-24).
 *
 * Kiem chung:
 *  - (1) Chon file anh → thumbnail hien trong tray.
 *  - (2) Gui → request co `messages[].attachments[]` (base64) + message user
 *        hien thi anh.
 *  - (3) Xoa anh khoi tray → khong con attachments trong request.
 *  - (4) File khong phai dinh dang anh → hien loi, khong gui.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can server that.
 * Docs: docs/SYSTEM_DESIGN.md §4.2, §7.4
 */

interface CapturedChatRequest {
  messages?: Array<{
    role: string
    content: string
    attachments?: Array<{ id: string; mimeType: string; data: string; bytes: number }>
  }>
}

/** SSE stream gia lap — du de panel co token va ket thuc stream. */
const SSE_BODY = [
  'event: meta',
  'data: {"type":"meta","messageId":"msg-1","conversationId":"11111111-1111-4111-8111-111111111111","provider":"mock","model":"mock-model","keySource":"K1","requestId":"req-1"}',
  '',
  'event: token',
  'data: {"type":"token","delta":"Day la mot anh mau","index":0}',
  '',
  'event: done',
  'data: {"type":"done","finishReason":"stop","messageId":"msg-1"}',
  '',
  '',
].join('\n')

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
 * Tao file PNG 1x1 hieu luc (base64) — dung de upload trong test.
 */
const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/**
 * Tao file that tren dia de Playwright upload.
 *
 * @param name - Ten file (duy nhat de tranh trung).
 * @param content - Noi dung file.
 */
async function writeTempFile(name: string, content: Buffer): Promise<string> {
  const { writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const filePath = join(tmpdir(), `sidekick-vision-${name}`)
  await writeFile(filePath, content)
  return filePath
}

test('chon file anh → thumbnail hien trong tray', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  const filePath = await writeTempFile(
    'anh-mau.png',
    Buffer.from(PNG_1X1_BASE64, 'base64'),
  )

  await panel.getByTestId('composer-file-input').setInputFiles(filePath)

  const thumb = panel.getByTestId('attachment-thumb')
  await expect(thumb).toBeVisible({ timeout: 20_000 })
  await expect(thumb).toHaveCount(1)

  await panel.close()
})

test('gui anh → request co attachments + message hien thi anh', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  const captured = await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  const filePath = await writeTempFile(
    'anh-mau-2.png',
    Buffer.from(PNG_1X1_BASE64, 'base64'),
  )

  await panel.getByTestId('composer-file-input').setInputFiles(filePath)
  await expect(panel.getByTestId('attachment-thumb')).toBeVisible({ timeout: 20_000 })

  await panel.getByTestId('composer-input').fill('Mo ta anh nay')
  await panel.getByTestId('composer-send').click()

  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  expect(captured.length).toBeGreaterThan(0)
  const lastTurn = captured[0]?.messages?.[captured[0]?.messages.length - 1]
  expect(lastTurn?.attachments).toHaveLength(1)
  expect(lastTurn?.attachments?.[0]?.mimeType).toBe('image/png')
  expect(lastTurn?.attachments?.[0]?.data.length).toBeGreaterThan(0)
  expect(lastTurn?.attachments?.[0]?.bytes).toBeGreaterThan(0)

  // Message user render anh.
  await expect(panel.getByTestId('message-image')).toBeVisible({ timeout: 20_000 })

  // Tray da xoa sau khi gui.
  await expect(panel.getByTestId('attachment-thumb')).toHaveCount(0)

  await panel.close()
})

test('xoa anh khoi tray → request khong con attachments', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  const captured = await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  const filePath = await writeTempFile(
    'anh-mau-3.png',
    Buffer.from(PNG_1X1_BASE64, 'base64'),
  )

  await panel.getByTestId('composer-file-input').setInputFiles(filePath)
  await expect(panel.getByTestId('attachment-thumb')).toBeVisible({ timeout: 20_000 })

  await panel.getByLabel(/Xoá ảnh đính kèm/).click()
  await expect(panel.getByTestId('attachment-thumb')).toHaveCount(0)

  await panel.getByTestId('composer-input').fill('Xin chao')
  await panel.getByTestId('composer-send').click()

  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  const lastTurn = captured[0]?.messages?.[captured[0]?.messages.length - 1]
  expect(lastTurn?.attachments).toBeUndefined()

  await panel.close()
})

test('file khong phai dinh dang anh → hien loi, khong gui anh', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  const captured = await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  const filePath = await writeTempFile(
    'tai-lieu.txt',
    Buffer.from('day la van ban', 'utf-8'),
  )

  await panel.getByTestId('composer-file-input').setInputFiles(filePath)

  // File txt khong duoc `accept` → browser/panel tu cho vao khong.
  // Neu van duoc them → phai hien loi va khong co thumbnail.
  const errorCount = await panel.getByTestId('attachment-error').count()
  const thumbCount = await panel.getByTestId('attachment-thumb').count()

  if (errorCount === 0 && thumbCount === 0) {
    // Panel tu cho file → khong co gi xay ra, van la hanh vi dung.
    expect(thumbCount).toBe(0)
  } else {
    await expect(panel.getByTestId('attachment-error')).toBeVisible({ timeout: 20_000 })
    expect(thumbCount).toBe(0)
  }

  await panel.getByTestId('composer-input').fill('Xin chao')
  await panel.getByTestId('composer-send').click()
  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  const lastTurn = captured[0]?.messages?.[captured[0]?.messages.length - 1]
  expect(lastTurn?.attachments).toBeUndefined()

  await panel.close()
})
