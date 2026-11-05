import { expect } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: onboarding 3 buoc lan dau (FR-UX-02 — T-M1-25).
 *
 * Kien thuc:
 *  1. Mo panel lan dau → thay man hinh onboarding (buoc 1).
 *  2. Bỏ qua → panel chuyen sang chat, co ghi `completed = true`.
 *  3. Mo lai → khong con onboarding.
 *  4. Nut "Hướng dẫn" trong header → mở lại onboarding.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.6
 */

test('lan dau mo panel → hien thi onboarding 3 buoc', async ({ sidePanelFresh }) => {
  await expect(sidePanelFresh.getByTestId('onboarding')).toBeVisible()
  await expect(sidePanelFresh.getByTestId('onboarding-step-permissions')).toBeVisible()
  await expect(sidePanelFresh.getByText('Buoc 1/3 · Quyen')).toBeVisible()

  // Chat chua duoc hien thi khi onboarding chua xong.
  await expect(sidePanelFresh.getByTestId('message-list')).toHaveCount(0)
})

test('buoc 1 → buoc 2 → buoc 3', async ({ sidePanelFresh }) => {
  await sidePanelFresh.getByTestId('onboarding-next').click()
  await expect(sidePanelFresh.getByTestId('onboarding-step-provider')).toBeVisible()

  await sidePanelFresh.getByTestId('onboarding-next').click()
  await expect(sidePanelFresh.getByTestId('onboarding-step-try')).toBeVisible()
})

test('bo qua onboarding → panel chuyen sang chat va ghi completed', async ({
  sidePanelFresh,
}) => {
  await sidePanelFresh.getByTestId('onboarding-skip').click()

  // Chat hien thi.
  await expect(sidePanelFresh.getByTestId('panel-header')).toBeVisible()
  await expect(sidePanelFresh.getByTestId('composer-input')).toBeVisible()
  await expect(sidePanelFresh.getByTestId('onboarding')).toHaveCount(0)

  // Co ghi co "da hoan thanh" trong storage.
  const completed = await sidePanelFresh.evaluate(async () => {
    const result = await chrome.storage.local.get('sidekick.onboarding.completed')
    return result['sidekick.onboarding.completed']
  })
  expect(completed).toBe(true)
})

test('reload lai → khong con hien thi onboarding', async ({ sidePanelFresh }) => {
  await sidePanelFresh.getByTestId('onboarding-skip').click()
  await expect(sidePanelFresh.getByTestId('panel-header')).toBeVisible()

  await sidePanelFresh.reload()

  await expect(sidePanelFresh.getByTestId('panel-header')).toBeVisible()
  await expect(sidePanelFresh.getByTestId('onboarding')).toHaveCount(0)
})

test('nut "Huong dan" trong header → mo lai onboarding', async ({ sidePanelFresh }) => {
  await sidePanelFresh.getByTestId('onboarding-skip').click()
  await expect(sidePanelFresh.getByTestId('panel-header')).toBeVisible()

  await sidePanelFresh.getByTestId('help-button').click()

  await expect(sidePanelFresh.getByTestId('onboarding')).toBeVisible()
  await expect(sidePanelFresh.getByTestId('onboarding-step-permissions')).toBeVisible()
})

test('co nut "Huong dan" trong header khi da bo qua onboarding', async ({ sidePanel }) => {
  await expect(sidePanel.getByTestId('help-button')).toBeVisible()
  await expect(sidePanel.getByTestId('onboarding')).toHaveCount(0)
})
