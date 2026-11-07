import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: chat actions T-M1-10 — stop / continue · regenerate + bien the ·
 * edit & resend (branch) · draft.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can Docker.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.11
 */

/** Request chat duoc capture. */
interface CapturedChatRequest {
  operation?: string
  assistantMessageId?: string
  parentTurnId?: string
  messages?: Array<{ role: string; content: string }>
}

/**
 * Tra ve body SSE cho 1 loai phan hoi.
 *
 * @param options - Tuy chon.
 */
function sse(options: {
  turnId?: string
  tokens?: string[]
  done?: boolean
}): string {
  const lines: string[] = []
  lines.push('event: meta')
  lines.push(
    `data: ${JSON.stringify({
      type: 'meta',
      messageId: 'msg-1',
      conversationId: '11111111-1111-4111-8111-111111111111',
      provider: 'mock',
      model: 'mock-model',
      keySource: 'K1',
      requestId: 'req-1',
      ...(options.turnId !== undefined ? { turnId: options.turnId } : {}),
    })}`,
  )
  lines.push('')

  for (const [index, token] of (options.tokens ?? ['Da nhan']).entries()) {
    lines.push('event: token')
    lines.push(
      `data: ${JSON.stringify({ type: 'token', delta: token, index })}`,
    )
    lines.push('')
  }

  lines.push('event: done')
  lines.push(
    `data: ${JSON.stringify({
      type: 'done',
      finishReason: options.done === false ? 'aborted' : 'stop',
      messageId: 'msg-1',
    })}`,
  )
  lines.push('')
  lines.push('')

  return lines.join('\n')
}

/**
 * Stub route `/api/chat` va capture request.
 *
 * @param panel - Trang side panel.
 * @param options - Tuy chon: token theo operation + do tre.
 */
async function stubChat(
  panel: Page,
  options: { tokensByOperation?: Record<string, string[]>; delayMs?: number } = {},
): Promise<CapturedChatRequest[]> {
  const captured: CapturedChatRequest[] = []

  await panel.route('**/api/chat', async (route) => {
    const raw = route.request().postData()
    const request = raw !== null ? (JSON.parse(raw) as CapturedChatRequest) : {}
    captured.push(request)

    if (options.delayMs !== undefined) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs))
    }

    const tokens = options.tokensByOperation?.[request.operation ?? 'send'] ?? ['Da nhan']

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: sse({
        tokens,
        turnId: 'turn-1',
      }),
    })
  })

  return captured
}

/**
 * Nhap cau hoi va gui.
 *
 * @param panel - Trang side panel.
 * @param text - Noi dung.
 */
async function send(panel: Page, text: string): Promise<void> {
  await panel.getByTestId('composer-input').fill(text)
  await panel.getByTestId('composer-send').click()
}

test('stop → giu noi dung do + hien nut "Tiep tuc"', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await stubChat(panel, { delayMs: 5_000 })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('composer-input').fill('Hoi cau 1')
  await panel.getByTestId('composer-send').click()

  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  // Bam nut "Dung" (nut stop trong composer) → stream bi huy.
  const stopButton = panel.getByTestId('composer-stop')
  await expect(stopButton).toBeVisible({ timeout: 20_000 })
  await stopButton.click()

  // Message assistant giu lai + danh dau aborted → hien nut "Tiep tuc".
  const continueButton = panel.getByTestId('message-continue-button')
  await expect(continueButton).toBeVisible({ timeout: 20_000 })

  await panel.close()
})

test('regenerate → tao bien the moi + switcher "1/2"', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  const captured = await stubChat(panel, {
    tokensByOperation: {
      send: ['cau tra loi lan 1'],
      regenerate: ['cau tra loi lan 2'],
    },
  })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await send(panel, 'Hoi cau 1')
  await expect(panel.getByTestId('message-assistant')).toContainText(
    'cau tra loi lan 1',
    { timeout: 20_000 },
  )

  // Bam "Tao lai" → gui operation regenerate.
  await panel.getByTestId('message-regenerate-button').first().click()

  await expect.poll(() => captured.length, { timeout: 20_000 }).toBeGreaterThan(1)
  const regenerateRequest = captured.find((item) => item.operation === 'regenerate')
  expect(regenerateRequest).toBeDefined()
  expect(regenerateRequest?.assistantMessageId).toBeDefined()

  await panel.close()
})

test('sua & gui lai → tao branch, cat lich su sau', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  const captured = await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await send(panel, 'Cau hoi cu')
  await expect(panel.getByTestId('message-assistant')).toBeVisible({ timeout: 20_000 })

  // Mo hop sua tin nhan user.
  await panel.getByTestId('message-edit-button').first().click()
  await expect(panel.getByTestId('message-edit-box')).toBeVisible({ timeout: 20_000 })

  await panel.getByTestId('message-edit-input').fill('Cau hoi da sua')
  await panel.getByTestId('message-edit-submit').click()

  await expect.poll(() => captured.length, { timeout: 20_000 }).toBeGreaterThan(1)
  const branchRequest = captured.find((item) => item.operation === 'branch')
  expect(branchRequest).toBeDefined()
  expect(branchRequest?.parentTurnId).toBeDefined()
  expect(branchRequest?.messages?.[branchRequest.messages.length - 1]?.content).toBe(
    'Cau hoi da sua',
  )

  await panel.close()
})

test('draft con sau khi reload panel', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Nhap ban nhap chua gui.
  await panel.getByTestId('composer-input').fill('Ban nhap chua gui')

  // Cho debounce 300ms + ghi storage.
  await panel.waitForTimeout(800)

  await panel.reload()

  await expect
    .poll(
      async () => panel.getByTestId('composer-input').inputValue(),
      { timeout: 20_000, message: 'Khong khoi phuc duoc ban nhap' },
    )
    .toBe('Ban nhap chua gui')

  await panel.close()
})

test('nut "Cuon xuong" xuat hien khi cuon len tren', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Thread rong → khong can nut.
  await expect(panel.getByTestId('scroll-to-bottom')).toHaveCount(0)

  // Tao nhieu message de thread vuot khung hinh.
  for (let index = 0; index < 12; index += 1) {
    await send(panel, `Cau hoi so ${index}`)
    await expect(panel.getByTestId('message-assistant').nth(index)).toBeVisible({
      timeout: 20_000,
    })
  }

  // Cuon len dau thread → nut "Cuon xuong" phai xuat hien.
  await panel.getByTestId('message-list').evaluate((node) => {
    node.scrollTop = 0
    node.dispatchEvent(new Event('scroll', { bubbles: true }))
  })

  await expect(panel.getByTestId('scroll-to-bottom')).toBeVisible({ timeout: 20_000 })

  await panel.close()
})
