import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: request logging đầy đủ vào `request_logs` (T-M1-14).
 *
 * Kiểm chứng:
 *  - (1) Client gửi header `X-Request-Id` → server ghi cùng id vào DB.
 *  - (2) `GET /api/logs` trả về 1 dòng có `requestId` khớp, `ttftMs` > 0,
 *      `latencyMs` > 0, `tokensOut` >= 0, `costUsd` >= 0.
 *  - (3) API logs **chỉ metadata** — không có `promptText` / `responseText`.
 *
 * Cần BFF thật + Postgres (docker compose up -d) → test tự skip nếu BFF
 * không chạy.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.16
 */

/** Base URL cua BFF. */
const BFF_URL = 'http://127.0.0.1:8787'

/**
 * Kiem tra BFF co chay khong.
 *
 * @returns `true` neu BFF tra `/api/health` 200.
 */
async function isBffUp(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get(`${BFF_URL}/api/health`)
    return response.status() === 200
  } catch {
    return false
  }
}

test('luot chat ghi dong `request_logs` day du + API logs chi metadata', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()

  if (!(await isBffUp(panel))) {
    await panel.close()
    test.skip(true, 'BFF chua chay (docker compose up -d) — bo qua E2E request log.')
    return
  }

  // Bat header `X-Request-Id` client gui len server.
  const sentRequestIds: string[] = []
  panel.on('request', (request) => {
    if (!request.url().includes('/api/chat')) return
    const header = request.headers()['x-request-id']
    if (typeof header === 'string') sentRequestIds.push(header)
  })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('composer-input').fill('Hoi mot cau de sinh log')
  await panel.getByTestId('composer-send').click()
  await expect(panel.getByTestId('message-assistant')).toBeVisible({ timeout: 30_000 })

  // Client phai gui header `X-Request-Id`.
  await expect.poll(() => sentRequestIds.length, { timeout: 20_000 }).toBeGreaterThan(0)
  const sentRequestId = sentRequestIds[0] as string

  // Server ghi dong log — poll vi DB ghi async sau khi stream ket thuc.
  await expect
    .poll(
      async () => {
        const response = await panel.request.get(`${BFF_URL}/api/logs?limit=50`)
        if (response.status() !== 200) return undefined
        const body = (await response.json()) as {
          items: Array<{ requestId: string }>
        }
        return body.items.some((item) => item.requestId === sentRequestId)
      },
      { timeout: 30_000, message: 'Khong tim thay dong log voi requestId da gui' },
    )
    .toBe(true)

  // Noi dung dong log: co ttft, latency, token, cost.
  const response = await panel.request.get(`${BFF_URL}/api/logs?limit=50`)
  const body = (await response.json()) as {
    items: Array<{
      requestId: string
      ttftMs: number
      latencyMs: number
      tokensIn: number
      tokensOut: number
      costUsd: number
      provider: string
      model: string
      error: string | null
    }>
  }

  const row = body.items.find((item) => item.requestId === sentRequestId)
  expect(row).toBeDefined()
  expect(row?.ttftMs).toBeGreaterThan(0)
  expect(row?.latencyMs).toBeGreaterThan(0)
  expect(row?.tokensIn).toBeGreaterThanOrEqual(0)
  expect(row?.tokensOut).toBeGreaterThanOrEqual(0)
  expect(row?.costUsd).toBeGreaterThanOrEqual(0)
  expect(row?.provider.length).toBeGreaterThan(0)
  expect(row?.model.length).toBeGreaterThan(0)
  // Luot chat thanh cong → khong co error.
  expect(row?.error).toBeNull()

  // API logs chi metadata — khong lo prompt/response.
  const raw = await response.text()
  expect(raw).not.toContain('promptText')
  expect(raw).not.toContain('responseText')
  expect(raw).not.toContain('contextSnapshot')

  await panel.close()
})

test('API usage tong hop token + chi phi', async ({ context, extensionId }) => {
  const panel = await context.newPage()

  if (!(await isBffUp(panel))) {
    await panel.close()
    test.skip(true, 'BFF chua chay (docker compose up -d) — bo qua E2E usage.')
    return
  }

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  const response = await panel.request.get(`${BFF_URL}/api/usage`)
  expect(response.status()).toBe(200)

  const body = (await response.json()) as {
    totalTokens: number
    totalCostUsd: number
    byDay: unknown[]
  }

  expect(typeof body.totalTokens).toBe('number')
  expect(body.totalCostUsd).toBeGreaterThanOrEqual(0)
  expect(Array.isArray(body.byDay)).toBe(true)

  await panel.close()
})
