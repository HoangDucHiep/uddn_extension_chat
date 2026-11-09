import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: model picker + fallback + chi phi (T-M2-02, T-M2-03).
 *
 * Kiểm chứng:
 *  - (1) Model picker mo → tai danh sach provider/model tu BFF.
 *  - (2) Chon model → luu vao `chrome.storage.local` → request chat **gui
 *        kèm** `provider` + `model`.
 *  - (3) Badge token + chi phi hien duoi bubble assistant.
 *  - (4) Section "Chi phí & sử dụng" trong Settings tai duoc so lieu.
 *
 * Cần BFF thật + Postgres (docker compose up -d) → test tự skip nếu BFF
 * không chạy.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.22, §7.23
 */

/** Base URL cua BFF. */
const BFF_URL = 'http://127.0.0.1:8787'

/**
 * Kiem tra BFF co chay khong.
 *
 * @param page - Trang Playwright de gui request.
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

test('model picker tai danh sach model dong va gui provider/model len BFF', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()

  if (!(await isBffUp(panel))) {
    await panel.close()
    test.skip(true, 'BFF chua chay (docker compose up -d) — bo qua E2E model picker.')
    return
  }

  // Bat payload request chat de kiem chung provider + model duoc gui len.
  const chatBodies: Array<{ provider?: string; model?: string }> = []
  panel.on('request', (request) => {
    if (!request.url().includes('/api/chat')) return
    const data = request.postData()
    if (data === null) return
    try {
      chatBodies.push(JSON.parse(data) as { provider?: string; model?: string })
    } catch {
      // Body khong phai JSON → bo qua.
    }
  })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // --- Mo model picker ---
  await panel.getByTestId('model-picker-button').click()
  await expect(panel.getByTestId('model-picker')).toBeVisible()

  // Danh sach provider (chi provider `available`) phai render.
  await expect(panel.getByTestId('model-picker-providers').locator('button').first()).toBeVisible()

  // --- Chon 1 model ---
  const firstModel = panel.getByTestId('model-picker-models').locator('button').first()
  await expect(firstModel).toBeVisible()
  const modelName = (await firstModel.textContent())?.trim() ?? ''
  expect(modelName.length).toBeGreaterThan(0)
  await firstModel.click()

  // Lua chon duoc luu vao `chrome.storage.local`.
  const saved = await panel.evaluate(async () => {
    const raw = await chrome.storage.local.get('sidekick.modelSelection')
    return raw['sidekick.modelSelection'] as
      | { providerId?: string | null; model?: string | null }
      | undefined
  })
  expect(saved?.model).toBe(modelName)
  expect(saved?.providerId).toBeTruthy()

  // --- Gui cau hoi → request phai co provider + model ---
  await panel.getByTestId('composer-input').fill('Hoi de kiem chung model picker')
  await panel.getByTestId('composer-send').click()
  await expect(panel.getByTestId('message-assistant')).toBeVisible({ timeout: 30_000 })

  await expect.poll(() => chatBodies.length, { timeout: 20_000 }).toBeGreaterThan(0)
  const body = chatBodies[0]
  expect(body?.provider).toBe(saved?.providerId)
  expect(body?.model).toBe(modelName)

  await panel.close()
})

test('badge token + chi phi hien duoi bubble assistant', async ({ context, extensionId }) => {
  const panel = await context.newPage()

  if (!(await isBffUp(panel))) {
    await panel.close()
    test.skip(true, 'BFF chua chay (docker compose up -d) — bo qua E2E usage badge.')
    return
  }

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('composer-input').fill('Xin chao')
  await panel.getByTestId('composer-send').click()
  await expect(panel.getByTestId('message-assistant')).toBeVisible({ timeout: 30_000 })

  // Badge usage chi xuat hien khi luot chat co usage (token > 0).
  const badge = panel.getByTestId('usage-badge')
  await expect(badge).toBeVisible({ timeout: 30_000 })
  await expect(badge).toContainText('token')

  await panel.close()
})

test('section "Chi phi & su dung" trong Settings tai duoc so lieu', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()

  if (!(await isBffUp(panel))) {
    await panel.close()
    test.skip(true, 'BFF chua chay (docker compose up -d) — bo qua E2E usage settings.')
    return
  }

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Mo Settings.
  await panel.getByTestId('settings-button').click()
  await expect(panel.getByTestId('settings-drawer')).toBeVisible()

  // Section chi phi & su dung.
  await expect(panel.getByText('Chi phí & sử dụng')).toBeVisible()
  await expect(panel.getByTestId('usage-total-tokens')).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('usage-total-cost')).toBeVisible()

  await panel.close()
})
