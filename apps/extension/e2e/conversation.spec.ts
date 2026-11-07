import { expect, type Page, type Route } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: CRUD cuoc tro chuyen (FR-CHAT-08/09/11 — T-M1-09).
 *
 * Kiem chung:
 *  - (1) Mo drawer danh sach → hien thi conversation.
 *  - (2) Tao chat moi → them vao danh sach.
 *  - (3) Doi ten → cap nhat ngay trong UI.
 *  - (4) Ghim → conversation chuyen len nhom "Đã ghim".
 *  - (5) Luu tru → bien mat khoi danh sach dang dung, xuat hien o tab "Đã lưu trữ".
 *  - (6) Xoa → confirm dialog → bien mat khoi danh sach.
 *  - (7) Search theo ten → loc danh sach.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can server that.
 * Docs: docs/SYSTEM_DESIGN.md §7.10
 */

/** Mot conversation trong fake store cua BFF. */
interface FakeConversation {
  id: string
  title: string
  pinned: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
  messageCount: number
}

/** Fake store cua BFF (giu trong closure cua route handler). */
class FakeBff {
  conversations: FakeConversation[] = []
  deleted: string[] = []

  /** Tao id conversation moi. */
  nextId(): string {
    return `00000000-0000-4000-8000-${String(this.conversations.length + 1).padStart(12, '0')}`
  }
}

/**
 * Stub toan bo API `/api/conversations` bang fake store.
 *
 * @param panel - Page cua side panel.
 * @param bff - Fake store (de test kiem tra phia server).
 */
async function stubConversations(panel: Page, bff: FakeBff): Promise<void> {
  await panel.route('**/api/conversations**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    const json = (status: number, body: unknown): void => {
      void route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body),
      })
    }

    // GET /api/conversations?q=&archived=
    if (method === 'GET' && path.endsWith('/api/conversations')) {
      const q = url.searchParams.get('q') ?? ''
      const archived = url.searchParams.get('archived') === 'true'

      const items = bff.conversations
        .filter((item) => item.archived === archived)
        .filter((item) => (q.length === 0 ? true : item.title.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          return b.updatedAt.localeCompare(a.updatedAt)
        })

      json(200, { items })
      return
    }

    // POST /api/conversations
    if (method === 'POST' && path.endsWith('/api/conversations')) {
      const body = (request.postDataJSON() ?? {}) as { title?: string }
      const created: FakeConversation = {
        id: bff.nextId(),
        title: body.title ?? 'Cuộc trò chuyện mới',
        pinned: false,
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
      }
      bff.conversations.push(created)
      json(201, created)
      return
    }

    // PATCH /api/conversations/:id
    const patchMatch = /\/api\/conversations\/([^/]+)$/.exec(path)
    if (method === 'PATCH' && patchMatch?.[1] !== undefined) {
      const id = patchMatch[1]
      const body = (request.postDataJSON() ?? {}) as {
        title?: string
        pinned?: boolean
        archived?: boolean
      }
      const target = bff.conversations.find((item) => item.id === id)
      if (target === undefined) {
        json(404, { error: { code: 'NOT_FOUND', message: 'Khong tim thay' } })
        return
      }
      if (body.title !== undefined) target.title = body.title
      if (body.pinned !== undefined) target.pinned = body.pinned
      if (body.archived !== undefined) target.archived = body.archived
      target.updatedAt = new Date().toISOString()
      json(200, target)
      return
    }

    // DELETE /api/conversations/:id
    if (method === 'DELETE' && patchMatch?.[1] !== undefined) {
      const id = patchMatch[1]
      const index = bff.conversations.findIndex((item) => item.id === id)
      if (index < 0) {
        json(404, { error: { code: 'NOT_FOUND', message: 'Khong tim thay' } })
        return
      }
      bff.conversations.splice(index, 1)
      bff.deleted.push(id)
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } })
      return
    }

    json(404, { error: { code: 'NOT_FOUND', message: 'Khong tim thay' } })
  })
}

/**
 * Mo drawer danh sach cuoc tro chuyen.
 *
 * @param panel - Page cua side panel.
 */
async function openList(panel: Page): Promise<void> {
  await panel.getByTestId('conversations-button').click()
  await expect(panel.getByTestId('conversation-list')).toBeVisible({ timeout: 20_000 })
}

test('mo drawer → hien thi danh sach conversation', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  const bff = new FakeBff()
  bff.conversations.push({
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Cuộc trò chuyện cũ',
    pinned: false,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messageCount: 3,
  })
  await stubConversations(panel, bff)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openList(panel)

  await expect(panel.getByText('Cuộc trò chuyện cũ')).toBeVisible({ timeout: 20_000 })

  await panel.close()
})

test('tao chat moi → them vao danh sach', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  const bff = new FakeBff()
  await stubConversations(panel, bff)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openList(panel)

  await panel.getByTestId('conversation-new').click()

  // Tao chat moi → drawer dong + thread duoc xoa.
  await expect(panel.getByTestId('conversation-list')).toBeHidden({ timeout: 20_000 })
  expect(bff.conversations).toHaveLength(1)

  // Mo lai drawer → conversation moi xuat hien trong danh sach.
  await openList(panel)
  await expect(panel.getByTestId('conversation-item').first()).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('conversation-item').first()).toHaveText(
    'Cuộc trò chuyện mới',
  )

  await panel.close()
})

test('doi ten → cap nhat ngay trong UI', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  const bff = new FakeBff()
  bff.conversations.push({
    id: '00000000-0000-4000-8000-000000000002',
    title: 'Tên cũ',
    pinned: false,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messageCount: 0,
  })
  await stubConversations(panel, bff)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openList(panel)

  await panel.getByTestId('conversation-rename').first().click()
  const input = panel.getByTestId('conversation-rename-input')
  await expect(input).toBeVisible({ timeout: 20_000 })
  await input.fill('Tên mới')
  await input.press('Enter')

  await expect(panel.getByText('Tên mới')).toBeVisible({ timeout: 20_000 })
  expect(bff.conversations[0]?.title).toBe('Tên mới')

  await panel.close()
})

test('ghim → conversation chuyen len nhom "Đã ghim"', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  const bff = new FakeBff()
  bff.conversations.push({
    id: '00000000-0000-4000-8000-000000000003',
    title: 'Sẽ ghim',
    pinned: false,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messageCount: 0,
  })
  await stubConversations(panel, bff)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openList(panel)

  await panel.getByTestId('conversation-pin').first().click()

  await expect(panel.getByRole('heading', { name: 'Đã ghim' })).toBeVisible({ timeout: 20_000 })
  expect(bff.conversations[0]?.pinned).toBe(true)

  await panel.close()
})

test('lưu trữ → chuyển sang tab "Đã lưu trữ"', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  const bff = new FakeBff()
  bff.conversations.push({
    id: '00000000-0000-4000-8000-000000000004',
    title: 'Sẽ lưu trữ',
    pinned: false,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messageCount: 0,
  })
  await stubConversations(panel, bff)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openList(panel)

  await panel.getByTestId('conversation-archive').first().click()
  await expect(panel.getByText('Sẽ lưu trữ')).toBeHidden({ timeout: 20_000 })

  // Chuyen sang tab luu tru → conversation xuat hien.
  await panel.getByTestId('conversation-tab-archived').click()
  await expect(panel.getByText('Sẽ lưu trữ')).toBeVisible({ timeout: 20_000 })
  expect(bff.conversations[0]?.archived).toBe(true)

  await panel.close()
})

test('xoá → confirm dialog → bi xoá khoi danh sach', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  const bff = new FakeBff()
  bff.conversations.push({
    id: '00000000-0000-4000-8000-000000000005',
    title: 'Sẽ xoá',
    pinned: false,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messageCount: 0,
  })
  await stubConversations(panel, bff)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openList(panel)

  await panel.getByTestId('conversation-delete').first().click()
  await expect(panel.getByTestId('confirm-dialog')).toBeVisible({ timeout: 20_000 })

  await panel.getByTestId('confirm-accept').click()

  await expect(panel.getByText('Sẽ xoá')).toBeHidden({ timeout: 20_000 })
  expect(bff.deleted).toHaveLength(1)

  await panel.close()
})

test('search theo tên → loc danh sach', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  const bff = new FakeBff()
  bff.conversations.push(
    {
      id: '00000000-0000-4000-8000-000000000006',
      title: 'Bài viết về Sidekick',
      pinned: false,
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      messageCount: 0,
    },
    {
      id: '00000000-0000-4000-8000-000000000007',
      title: 'Mua sắm',
      pinned: false,
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      messageCount: 0,
    },
  )
  await stubConversations(panel, bff)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openList(panel)

  await panel.getByTestId('conversation-search').fill('sidekick')

  await expect(panel.getByText('Bài viết về Sidekick')).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByText('Mua sắm')).toBeHidden({ timeout: 20_000 })

  await panel.close()
})
