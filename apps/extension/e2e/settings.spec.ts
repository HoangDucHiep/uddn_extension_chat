import { expect, type Page, type Route } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: drawer cai dat (FR-SETTINGS-01/02/03/05 + FR-UX-06 — T-M1-12).
 *
 * Kiem chung:
 *  - (1) Bam nut gear → drawer cai dat mo.
 *  - (2) Chon theme "Tối" → `<html>` co class `.dark` → reload → van `.dark`.
 *  - (3) Doi co chu → `--font-scale` doi → reload → giu nguyen.
 *  - (4) Xoa lich su chat (stub `DELETE /api/conversations`) → confirm → xoa.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can server that.
 * Docs: docs/SYSTEM_DESIGN.md §7.14
 */

/**
 * Stub API lien quan den conversation + health check.
 *
 * @param panel - Page cua side panel.
 * @param calls - Mang ghi lai cac request DELETE da goi.
 */
async function stubBff(panel: Page, calls: string[]): Promise<void> {
  await panel.route('**/api/conversations**', async (route: Route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname

    if (method === 'DELETE' && path.endsWith('/api/conversations')) {
      calls.push('DELETE /api/conversations')
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ deleted: 2 }),
      })
      return
    }

    if (method === 'GET' && path.endsWith('/api/conversations')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ items: [] }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({}),
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

test('bam nut gear → drawer cai dat mo', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubBff(panel, [])

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openSettings(panel)

  // 6 section cua drawer (dung `heading` de tranh strict-mode violation).
  await expect(panel.getByRole('heading', { name: 'Giao diện' })).toBeVisible({
    timeout: 20_000,
  })
  await expect(panel.getByRole('heading', { name: 'Quản lý dữ liệu' })).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Máy chủ (BFF)' })).toBeVisible()

  await panel.close()
})

test('chon theme tối → html co class .dark → reload van giu', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubBff(panel, [])

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openSettings(panel)

  await panel.getByTestId('radio-dark').click()

  await expect
    .poll(async () => {
      return panel.evaluate(() => document.documentElement.classList.contains('dark'))
    }, { timeout: 20_000 })
    .toBe(true)

  // Reload → cai dat van duoc giu (persist qua storage.local).
  await panel.reload()
  await expect
    .poll(async () => {
      return panel.evaluate(() => document.documentElement.classList.contains('dark'))
    }, { timeout: 20_000 })
    .toBe(true)

  await panel.close()
})

test('doi cỡ chữ → --font-scale đổi → reload giữ nguyên', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubBff(panel, [])

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openSettings(panel)

  await panel.getByTestId('radio-1.2').click()

  await expect
    .poll(async () => {
      return panel.evaluate(() =>
        document.documentElement.style.getPropertyValue('--font-scale'),
      )
    }, { timeout: 20_000 })
    .toBe('1.2')

  await panel.reload()
  await expect
    .poll(async () => {
      return panel.evaluate(() =>
        document.documentElement.style.getPropertyValue('--font-scale'),
      )
    }, { timeout: 20_000 })
    .toBe('1.2')

  await panel.close()
})

test('xoá lịch sử chat → confirm → gọi DELETE /api/conversations', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  const calls: string[] = []
  await stubBff(panel, calls)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openSettings(panel)

  await panel.getByTestId('settings-delete-history').click()
  await expect(panel.getByTestId('confirm-dialog')).toBeVisible({ timeout: 20_000 })

  await panel.getByTestId('confirm-accept').click()

  await expect.poll(() => calls.length, { timeout: 20_000 }).toBe(1)
  expect(calls[0]).toBe('DELETE /api/conversations')

  await panel.close()
})
