import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: parity "Panel giữ nguyên khi chuyển tab" (COMPARISON_MATRIX §E).
 *
 * Kiem chung:
 *  - (1) Gửi 1 lượt chat → thread có nội dung.
 *  - (2) Đổi tab → **thread vẫn còn nguyên** (không mất message, không
 *      reset về empty state).
 *  - (3) Đồng thời, `PromptGallery` / gợi ý **đổi theo trang mới** → chứng
 *      minh panel thật sự nhận sự kiện đổi tab (không phải "đơ" vì không
 *      nghe event).
 *  - (4) Đổi tab lần 2 → thread vẫn giữ.
 *
 * Cơ chế: side panel thuộc **cửa sổ** → Chrome giữ panel mở khi đổi tab
 * trong cùng cửa sổ (hành vi native). React state của panel sống suốt
 * (document không reload) → thread / draft / context chips không mất.
 *
 * `chrome.tabs` bị override bằng `addInitScript` (copy helper `mockTab` của
 * `e2e/promptGallery.spec.ts`) → test chạy độc lập, không cần Docker.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.21
 */

/** SSE stream giả lập — đủ để panel có token và kết thúc stream. */
const SSE_BODY = [
  'event: meta',
  'data: {"type":"meta","messageId":"msg-1","conversationId":"11111111-1111-4111-8111-111111111111","provider":"mock","model":"mock-model","keySource":"K1","requestId":"req-1"}',
  '',
  'event: token',
  'data: {"type":"token","delta":"Cau tra loi mau","index":0}',
  '',
  'event: done',
  'data: {"type":"done","finishReason":"stop","messageId":"msg-1"}',
  '',
  '',
].join('\n')

/**
 * Stub route `/api/chat` với SSE giả lập.
 *
 * @param panel - Trang side panel.
 */
async function stubChat(panel: Page): Promise<void> {
  await panel.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: SSE_BODY,
    })
  })
}

/**
 * Mock `chrome.tabs` + `chrome.scripting` trong panel — có đổi tab.
 *
 * `window.__switchTab(url, title)` đổi tab active và phát toản
 * `tabs.onActivated` → test kiểm tra gallery đổi gợi ý theo trang mới.
 *
 * `window.__tabsQueryCount()` đếm số lần panel đọc tab → chứng minh panel
 * **thật sự** phản ứng với sự kiện đổi tab (không chỉ "đơ" vì state đứng yên).
 *
 * @param panel - Trang panel.
 * @param url - URL của tab đang active.
 * @param title - Tiêu đề của tab đang active.
 */
async function mockTab(panel: Page, url: string, title: string): Promise<void> {
  await panel.addInitScript(
    ({ tabUrl, tabTitle }) => {
      const state = {
        url: tabUrl as string,
        title: tabTitle as string,
      }

      let queryCount = 0

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
          onUpdated: {
            addListener: (listener: (info: unknown) => void) => void
            removeListener: (listener: (info: unknown) => void) => void
          }
        }
        scripting: {
          executeScript: (injection: unknown) => Promise<unknown[]>
        }
      }

      chromeApi.tabs.query = async (query: { active?: boolean }) => {
        queryCount += 1
        return query && query.active ? [{ ...tab, url: state.url, title: state.title }] : []
      }
      chromeApi.tabs.get = async () => ({ ...tab, url: state.url, title: state.title })
      chromeApi.scripting.executeScript = async () => [
        {
          result: {
            title: state.title,
            byline: '',
            url: state.url,
            text: 'Day la noi dung chinh cua trang dang xem, rat dai va chi tiet.',
            excerpt: 'Day la noi dung chinh cua trang dang xem.',
            strategy: 'article',
            wordCount: 16,
          },
        },
      ]

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

      chromeApi.tabs.onUpdated = {
        addListener: () => {},
        removeListener: () => {},
      }

      const globals = globalThis as unknown as {
        __switchTab: (url: string, title: string) => void
        __tabsQueryCount: () => number
      }

      globals.__switchTab = (nextUrl: string, nextTitle: string) => {
        state.url = nextUrl
        state.title = nextTitle
        for (const listener of activatedListeners) {
          listener({ tabId: 777, windowId: 1 })
        }
      }

      globals.__tabsQueryCount = () => queryCount
    },
    { tabUrl: url, tabTitle: title },
  )
}

test('đổi tab → gallery đổi gợi ý theo trang mới (panel nghe sự kiện)', async ({
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

  // Đổi sang tab thảo luận → gallery đổi profile.
  await panel.evaluate(() => {
    ;(globalThis as unknown as { __switchTab: (url: string, title: string) => void }).__switchTab(
      'https://stackoverflow.com/questions/1/how-to',
      'How to? | Stack Overflow',
    )
  })

  await expect(gallery).toHaveAttribute('data-profile', 'forum', { timeout: 20_000 })

  await panel.close()
})

test('đổi tab khi đã có thread → thread giữ nguyên, panel vẫn đọc tab mới', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await mockTab(panel, 'https://developer.mozilla.org/en-US/docs/Web/API', 'Web APIs | MDN')
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await expect(panel.getByTestId('prompt-gallery')).toBeVisible({ timeout: 20_000 })

  // Gửi 1 lượt chat → thread có nội dung.
  await panel.getByTestId('composer-input').fill('Xin chào')
  await panel.getByTestId('composer-send').click()

  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('message-assistant')).toBeVisible({ timeout: 20_000 })

  const queryCountBefore = await panel.evaluate(() => {
    return (
      globalThis as unknown as { __tabsQueryCount: () => number }
    ).__tabsQueryCount()
  })

  // Đổi tab.
  await panel.evaluate(() => {
    ;(globalThis as unknown as { __switchTab: (url: string, title: string) => void }).__switchTab(
      'https://stackoverflow.com/questions/1/how-to',
      'How to? | Stack Overflow',
    )
  })

  // Panel **phản ứng** với sự kiện đổi tab (đọc lại thông tin tab).
  await expect
    .poll(async () => {
      return await panel.evaluate(() => {
        return (
          globalThis as unknown as { __tabsQueryCount: () => number }
        ).__tabsQueryCount()
      })
    })
    .toBeGreaterThan(queryCountBefore)

  // **Quan trọng:** thread vẫn còn nguyên — không mất message.
  await expect(panel.getByTestId('message-user')).toBeVisible()
  await expect(panel.getByTestId('message-assistant')).toBeVisible()
  await expect(panel.getByTestId('message-user')).toHaveText('Xin chào')
  await expect(panel.getByTestId('message-assistant')).toContainText('Cau tra loi mau')

  // Không quay về empty state (gallery chỉ hiện khi thread rỗng).
  await expect(panel.getByTestId('prompt-gallery')).toHaveCount(0)

  await panel.close()
})

test('đổi tab lần 2 → thread vẫn giữ nguyên', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await mockTab(panel, 'https://developer.mozilla.org/en-US/docs/Web/API', 'Web APIs | MDN')
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await expect(panel.getByTestId('prompt-gallery')).toBeVisible({ timeout: 20_000 })

  await panel.getByTestId('composer-input').fill('Xin chào')
  await panel.getByTestId('composer-send').click()

  await expect(panel.getByTestId('message-assistant')).toBeVisible({ timeout: 20_000 })

  await panel.evaluate(() => {
    ;(globalThis as unknown as { __switchTab: (url: string, title: string) => void }).__switchTab(
      'https://stackoverflow.com/questions/1/how-to',
      'How to? | Stack Overflow',
    )
  })

  await expect(panel.getByTestId('prompt-gallery')).toHaveCount(0)

  await panel.evaluate(() => {
    ;(globalThis as unknown as { __switchTab: (url: string, title: string) => void }).__switchTab(
      'https://news.ycombinator.com/',
      'Hacker News',
    )
  })

  await expect(panel.getByTestId('message-user')).toBeVisible()
  await expect(panel.getByTestId('message-assistant')).toContainText('Cau tra loi mau')

  await panel.close()
})
