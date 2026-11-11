import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: tool call block + approval gate (FR-TOOLS-02/04 — T-M2-09).
 *
 * Kiem chung:
 *  - (1) SSE `tool_call` → block "Dung tool: calculator" hien trong thread.
 *  - (2) Block collapsible → mo ra thay args + ket qua.
 *  - (3) Tool can duyet → badge + nut "Duyet" / "Tu choi" → goi API duyet.
 *  - (4) Tool loi → trang thai loi, thread khong hong.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can server that.
 * Docs: docs/SYSTEM_DESIGN.md §7.26.5
 */

/** Id tool call gia lap. */
const CALL_ID = '11111111-2222-4333-8444-555555555555'

/**
 * Tao SSE stream gia lap co event tool.
 *
 * @param options - Cau hinh stream.
 * @param options.answer - Noi dung cau tra loi cuoi.
 * @param options.approvalRequired - Tool co can user duyet khong.
 * @param options.fail - Tool that bai hay khong.
 * @returns Body SSE.
 */
function sseBody(options: {
  answer: string
  approvalRequired: boolean
  fail: boolean
}): string {
  const lines = [
    'event: meta',
    'data: {"type":"meta","messageId":"msg-1","conversationId":"11111111-1111-4111-8111-111111111111","provider":"mock","model":"mock-model","keySource":"K1","requestId":"req-1"}',
    '',
    'event: tool_call',
    `data: ${JSON.stringify({
      type: 'tool_call',
      id: CALL_ID,
      name: 'calculator',
      args: { expression: '2+2' },
      approvalRequired: options.approvalRequired,
    })}`,
    '',
    'event: tool_result',
    `data: ${JSON.stringify({
      type: 'tool_result',
      id: CALL_ID,
      ok: !options.fail,
      output: options.fail ? 'Chia cho 0 khong hop le' : '4',
      durationMs: 12,
    })}`,
    '',
    'event: token',
    `data: ${JSON.stringify({ type: 'token', delta: options.answer, index: 0 })}`,
    '',
    'event: done',
    'data: {"type":"done","finishReason":"stop","messageId":"msg-1"}',
    '',
    '',
  ]

  return lines.join('\n')
}

/**
 * Stub endpoint chat bang SSE gia lap.
 *
 * @param panel - Page cua side panel.
 * @param options - Cau hinh stream.
 */
async function stubChat(
  panel: Page,
  options: { answer: string; approvalRequired: boolean; fail: boolean },
): Promise<void> {
  await panel.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: sseBody(options),
    })
  })
}

/**
 * Stub endpoint duyet tool.
 *
 * @param panel - Page cua side panel.
 * @param status - Tra `approvedByUser` = true/false.
 */
async function stubApproval(panel: Page, status: 'approve' | 'deny'): Promise<void> {
  await panel.route('**/api/tools/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ id: CALL_ID, approvedByUser: status === 'approve' }),
    })
  })
}

/**
 * Gui mot luot chat va cho assistant message xuat hien.
 *
 * @param panel - Page cua side panel.
 */
async function sendChat(panel: Page): Promise<void> {
  await panel.getByTestId('composer-input').fill('2+2 bang bao nhieu?')
  await panel.getByTestId('composer-send').click()
  await expect(panel.getByTestId('message-assistant')).toBeVisible({ timeout: 20_000 })
}

test('tool call → block "Dung tool" hien trong thread', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel, { answer: '4', approvalRequired: false, fail: false })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await sendChat(panel)

  const block = panel.getByTestId('tool-call-block')
  await expect(block).toBeVisible({ timeout: 20_000 })
  await expect(block).toHaveAttribute('data-tool-name', 'calculator')
  await expect(panel.getByTestId('tool-call-status')).toContainText('Xong')

  await panel.close()
})

test('block collapsible → mo ra thay args + ket qua', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel, { answer: '4', approvalRequired: false, fail: false })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await sendChat(panel)

  await expect(panel.getByTestId('tool-call-args')).toHaveCount(0)

  await panel.getByTestId('tool-call-toggle').click()

  await expect(panel.getByTestId('tool-call-args')).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('tool-call-args')).toContainText('expression')
  await expect(panel.getByTestId('tool-call-output')).toHaveText('4')

  await panel.close()
})

test('tool can duyet → badge + nut Duyet goi API duyet', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel, { answer: '4', approvalRequired: true, fail: false })
  await stubApproval(panel, 'approve')

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await sendChat(panel)

  await panel.getByTestId('tool-call-toggle').click()

  await expect(panel.getByTestId('tool-call-approval-badge')).toBeVisible({ timeout: 20_000 })
  await panel.getByTestId('tool-call-approve').click()

  // API duyet duoc goi → badge "can duyet" bien mat.
  await expect(panel.getByTestId('tool-call-approval-badge')).toHaveCount(0, { timeout: 20_000 })

  await panel.close()
})

test('tool loi → trang thai loi, thread khong hong', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubChat(panel, { answer: 'Khong chia duoc', approvalRequired: false, fail: true })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await sendChat(panel)

  const block = panel.getByTestId('tool-call-block')
  await expect(block).toBeVisible({ timeout: 20_000 })
  await expect(block).toHaveAttribute('data-tool-status', 'error')
  // Luot chat van co cau tra loi → khong hong.
  await expect(panel.getByTestId('message-assistant')).toContainText('Khong chia duoc')

  await panel.close()
})
