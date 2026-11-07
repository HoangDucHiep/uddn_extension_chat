import { describe, expect, it } from 'vitest'
import { AppError, ERROR_CODES } from '@sidekick/shared'
import {
  buildAutoTitle,
  compareConversations,
  createConversation,
  decodeCursor,
  deleteConversation,
  encodeCursor,
  escapeLikePattern,
  getConversationMessages,
  listConversations,
  updateConversation,
} from '../src/services/conversationService.js'
import {
  createFakeConversationDb,
  type FakeConversationDb,
} from './helpers/fakeConversationDb.js'

/**
 * Unit test cho `conversationService` (FR-CHAT-08/09/11 — T-M1-09).
 *
 * Dung fake DB (khong can Docker) → test chay nhanh va ton dinh.
 * Docs: docs/SYSTEM_DESIGN.md §7.10
 */

/** Tao fake DB rong. */
function makeDb(): FakeConversationDb {
  return createFakeConversationDb()
}

describe('escapeLikePattern', () => {
  it('escape ky tu wildcard SQL', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%')
    expect(escapeLikePattern('a_b')).toBe('a\\_b')
    expect(escapeLikePattern('back\\slash')).toBe('back\\\\slash')
  })

  it('khong doi chuoi thuong', () => {
    expect(escapeLikePattern('Sidekick AI')).toBe('Sidekick AI')
  })

  it('chuoi rong → chuoi rong', () => {
    expect(escapeLikePattern('')).toBe('')
  })
})

describe('buildAutoTitle', () => {
  it('cat con 60 ky tu + them dau trich dan', () => {
    const title = buildAutoTitle('a'.repeat(80))
    expect(title).toBe(`${'a'.repeat(60)}…`)
  })

  it('giu nguyen tieu de ngan', () => {
    expect(buildAutoTitle('Xin chao')).toBe('Xin chao')
  })

  it('gop khoang trang thua vao 1 dau cach', () => {
    expect(buildAutoTitle('  Xin   chao   ban ')).toBe('Xin chao ban')
  })

  it('tra tieu de mac dinh khi rong', () => {
    expect(buildAutoTitle('   ')).toBe('Cuộc trò chuyện mới')
  })
})

describe('compareConversations', () => {
  it('dat conversation ghim truoc', () => {
    const pinned = { pinned: true, updatedAt: '2026-01-01T00:00:00.000Z', id: 'b' }
    const normal = { pinned: false, updatedAt: '2026-02-01T00:00:00.000Z', id: 'a' }
    expect(compareConversations(pinned, normal)).toBeLessThan(0)
  })

  it('sap xep theo updated_at giam dan khi cung trang thai ghim', () => {
    const older = { pinned: false, updatedAt: '2026-01-01T00:00:00.000Z', id: 'a' }
    const newer = { pinned: false, updatedAt: '2026-02-01T00:00:00.000Z', id: 'b' }
    expect(compareConversations(newer, older)).toBeLessThan(0)
  })

  it('sap xep theo id giam dan khi cung updated_at', () => {
    const a = { pinned: false, updatedAt: '2026-01-01T00:00:00.000Z', id: 'a' }
    const b = { pinned: false, updatedAt: '2026-01-01T00:00:00.000Z', id: 'b' }
    expect(compareConversations(b, a)).toBeLessThan(0)
  })
})

describe('encodeCursor / decodeCursor', () => {
  it('giai ma cursor giong khoa ban dau', () => {
    const key = { pinned: true, updatedAt: '2026-01-01T00:00:00.000Z', id: 'conv-1' }
    expect(decodeCursor(encodeCursor(key))).toEqual(key)
  })

  it('tra undefined khi cursor khong hop le', () => {
    expect(decodeCursor('khong-phai-cursor')).toBeUndefined()
    expect(decodeCursor('')).toBeUndefined()
  })
})

describe('listConversations', () => {
  it('dat conversation ghim o dau danh sach', async () => {
    const fake = makeDb()
    fake.seedConversation({ id: 'c1', title: 'A', pinned: false })
    fake.seedConversation({ id: 'c2', title: 'B', pinned: true })

    const result = await listConversations(fake.db as never, {
      archived: false,
      limit: 30,
    })

    expect(result.items.map((item) => item.id)).toEqual(['c2', 'c1'])
  })

  it('loc theo ten (q)', async () => {
    const fake = makeDb()
    fake.seedConversation({ id: 'c1', title: 'Bài viết về Sidekick' })
    fake.seedConversation({ id: 'c2', title: 'Mua sắm' })

    const result = await listConversations(fake.db as never, {
      q: 'sidekick',
      archived: false,
      limit: 30,
    })

    expect(result.items.map((item) => item.id)).toEqual(['c1'])
  })

  it('tach conversation da luu tru khi archived=true', async () => {
    const fake = makeDb()
    fake.seedConversation({ id: 'c1', title: 'Active' })
    fake.seedConversation({ id: 'c2', title: 'Archived', archived: true })

    const active = await listConversations(fake.db as never, { archived: false, limit: 30 })
    const archived = await listConversations(fake.db as never, { archived: true, limit: 30 })

    expect(active.items.map((item) => item.id)).toEqual(['c1'])
    expect(archived.items.map((item) => item.id)).toEqual(['c2'])
  })

  it('tra nextCursor khi con trang sau', async () => {
    const fake = makeDb()
    fake.seedConversation({ id: 'c1', title: 'A' })
    fake.seedConversation({ id: 'c2', title: 'B' })
    fake.seedConversation({ id: 'c3', title: 'C' })

    const page = await listConversations(fake.db as never, { archived: false, limit: 2 })

    expect(page.items).toHaveLength(2)
    expect(page.nextCursor).toBeDefined()
  })

  it('khong lap lai dong khi phan trang tiep theo', async () => {
    const fake = makeDb()
    fake.seedConversation({ id: 'c1', title: 'A' })
    fake.seedConversation({ id: 'c2', title: 'B' })
    fake.seedConversation({ id: 'c3', title: 'C' })

    const page1 = await listConversations(fake.db as never, { archived: false, limit: 2 })
    const page2 = await listConversations(fake.db as never, {
      archived: false,
      limit: 2,
      cursor: page1.nextCursor,
    })

    const ids = [...page1.items, ...page2.items].map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(3)
  })

  it('dem so tin nhan cua tung conversation', async () => {
    const fake = makeDb()
    fake.seedConversation({ id: 'c1', title: 'A' })
    fake.seedMessage({ id: 'm1', conversationId: 'c1' })
    fake.seedMessage({ id: 'm2', conversationId: 'c1' })

    const result = await listConversations(fake.db as never, { archived: false, limit: 30 })

    expect(result.items[0]?.messageCount).toBe(2)
  })
})

describe('createConversation', () => {
  it('tao conversation voi tieu de mac dinh', async () => {
    const fake = makeDb()
    const created = await createConversation(fake.db as never)

    expect(created.title).toBe('Cuộc trò chuyện mới')
    expect(created.pinned).toBe(false)
    expect(created.archived).toBe(false)
  })

  it('tao conversation voi tieu de do user dat', async () => {
    const fake = makeDb()
    const created = await createConversation(fake.db as never, 'Kế hoạch dự án')

    expect(created.title).toBe('Kế hoạch dự án')
  })
})

describe('updateConversation', () => {
  it('doi ten conversation', async () => {
    const fake = makeDb()
    fake.seedConversation({ id: 'c1', title: 'A' })

    const updated = await updateConversation(fake.db as never, 'c1', { title: 'Tên mới' })

    expect(updated.title).toBe('Tên mới')
  })

  it('bat ghim va luu tru', async () => {
    const fake = makeDb()
    fake.seedConversation({ id: 'c1', title: 'A' })

    const pinned = await updateConversation(fake.db as never, 'c1', { pinned: true })
    expect(pinned.pinned).toBe(true)

    const archived = await updateConversation(fake.db as never, 'c1', { archived: true })
    expect(archived.archived).toBe(true)
  })

  it('nem NOT_FOUND khi conversation khong ton tai', async () => {
    const fake = makeDb()

    await expect(
      updateConversation(fake.db as never, 'khong-ton-tai', { title: 'X' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.NOT_FOUND,
    })
  })

  it('nem VALIDATION_ERROR khi khong co truong nao de cap nhat', async () => {
    const fake = makeDb()
    fake.seedConversation({ id: 'c1', title: 'A' })

    await expect(updateConversation(fake.db as never, 'c1', {})).rejects.toBeInstanceOf(AppError)
  })
})

describe('deleteConversation', () => {
  it('xoa conversation', async () => {
    const fake = makeDb()
    fake.seedConversation({ id: 'c1', title: 'A' })

    await deleteConversation(fake.db as never, 'c1')

    expect(fake.conversationRows).toHaveLength(0)
  })

  it('nem NOT_FOUND khi conversation khong ton tai', async () => {
    const fake = makeDb()

    await expect(deleteConversation(fake.db as never, 'khong-ton-tai')).rejects.toMatchObject({
      code: ERROR_CODES.NOT_FOUND,
    })
  })
})

describe('getConversationMessages', () => {
  it('tra messages theo thu tu tao + kem citations', async () => {
    const fake = makeDb()
    fake.seedConversation({ id: 'c1', title: 'A' })
    fake.seedMessage({
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      content: 'Cau hoi',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    fake.seedMessage({
      id: 'm2',
      conversationId: 'c1',
      role: 'assistant',
      content: 'Cau tra loi',
      createdAt: new Date('2026-01-01T00:00:01.000Z'),
      meta: { provider: 'groq', model: 'gpt-oss', tokensIn: 10, tokensOut: 20 },
    })
    fake.seedCitation({ messageId: 'm2', idx: 1, url: 'https://a.test', title: 'Nguon 1' })

    const result = await getConversationMessages(fake.db as never, 'c1')

    expect(result.messages.map((message) => message.id)).toEqual(['m1', 'm2'])
    expect(result.messages[1]?.provider).toBe('groq')
    expect(result.messages[1]?.tokensOut).toBe(20)
    expect(result.messages[1]?.citations).toHaveLength(1)
    expect(result.messages[1]?.citations[0]?.url).toBe('https://a.test')
    expect(result.messages[0]?.citations).toHaveLength(0)
  })

  it('nem NOT_FOUND khi conversation khong ton tai', async () => {
    const fake = makeDb()

    await expect(getConversationMessages(fake.db as never, 'khong-ton-tai')).rejects.toMatchObject({
      code: ERROR_CODES.NOT_FOUND,
    })
  })
})
