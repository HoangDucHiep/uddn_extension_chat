import { expect, type Page, type Route } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: budget cap — cau hinh + banner (T-M2-03b — FR-PROVIDER-06).
 *
 * Kiem chung:
 *  - (1) Section "Ngan sach chi phi" xuat hien trong Settings.
 *  - (2) Bat + dat han muc → `PUT /api/budget` duoc gui len BFF.
 *  - (3) Reload panel → cau hinh van con (server la nguon su that).
 *  - (4) Server tra `state: 'exceeded'` → banner `--danger` hien duoi header.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can server that.
 * Docs: docs/SYSTEM_DESIGN.md §7.24
 */

/** Cau hinh budget cua server gia lap (giữ trong closure de reload van dung). */
const serverState = {
  enabled: false,
  limitUsd: 0,
  period: 'monthly' as 'daily' | 'monthly',
  warnThresholdPercent: 80,
  hardBlock: true,
  spentUsd: 0,
  state: 'disabled' as 'disabled' | 'ok' | 'warning' | 'exceeded',
}

/**
 * Stub API BFF — `/api/budget` phan hoi theo `serverState`, cac endpoint
 * khac tra `{ items: [] }`.
 *
 * @param panel - Page cua side panel.
 */
async function stubBff(panel: Page): Promise<void> {
  await panel.route('**/api/**', async (route: Route) => {
    const url = route.request().url()

    if (url.includes('/api/budget')) {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON() as Partial<
          typeof serverState
        >
        serverState.enabled = body.enabled ?? serverState.enabled
        serverState.limitUsd = body.limitUsd ?? serverState.limitUsd
        serverState.period = body.period ?? serverState.period
        serverState.warnThresholdPercent =
          body.warnThresholdPercent ?? serverState.warnThresholdPercent
        serverState.hardBlock = body.hardBlock ?? serverState.hardBlock
        serverState.state =
          serverState.enabled && serverState.limitUsd > 0 ? 'ok' : 'disabled'
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          settings: {
            enabled: serverState.enabled,
            limitUsd: serverState.limitUsd,
            period: serverState.period,
            warnThresholdPercent: serverState.warnThresholdPercent,
            hardBlock: serverState.hardBlock,
          },
          spentUsd: serverState.spentUsd,
          limitUsd: serverState.limitUsd,
          remainingUsd: Math.max(0, serverState.limitUsd - serverState.spentUsd),
          percentUsed:
            serverState.limitUsd > 0
              ? (serverState.spentUsd / serverState.limitUsd) * 100
              : 0,
          state: serverState.state,
          period: serverState.period,
          periodStart: '2026-11-01T00:00:00.000Z',
          periodEnd: '2026-12-01T00:00:00.000Z',
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
}

/**
 * Mo drawer cai dat.
 *
 * @param panel - Page cua side panel.
 */
async function openSettings(panel: Page): Promise<void> {
  await panel.getByTestId('settings-button').click()
  await expect(panel.getByTestId('settings-drawer')).toBeVisible({ timeout: 20_000 })
}

test.beforeEach(() => {
  serverState.enabled = false
  serverState.limitUsd = 0
  serverState.period = 'monthly'
  serverState.warnThresholdPercent = 80
  serverState.hardBlock = true
  serverState.spentUsd = 0
  serverState.state = 'disabled'
})

test('section "Ngan sach chi phi" → bat + dat han muc → reload van giu', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await stubBff(panel)

  const putBodies: Array<Record<string, unknown>> = []
  panel.on('request', (request) => {
    if (!request.url().includes('/api/budget')) return
    if (request.method() !== 'PUT') return
    const data = request.postData()
    if (data === null) return
    try {
      putBodies.push(JSON.parse(data) as Record<string, unknown>)
    } catch {
      // Body khong phai JSON → bo qua.
    }
  })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // (1) Section xuat hien trong Settings.
  await openSettings(panel)
  await expect(
    panel.getByRole('heading', { name: 'Ngân sách chi phí' }),
  ).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('budget-settings-limit')).toBeVisible()

  // (2) Bat budget + dat han muc → luu.
  await panel.getByTestId('budget-settings-enabled').check()
  await panel.getByTestId('budget-settings-limit').fill('12')
  await panel.getByTestId('budget-settings-save').click()

  await expect.poll(() => putBodies.length, { timeout: 20_000 }).toBeGreaterThan(0)
  const payload = putBodies[0]
  expect(payload?.['enabled']).toBe(true)
  expect(payload?.['limitUsd']).toBe(12)

  // (3) Reload panel → cau hinh van con (server la nguon su that).
  await panel.reload()
  await openSettings(panel)
  const limit = panel.getByTestId('budget-settings-limit')
  await expect(limit).toBeVisible({ timeout: 20_000 })
  await expect(limit).toHaveValue('12')

  await panel.close()
})

test('server bao vuot han muc → banner danger hien duoi header', async ({
  context,
  extensionId,
}) => {
  serverState.enabled = true
  serverState.limitUsd = 10
  serverState.spentUsd = 14
  serverState.state = 'exceeded'

  const panel = await context.newPage()
  await stubBff(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  const banner = panel.getByTestId('budget-banner')
  await expect(banner).toBeVisible({ timeout: 20_000 })
  await expect(banner).toHaveAttribute('data-budget-state', 'exceeded')

  await panel.close()
})

test('budget tat → KHONG hien banner', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubBff(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await expect(panel.getByTestId('composer-input')).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('budget-banner')).toHaveCount(0)

  await panel.close()
})
