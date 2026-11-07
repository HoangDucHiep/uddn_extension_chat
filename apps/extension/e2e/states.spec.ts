import { expect, type Page, type Route } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: 4 trang thai cua side panel (T-M1-19).
 *
 * Kiem chung:
 *  - (1) Badge ket noi + banner offline khi BFF khong phan hoi (NFR-REL-04).
 *  - (2) Card loi co hau dong khoi phuc + nut "Thu lai" (FR-CHAT-14).
 *  - (3) Skeleton loading khi mo 1 conversation (tranh flash empty state).
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can server that.
 * Docs: docs/SYSTEM_DESIGN.md §7.15
 */

/**
 * Stub `/api/health` → BFF khong phan hoi (offline).
 *
 * @param panel - Page cua side panel.
 */
async function stubHealthOffline(panel: Page): Promise<void> {
  await panel.route('**/api/health', async (route: Route) => {
    await route.abort('failed')
  })
}

/**
 * Stub `/api/health` → BFF online.
 *
 * @param panel - Page cua side panel.
 */
async function stubHealthOnline(panel: Page): Promise<void> {
  await panel.route('**/api/health', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        status: 'ok',
        version: '0.1.0',
        db: 'up',
        uptime: 1,
      }),
    })
  })
}

/**
 * Stub `/api/chat` → SSE tra ve loi 429 (rate-limit).
 *
 * @param panel - Page cua side panel.
 */
async function stubChatRateLimited(panel: Page): Promise<void> {
  await panel.route('**/api/chat', async (route: Route) => {
    const body =
      'event: meta\ndata: {"type":"meta","messageId":"11111111-1111-4111-8111-111111111111","conversationId":"22222222-2222-4222-8222-222222222222","provider":"groq","model":"m","keySource":"K1","requestId":"r1","turnId":"t1"}\n\n' +
      'event: error\ndata: {"type":"error","code":"PROVIDER_RATE_LIMITED","message":"Ban da gui qua nhieu yeu cau","retryable":true,"retryAfterSeconds":3}\n\n' +
      'event: done\ndata: {"type":"done","finishReason":"error","messageId":"11111111-1111-4111-8111-111111111111"}\n\n'
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body,
    })
  })
}

test('BFF offline → badge "Offline" + banner', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubHealthOffline(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Badge ket noi phai hien trong header.
  const badge = panel.getByTestId('connection-badge')
  await expect(badge).toBeVisible({ timeout: 20_000 })
  await expect(badge).toHaveAttribute('data-status', 'offline')

  // Banner offline phai hien.
  await expect(panel.getByTestId('offline-banner')).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('offline-banner-retry')).toBeVisible()

  await panel.close()
})

test('BFF online → badge "Da ket noi", khong banner offline', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubHealthOnline(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  const badge = panel.getByTestId('connection-badge')
  await expect(badge).toBeVisible({ timeout: 20_000 })
  await expect(badge).toHaveAttribute('data-status', 'connected')
  await expect(panel.getByTestId('offline-banner')).toBeHidden()

  await panel.close()
})

test('loi 429 → card loi co dem nguoc + nut "Thu lai"', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubHealthOnline(panel)
  await stubChatRateLimited(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('composer-input').fill('Xin chao')
  await panel.getByTestId('composer-send').click()

  // Card loi phai hien trong bubble assistant.
  const errorCard = panel.getByTestId('error-state')
  await expect(errorCard).toBeVisible({ timeout: 20_000 })
  await expect(errorCard).toHaveAttribute('data-error-kind', 'rate-limit')
  await expect(panel.getByTestId('error-state-message')).toContainText(
    'Ban da gui qua nhieu yeu cau',
  )

  // Nut "Thu lai" dang dem nguoc → bi disable.
  const retry = panel.getByTestId('error-state-retry')
  await expect(retry).toBeDisabled()
  await expect(retry).toContainText('s')

  // Het dem nguoc → nut duoc bat.
  await expect(retry).toBeEnabled({ timeout: 10_000 })

  await panel.close()
})

test('mo conversation → skeleton loading thay empty state', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubHealthOnline(panel)

  // Danh sach conversation co 1 item.
  await panel.route('**/api/conversations**', async (route: Route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/api/conversations') && route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          items: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              title: 'Cuộc trò chuyện cũ',
              pinned: false,
              archived: false,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              messageCount: 2,
            },
          ],
        }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ items: [] }),
    })
  })

  // `/api/conversations/:id/messages` → treo 1.5s de skeleton kip hien.
  await panel.route('**/api/conversations/*/messages', async (route: Route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        conversation: {
          id: '33333333-3333-4333-8333-333333333333',
          title: 'Cuộc trò chuyện cũ',
          pinned: false,
          archived: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          messageCount: 2,
        },
        messages: [],
        path: [],
        turns: [],
      }),
    })
  })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('conversations-button').click()
  await expect(panel.getByTestId('conversation-list')).toBeVisible({ timeout: 20_000 })
  await panel.getByTestId('conversation-item').first().click()

  // Skeleton loading phai xuat hien (thay vi flash empty state).
  await expect(panel.getByTestId('loading-state')).toBeVisible({ timeout: 10_000 })
  await expect(panel.getByTestId('loading-state-row').first()).toBeVisible()

  // Sau khi tai xong → skeleton bien mat.
  await expect(panel.getByTestId('loading-state')).toBeHidden({ timeout: 20_000 })

  await panel.close()
})
