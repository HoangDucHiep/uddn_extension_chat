import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: goi y theo trang + tom tat 1-click (FR-UX-03 / FR-UX-04 — T-M1-11).
 *
 * Kiem chung:
 *  - (1) Tab active la trang tai lieu → gallery hien goi y theo profile `docs`.
 *  - (2) Bam 1 goi y → request co `messages[0].content` = prompt **va**
 *        `context.items[0]` = trang vua tu dinh kem.
 *  - (3) Bam "Tom tat trang nay" → request chua `SUMMARY_PROMPT` + context.
 *  - (4) Khong co tab doc duoc (`chrome://`) → hien goi y chung (FR-UX-04).
 *
 * BFF duoc stub bang `page.route`, `chrome.tabs` bi override bang
 * `addInitScript` — cung pattern voi `e2e/context.spec.ts`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.12
 */

interface CapturedChatRequest {
  messages?: Array<{ role: string; content: string }>
  context?: { items?: Array<{ id?: string; tier?: string; title?: string; url?: string }> }
}

/** SSE stream gia lap — du de panel co token va ket thuc stream. */
const SSE_BODY = [
  'event: meta',
  'data: {"type":"meta","messageId":"msg-1","conversationId":"11111111-1111-4111-8111-111111111111","provider":"mock","model":"mock-model","keySource":"K1","requestId":"req-1"}',
  '',
  'event: token',
  'data: {"type":"token","delta":"OK","index":0}',
  '',
  'event: done',
  'data: {"type":"done","finishReason":"stop","messageId":"msg-1"}',
  '',
  '',
].join('\n')

/** Giu lai request body gui len BFF de assert. */
async function stubChat(panel: Page): Promise<CapturedChatRequest[]> {
  const captured: CapturedChatRequest[] = []

  await panel.route('**/api/chat', async (route) => {
    const raw = route.request().postData()
    if (raw !== null) {
      captured.push(JSON.parse(raw) as CapturedChatRequest)
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: SSE_BODY,
    })
  })

  return captured
}

/**
 * Mock `chrome.tabs` + `chrome.scripting` trong panel — co the doi tab.
 *
 * `window.__switchTab(url, title)` doi tab active va phong toan `tabs.onActivated`
 * → test kiem tra gallery doi goi y theo trang moi (FR-UX-03).
 *
 * @param panel - Trang panel.
 * @param url - URL cua tab dang active.
 * @param title - Tieu de cua tab dang active.
 */
async function mockTab(panel: Page, url: string, title: string): Promise<void> {
  await panel.addInitScript(
    ({ tabUrl, tabTitle }) => {
      const state = {
        url: tabUrl as string,
        title: tabTitle as string,
      }

      const tab = {
        id: 777,
        url: tabUrl,
        title: tabTitle,
        active: true,
        windowId: 1,
      }

      const chromeApi = globalThis.chrome as unknown as {
        tabs: {
          query: (query: { active?: boolean }) => Promise<unknown[]>
          get: () => Promise<unknown>
          onActivated: {
            addListener: (listener: (info: unknown) => void) => void
            removeListener: (listener: (info: unknown) => void) => void
          }
        }
        scripting: {
          executeScript: (injection: unknown) => Promise<unknown[]>
        }
      }

      chromeApi.tabs.query = async (query: { active?: boolean }) =>
        query && query.active ? [{ ...tab, url: state.url, title: state.title }] : []
      chromeApi.tabs.get = async () => ({ ...tab, url: state.url, title: state.title })
      chromeApi.scripting.executeScript = async () => [
        {
          result: {
            title: tabTitle,
            byline: '',
            url: tabUrl,
            text: 'Day la noi dung chinh cua trang dang xem, rat dai va chi tiet.',
            excerpt: 'Day la noi dung chinh cua trang dang xem.',
            strategy: 'article',
            wordCount: 16,
          },
        },
      ]

      // Giu listener de test phong toan su kien doi tab.
      const activatedListeners: ((info: unknown) => void)[] = []
      chromeApi.tabs.onActivated = {
        addListener: (listener) => {
          activatedListeners.push(listener)
        },
        removeListener: (listener) => {
          const index = activatedListeners.indexOf(listener)
          if (index >= 0) activatedListeners.splice(index, 1)
        },
      }

      ;(globalThis as unknown as { __switchTab: (url: string, title: string) => void })
        .__switchTab = (nextUrl: string, nextTitle: string) => {
        state.url = nextUrl
        state.title = nextTitle
        for (const listener of activatedListeners) {
          listener({ tabId: 777, windowId: 1 })
        }
      }
    },
    { tabUrl: url, tabTitle: title },
  )
}

test('tab la trang tai lieu → gallery hien goi y theo profile docs', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await mockTab(panel, 'https://developer.mozilla.org/en-US/docs/Web/API', 'Web APIs | MDN')
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  const gallery = panel.getByTestId('prompt-gallery')
  await expect(gallery).toBeVisible({ timeout: 20_000 })
  await expect(gallery).toHaveAttribute('data-profile', 'docs')

  // It nhat 3 goi y (FR-UX-03).
  await expect(panel.getByTestId('prompt-suggestion')).toHaveCount(4)

  // Co nut tom tat 1-click.
  await expect(panel.getByTestId('summarize-button')).toBeVisible()

  await panel.close()
})

test('bam goi y → tu dinh kem trang roi gui prompt', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await mockTab(panel, 'https://developer.mozilla.org/en-US/docs/Web/API', 'Web APIs | MDN')
  const captured = await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await expect(panel.getByTestId('prompt-gallery')).toBeVisible({ timeout: 20_000 })

  await panel.getByTestId('prompt-suggestion').first().click()

  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  const request = captured[0]
  expect(request?.messages?.[0]?.content?.length).toBeGreaterThan(0)
  // Tu dinh kem trang hien tai truoc khi gui (FR-CONTEXT-13 + FR-UX-03).
  expect(request?.context?.items).toHaveLength(1)
  expect(request?.context?.items?.[0]?.title).toBe('Web APIs | MDN')

  await panel.close()
})

test('bam "Tom tat trang nay" → gui SUMMARY_PROMPT kem context', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await mockTab(panel, 'https://developer.mozilla.org/en-US/docs/Web/API', 'Web APIs | MDN')
  const captured = await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await expect(panel.getByTestId('summarize-button')).toBeVisible({ timeout: 20_000 })
  await panel.getByTestId('summarize-button').click()

  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  const request = captured[0]
  expect(request?.messages?.[0]?.content).toContain('Tóm tắt trang này')
  expect(request?.context?.items).toHaveLength(1)

  await panel.close()
})

test('khong co tab doc duoc → hien goi y chung (FR-UX-04)', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await panel.addInitScript(() => {
    const chromeApi = globalThis.chrome as unknown as {
      tabs: {
        query: (query: { active?: boolean }) => Promise<unknown[]>
        get: () => Promise<unknown>
      }
    }
    chromeApi.tabs.query = async (query: { active?: boolean }) =>
      query && query.active
        ? [{ id: 778, url: 'chrome://extensions', title: 'Extensions', active: true, windowId: 1 }]
        : []
    chromeApi.tabs.get = async () => ({
      id: 778,
      url: 'chrome://extensions',
      title: 'Extensions',
    })
  })
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  const gallery = panel.getByTestId('prompt-gallery')
  await expect(gallery).toBeVisible({ timeout: 20_000 })
  await expect(gallery).toHaveAttribute('data-profile', 'general')

  // Van co goi y chung (>= 3).
  await expect(panel.getByTestId('prompt-suggestion')).toHaveCount(4)

  // Khong nut tom tat (khong doc duoc trang).
  await expect(panel.getByTestId('summarize-button')).toHaveCount(0)

  await panel.close()
})

test('doi tab → gallery doi goi y theo trang moi', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await mockTab(panel, 'https://developer.mozilla.org/en-US/docs/Web/API', 'Web APIs | MDN')
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  const gallery = panel.getByTestId('prompt-gallery')
  await expect(gallery).toBeVisible({ timeout: 20_000 })
  await expect(gallery).toHaveAttribute('data-profile', 'docs')

  // Chuyen sang trang thao luan → gallery phai doi profile.
  await panel.evaluate(() => {
    ;(globalThis as unknown as { __switchTab: (url: string, title: string) => void }).__switchTab(
      'https://stackoverflow.com/questions/1/how-to',
      'How to? | Stack Overflow',
    )
  })

  await expect(gallery).toHaveAttribute('data-profile', 'forum', { timeout: 20_000 })

  await panel.close()
})
