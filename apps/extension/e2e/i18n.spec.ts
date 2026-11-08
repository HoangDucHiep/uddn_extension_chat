import { expect, type Page, type Route } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: i18n VI/EN (FR-SETTINGS-06 — T-M1-17).
 *
 * Kiem chung:
 *  - (1) Mac dinh tieng Viet.
 *  - (2) Chon English → UI doi **ngay** (khong can reload).
 *  - (3) Reload → van tieng Anh (persist qua `chrome.storage.local`).
 *  - (4) Chon lai tieng Viet → UI doi ngay.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can server that.
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */

/**
 * Stub API lien quan den conversation + health check.
 *
 * @param panel - Page cua side panel.
 */
async function stubBff(panel: Page): Promise<void> {
  await panel.route('**/api/**', async (route: Route) => {
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

/**
 * Chon mot ngon ngu trong section "Ngon ngu".
 *
 * @param panel - Page cua side panel.
 * @param language - `vi` hoac `en`.
 */
async function selectLanguage(panel: Page, language: 'vi' | 'en'): Promise<void> {
  await panel.getByTestId(`radio-${language}`).click()
}

test('mac dinh tieng Viet → doi English → reload van giu', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubBff(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // (1) Mac dinh la tieng Viet.
  await openSettings(panel)
  await expect(panel.getByRole('heading', { name: 'Giao diện' })).toBeVisible({
    timeout: 20_000,
  })
  await expect(panel.getByRole('heading', { name: 'Quản lý dữ liệu' })).toBeVisible()

  // (2) Chon English → UI doi ngay, khong reload.
  await selectLanguage(panel, 'en')
  await expect(panel.getByRole('heading', { name: 'Appearance' })).toBeVisible({
    timeout: 20_000,
  })
  await expect(panel.getByRole('heading', { name: 'Data management' })).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Server (BFF)' })).toBeVisible()

  // (3) Reload → van tieng Anh.
  await panel.reload()
  await openSettings(panel)
  await expect(panel.getByRole('heading', { name: 'Appearance' })).toBeVisible({
    timeout: 20_000,
  })

  await panel.close()
})

test('doi lai tieng Viet → UI doi ngay', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubBff(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await openSettings(panel)
  await selectLanguage(panel, 'en')
  await expect(panel.getByRole('heading', { name: 'Appearance' })).toBeVisible({
    timeout: 20_000,
  })

  // (4) Chon lai tieng Viet → UI doi ngay.
  await selectLanguage(panel, 'vi')
  await expect(panel.getByRole('heading', { name: 'Giao diện' })).toBeVisible({
    timeout: 20_000,
  })

  await panel.close()
})
