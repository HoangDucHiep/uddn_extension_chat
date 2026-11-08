import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: phim tat cau hinh duoc (FR-UX-01 — T-M1-18).
 *
 * Kiem chung:
 *  - (1) Section "Phim tat" xuat hien trong drawer Settings.
 *  - (2) Shortcut **native** cua Chrome phan chieu `chrome.commands.getAll()`.
 *  - (3) Doi shortcut **nhanh** → luu trong `chrome.storage.local` → UI hien
 *      shortcut moi → persist qua reload.
 *  - (4) Bam "Ve mac dinh" → xoa shortcut tu do → quay ve mac dinh.
 *
 * **Luu y quan trong:** Chrome **khong** co `chrome.commands.update()` /
 * `reset()` (do la API rieng cua **Firefox**) → shortcut **nhanh** cua Sidekick
 * luu trong `chrome.storage.local`, khong phai trong `chrome.commands`.
 * E2E nay assert **luu + phan chieu**, khong assert hành vi key-press (Playwright
 * headless khong kich hoat duoc accelerator cua trinh duyet — da ghi trong
 * `e2e/serviceWorker.spec.ts`).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.18
 */

/** Id cua command toggle panel. */
const TOGGLE_COMMAND = 'sidekick-toggle-panel'

/** Khoa storage luu shortcut tu do. */
const SHORTCUTS_STORAGE_KEY = 'sidekick.shortcuts'

/**
 * Doc shortcut native cua 1 command tu `chrome.commands`.
 *
 * @param panel - Page cua side panel.
 * @param name - Id cua command.
 * @returns Shortcut hien tai (chuoi rong neu chua gan).
 */
async function readNativeShortcut(panel: Page, name: string): Promise<string> {
  return await panel.evaluate(async (commandName) => {
    const all = await chrome.commands.getAll()
    const item = all.find((entry) => entry.name === commandName)
    return item?.shortcut ?? ''
  }, name)
}

/**
 * Doc shortcut tu do tu storage.
 *
 * @param panel - Page cua side panel.
 * @returns Shortcut da luu (chuoi rong neu chua co).
 */
async function readStoredShortcut(panel: Page): Promise<string> {
  return await panel.evaluate(async (key) => {
    const stored = await chrome.storage.local.get(key)
    const value = stored[key] as Record<string, string> | undefined
    return value?.['sidekick-toggle-panel'] ?? ''
  }, SHORTCUTS_STORAGE_KEY)
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

test('section phim tat xuat hien va phan chieu chrome.commands.getAll()', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await openSettings(panel)

  await expect(panel.getByTestId('settings-shortcuts')).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId(`shortcut-row-${TOGGLE_COMMAND}`)).toBeVisible()

  // Shortcut mac dinh tu manifest = Ctrl+Shift+K.
  await expect
    .poll(async () => await readNativeShortcut(panel, TOGGLE_COMMAND), { timeout: 20_000 })
    .toBe('Ctrl+Shift+K')

  // UI hien thi dung shortcut dang gan.
  await expect(panel.getByTestId(`shortcut-native-${TOGGLE_COMMAND}`)).toHaveText(
    'Ctrl+Shift+K',
  )

  await panel.close()
})

test('doi shortcut nhanh → luu vao storage → persist qua reload', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await openSettings(panel)

  await panel.getByTestId(`shortcut-change-${TOGGLE_COMMAND}`).click()
  await expect(panel.getByTestId(`shortcut-capture-${TOGGLE_COMMAND}`)).toBeFocused({
    timeout: 20_000,
  })

  // Bam to hop phim moi (Ctrl+Shift+M).
  //
  // **Khong** dung `Alt+...` → Alt mo menu cua trinh duyet → button mat
  // focus → `onBlur` dong che do bam phim truoc khi key "s" den.
  await panel.keyboard.press('Control+Shift+M')

  await expect
    .poll(async () => await readStoredShortcut(panel), { timeout: 20_000 })
    .toBe('Ctrl+Shift+M')

  await expect(panel.getByTestId(`shortcut-quick-${TOGGLE_COMMAND}`)).toHaveText(
    'Ctrl+Shift+M',
  )

  // Reload → shortcut tu do van duoc giu (persist trong storage.local).
  await panel.reload()
  await openSettings(panel)

  await expect(panel.getByTestId(`shortcut-quick-${TOGGLE_COMMAND}`)).toHaveText(
    'Ctrl+Shift+M',
  )

  await panel.close()
})

test('bam "Về mặc định" → xoa shortcut tu do → quay ve mac dinh', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Seed shortcut tu do truoc.
  await panel.evaluate(async (key) => {
    await chrome.storage.local.set({
      [key]: { 'sidekick-toggle-panel': 'Ctrl+Shift+M' },
    })
  }, SHORTCUTS_STORAGE_KEY)

  await openSettings(panel)

  await expect(panel.getByTestId(`shortcut-quick-${TOGGLE_COMMAND}`)).toHaveText(
    'Ctrl+Shift+M',
    { timeout: 20_000 },
  )

  // Reset → ve mac dinh cua manifest.
  await panel.getByTestId(`shortcut-reset-${TOGGLE_COMMAND}`).click()

  await expect
    .poll(async () => await readStoredShortcut(panel), { timeout: 20_000 })
    .toBe('')

  await expect(panel.getByTestId(`shortcut-quick-${TOGGLE_COMMAND}`)).toHaveText(
    'Ctrl+Shift+K',
  )

  await panel.close()
})
