import { expect } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: trich xuat context PDF / transcript YouTube — panel hien thi thong bao.
 *
 * Kiem chung:
 *  - Panel goi `POST /api/extract/pdf` khi tab dang mo la file PDF.
 *  - BFF tra loi nghiep vu (HTTP 200 + `error`) → panel hien thi `ContextNotice`
 *    instead of crash (FR-CONTEXT-05, docs/SYSTEM_DESIGN.md §7.3.1).
 *
 * Luu y (T-M1-23): context khong tu capture moi luot — chi trich xuat khi
 * user bam "Them trang nay". Test phai bam nut do truoc.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can server that.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.1
 */

test('panel hien thi ContextNotice khi PDF khong trich duoc duoc', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()

  // Panel phai "thay" tab dang mo la file PDF.
  await panel.addInitScript(() => {
    const tab = {
      id: 999,
      url: 'https://example.com/tai-lieu.pdf',
      title: 'Tai lieu PDF',
      active: true,
      windowId: 1,
    }
    const chromeApi = globalThis.chrome as unknown as {
      tabs: {
        query: (query: { active?: boolean }) => Promise<unknown[]>
        get: () => Promise<unknown>
      }
    }
    chromeApi.tabs.query = async (query: { active?: boolean }) =>
      query && query.active ? [tab] : []
    chromeApi.tabs.get = async () => tab
  })

  // Stub BFF: tra loi nghiep vu (HTTP 200 kem `error`).
  await panel.route('**/api/extract/pdf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        kind: 'pdf',
        text: '',
        truncated: false,
        error: 'CONTEXT_PDF_NOT_READABLE',
        errorMessage: 'PDF khong co text layer',
      }),
    })
  })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Chi trich xuat khi user dinh kem trang (T-M1-23).
  await panel.getByTestId('context-add-tab').click()

  const notice = panel.getByTestId('context-notice')
  await expect(notice).toBeVisible({ timeout: 20_000 })
  await expect(notice).toHaveAttribute('data-error-code', 'CONTEXT_PDF_NOT_READABLE')
  await expect(notice).toContainText('ban scan')

  await panel.close()
})

test('panel hien thi ContextNotice khi video khong co phu de', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()

  await panel.addInitScript(() => {
    const tab = {
      id: 998,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Video hoc AI',
      active: true,
      windowId: 1,
    }
    const chromeApi = globalThis.chrome as unknown as {
      tabs: {
        query: (query: { active?: boolean }) => Promise<unknown[]>
        get: () => Promise<unknown>
      }
    }
    chromeApi.tabs.query = async (query: { active?: boolean }) =>
      query && query.active ? [tab] : []
    chromeApi.tabs.get = async () => tab
  })

  await panel.route('**/api/extract/youtube', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        kind: 'youtube',
        text: '',
        truncated: false,
        error: 'CONTEXT_TRANSCRIPT_UNAVAILABLE',
        errorMessage: 'Video khong co phu de',
      }),
    })
  })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Chi trich xuat khi user dinh kem trang (T-M1-23).
  await panel.getByTestId('context-add-tab').click()

  const notice = panel.getByTestId('context-notice')
  await expect(notice).toBeVisible({ timeout: 20_000 })
  await expect(notice).toHaveAttribute('data-error-code', 'CONTEXT_TRANSCRIPT_UNAVAILABLE')
  await expect(notice).toContainText('phu de')

  await panel.close()
})
