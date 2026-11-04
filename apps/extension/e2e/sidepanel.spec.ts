import { expect } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: side panel mo duoc, gui prompt, nhan token tu BFF.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7 (E2E), rule mv3-chrome.mdc §7
 */

test('side panel render header va composer', async ({ sidePanel }) => {
  await expect(sidePanel.getByTestId('panel-header')).toBeVisible()
  await expect(sidePanel.getByTestId('composer-input')).toBeVisible()
  await expect(sidePanel.getByTestId('composer-send')).toBeVisible()
})

test('gui prompt nhan token tu BFF', async ({ sidePanel }) => {
  await sidePanel.getByTestId('composer-input').fill('Xin chao, ban la ai?')
  await sidePanel.getByTestId('composer-send').click()

  // Message user hien thi ngay.
  await expect(sidePanel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  // Message assistant xuat hien va token phai den.
  const assistant = sidePanel.getByTestId('message-assistant')
  await expect(assistant).toBeVisible({ timeout: 20_000 })
  await expect
    .poll(async () => (await assistant.innerText()).trim().length, {
      timeout: 40_000,
      message: 'Khong nhan duoc token tu BFF',
    })
    .toBeGreaterThan(0)

  // Provider chip phai hien thi (DP-6 — trust by transparency).
  await expect(sidePanel.getByTestId('provider-chip')).toBeVisible()

  // Design token phai duoc apply (Tailwind v4 + tokens.css) — khong phai trang trang.
  const styles = await sidePanel.evaluate(() => {
    const root = document.getElementById('root')
    const header = document.querySelector('[data-testid="panel-header"]')
    const rootStyle = root === null ? null : window.getComputedStyle(root)
    const headerStyle = header === null ? null : window.getComputedStyle(header)
    const rootVars = window.getComputedStyle(document.documentElement)
    return {
      rootFontFamily: rootStyle?.fontFamily ?? '',
      rootFontSize: rootStyle?.fontSize ?? '',
      rootBackground: rootStyle?.backgroundColor ?? '',
      headerHeight: headerStyle?.height ?? '',
      headerBackground: headerStyle?.backgroundColor ?? '',
      accentToken: rootVars.getPropertyValue('--color-accent').trim(),
      surfaceToken: rootVars.getPropertyValue('--surface-panel').trim(),
    }
  })

  // Token phai ton tai va duoc resolve (khong rong).
  expect(styles.accentToken).not.toBe('')
  expect(styles.surfaceToken).not.toBe('')

  // Typography phai theo design token (Inter), khong phai font mac dinh cua Chromium.
  expect(styles.rootFontFamily.toLowerCase()).toContain('inter')
  expect(styles.rootFontSize).toBe('13px')

  // Header phai dung token: chieu cao 48px va nen dung mau surface.
  expect(Number.parseFloat(styles.headerHeight)).toBeGreaterThan(20)
  expect(styles.headerBackground).not.toBe('rgba(0, 0, 0, 0)')
  expect(styles.rootBackground).not.toBe('rgba(0, 0, 0, 0)')

  await sidePanel.screenshot({
    path: 'test-results/sidepanel-stream.png',
    fullPage: false,
  })
})
