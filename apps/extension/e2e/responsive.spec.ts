import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: responsive 320–640px (FR-UX-06 / FR-UX-09 — T-M1-20).
 *
 * Kiem chung:
 *  - (1) Panel **khong tran ngang** o cac viewport 320 / 480 / 640px.
 *  - (2) Drawer Settings (trượt từ phải) + drawer danh sách cuộc trò chuyện
 *      (trượt từ trái) cũng **không tràn ngang**.
 *  - (3) Nội dung chính (composer + thread) vẫn **nhìn thấy được** —
 *      không bị đẩy ra ngoài khung nhìn.
 *
 * **Lưu ý:** viewport của side panel **không** phải viewport của cửa sổ
 * browser → phải `setViewportSize()` trên **page của panel**.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.19
 */

/** Cac viewport can kiem chung (px). */
const VIEWPORTS: readonly { width: number; height: number }[] = [
  { width: 320, height: 800 },
  { width: 480, height: 800 },
  { width: 640, height: 800 },
]

/**
 * Do chieu rong noi dung vs khung nhin cua trang hien tai.
 *
 * @param page - Page cua side panel.
 * @returns `{ scrollWidth, clientWidth }` cua `documentElement`.
 */
async function readWidths(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
}

/**
 * Mo drawer danh sach cuoc tro chuyen (trượt từ trái).
 *
 * @param panel - Page cua side panel.
 */
async function openConversationDrawer(panel: Page): Promise<void> {
  await panel.getByTestId('conversations-button').click()
  await expect(panel.getByTestId('conversation-list')).toBeVisible({ timeout: 20_000 })
}

/**
 * Mo drawer cai dat (trượt từ phải).
 *
 * @param panel - Page cua side panel.
 */
async function openSettingsDrawer(panel: Page): Promise<void> {
  await panel.getByTestId('settings-button').click()
  await expect(panel.getByTestId('settings-drawer')).toBeVisible({ timeout: 20_000 })
}

for (const viewport of VIEWPORTS) {
  test(`panel khong tran ngang o ${viewport.width}px`, async ({ context, extensionId }) => {
    const panel = await context.newPage()
    await panel.setViewportSize({ width: viewport.width, height: viewport.height })
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

    await expect(panel.getByTestId('composer')).toBeVisible({ timeout: 20_000 })

    const widths = await readWidths(panel)
    expect(
      widths.scrollWidth,
      `documentElement.scrollWidth (${widths.scrollWidth}) phai <= clientWidth (${widths.clientWidth})`,
    ).toBeLessThanOrEqual(widths.clientWidth)

    await panel.close()
  })
}

test('drawer settings + danh sach cuoc tro chuyen khong tran ngang o 320px', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await panel.setViewportSize({ width: 320, height: 800 })
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await expect(panel.getByTestId('composer')).toBeVisible({ timeout: 20_000 })

  // Drawer Settings.
  await openSettingsDrawer(panel)
  const settingsWidths = await readWidths(panel)
  expect(
    settingsWidths.scrollWidth,
    `drawer Settings: scrollWidth (${settingsWidths.scrollWidth}) phai <= clientWidth (${settingsWidths.clientWidth})`,
  ).toBeLessThanOrEqual(settingsWidths.clientWidth)

  // Dong drawer Settings → mo drawer danh sách cuộc trò chuyện.
  await panel.keyboard.press('Escape')
  await expect(panel.getByTestId('settings-drawer')).toBeHidden({ timeout: 20_000 })

  await openConversationDrawer(panel)
  const conversationWidths = await readWidths(panel)
  expect(
    conversationWidths.scrollWidth,
    `drawer hoi thoai: scrollWidth (${conversationWidths.scrollWidth}) phai <= clientWidth (${conversationWidths.clientWidth})`,
  ).toBeLessThanOrEqual(conversationWidths.clientWidth)

  await panel.close()
})

test('composer + header van nhin thay duoc o 320px', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await panel.setViewportSize({ width: 320, height: 800 })
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await expect(panel.getByTestId('composer')).toBeVisible({ timeout: 20_000 })

  // Ô nhập phải **nằm trong** khung nhìn (không bị đẩy ra ngoài).
  const inputBox = await panel.getByTestId('composer-input').boundingBox()
  expect(inputBox).not.toBeNull()
  if (inputBox !== null) {
    expect(inputBox.x).toBeGreaterThanOrEqual(0)
    expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(320 + 1)
  }

  await panel.close()
})
