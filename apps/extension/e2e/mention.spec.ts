import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: `@` mention multi-tab (T-M1-05, FR-CONTEXT-03).
 *
 * Kiem chung:
 *  - (1) Go `@` → popover hien danh sach tab.
 *  - (2) Chon tab → chip context xuat hien + textarea chen `@tieu de`.
 *  - (3) Request gui len BFF co `context.items[0]` dung tab da chon.
 *  - (4) Escape → dong popover.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap.
 * Docs: docs/SYSTEM_DESIGN.md §7.3.3
 */

interface CapturedChatRequest {
  context?: { items?: Array<{ id?: string; tier?: string; title?: string; url?: string }> }
}

/** SSE stream gia lap. */
const SSE_BODY = [
  'event: meta',
  'data: {"type":"meta","messageId":"msg-1","conversationId":"11111111-1111-4111-8111-111111111111","provider":"mock","model":"mock-model","keySource":"K1","requestId":"req-1"}',
  '',
  'event: token',
  'data: {"type":"token","delta":"Da nhan","index":0}',
  '',
  'event: done',
  'data: {"type":"done","finishReason":"stop","messageId":"msg-1"}',
  '',
  '',
].join('\n')

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
 * Mock nhieu tab + `chrome.scripting` de moi tab co noi dung rieng.
 */
async function mockTabs(panel: Page): Promise<void> {
  await panel.addInitScript(() => {
    const tabs = [
      {
        id: 111,
        url: 'https://alpha.com/bai-viet',
        title: 'Bai viet Alpha',
        active: true,
        windowId: 1,
      },
      {
        id: 222,
        url: 'https://beta.com/tai-lieu',
        title: 'Tai lieu Beta',
        active: false,
        windowId: 1,
      },
    ]

    const chromeApi = globalThis.chrome as unknown as {
      tabs: {
        query: (query: { active?: boolean }) => Promise<unknown[]>
        get: (tabId: number) => Promise<unknown>
      }
      scripting: {
        executeScript: (injection: unknown) => Promise<unknown[]>
      }
    }

    chromeApi.tabs.query = async (query: { active?: boolean }) => {
      if (query && query.active === true) return [tabs[0]]
      return tabs
    }
    chromeApi.tabs.get = async (tabId: number) =>
      tabs.find((tab) => tab.id === tabId) ?? tabs[0]
    chromeApi.scripting.executeScript = async (injection: unknown) => {
      const target = (injection as { target?: { tabId?: number } } | undefined)?.target
      const tabId = target?.tabId
      const tab = tabs.find((item) => item.id === tabId) ?? tabs[0]
      return [
        {
          result: {
            title: tab?.title ?? 'Trang da chon',
            byline: '',
            url: tab?.url ?? 'https://beta.com/tai-lieu',
            text: 'Noi dung cua tab da chon trong danh sach @.',
            excerpt: 'Noi dung cua tab da chon.',
            strategy: 'article',
            wordCount: 10,
          },
        },
      ]
    }
  })
}

test('go @ → popover hien danh sach tab', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await mockTabs(panel)
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('composer-input').fill('@')

  const popover = panel.getByTestId('mention-popover')
  await expect(popover).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('mention-tab')).toHaveCount(2)
  await expect(popover).toContainText('Bai viet Alpha')
  await expect(popover).toContainText('Tai lieu Beta')

  await panel.close()
})

test('chon tab → chip context hien + request co context.items', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await mockTabs(panel)
  const captured = await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('composer-input').fill('@')
  await panel.getByTestId('mention-popover').waitFor({ state: 'visible', timeout: 20_000 })

  // Chon tab thu hai (khong phai tab dang active).
  await panel.getByTestId('mention-tab').nth(1).click()

  const chip = panel.getByTestId('context-chip')
  await expect(chip).toBeVisible({ timeout: 20_000 })

  // Textarea da duoc chen ten tab.
  await expect(panel.getByTestId('composer-input')).toHaveValue(/@Tai lieu Beta/)

  await panel.getByTestId('composer-send').click()
  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  // Cho den khi request thuc su duoc route stub ghi lai (message user co
  // the render truoc khi fetch toi BFF hoan tat).
  await expect.poll(() => captured.length, { timeout: 20_000 }).toBeGreaterThan(0)

  const request = captured[0]
  expect(request?.context?.items).toHaveLength(1)
  expect(request?.context?.items?.[0]?.tier).toBe('attachment')
  expect(request?.context?.items?.[0]?.url).toBe('https://beta.com/tai-lieu')

  await panel.close()
})

test('loc tab theo chuoi da go sau @', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await mockTabs(panel)
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('composer-input').fill('@Beta')
  await panel.getByTestId('mention-popover').waitFor({ state: 'visible', timeout: 20_000 })

  await expect(panel.getByTestId('mention-tab')).toHaveCount(1)
  await expect(panel.getByTestId('mention-popover')).toContainText('Tai lieu Beta')
  await expect(panel.getByTestId('mention-popover')).not.toContainText('Bai viet Alpha')

  await panel.close()
})

test('Escape → dong popover', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await mockTabs(panel)
  await stubChat(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('composer-input').fill('@')
  await panel.getByTestId('mention-popover').waitFor({ state: 'visible', timeout: 20_000 })

  await panel.getByTestId('composer-input').press('Escape')

  await expect(panel.getByTestId('mention-popover')).toHaveCount(0)

  await panel.close()
})
