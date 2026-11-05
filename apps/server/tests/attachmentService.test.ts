import { describe, expect, it, vi } from 'vitest'
import { VISION } from '@sidekick/shared'
import {
  countAttachments,
  decodeBase64Image,
  getAttachment,
  loadRecentAttachments,
  persistAttachments,
  toDataUrl,
} from '../src/services/attachmentService.js'

/**
 * Test cho `attachmentService` (FR-VISION-01 — T-M1-24).
 *
 * DB gia lap — kiem tra thao tac Drizzle, khong can Postgres that.
 * Docs: docs/SYSTEM_DESIGN.md §4.2
 */

/** Gia tri 1 pixel PNG (base64). */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/** Tao attachment hop le. */
function makeAttachment(overrides: Record<string, unknown> = {}): {
  id: string
  mimeType: 'image/png'
  data: string
  bytes: number
} {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    mimeType: 'image/png',
    data: PNG_BASE64,
    bytes: decodeBase64Image(PNG_BASE64).byteLength,
    ...overrides,
  }
}

/** Tao DB gia lap — ghi nho cac row da insert. */
function makeDb(rows?: Array<Record<string, unknown>>) {
  const inserted: Array<Record<string, unknown>> = []
  const stored = rows ?? []

  const insert = vi.fn(() => ({
    values: (items: Array<Record<string, unknown>>) => {
      inserted.push(...items)
      const promise = Promise.resolve([]) as unknown as Promise<unknown[]> & {
        onConflictDoNothing: () => Promise<unknown[]>
      }
      promise.onConflictDoNothing = () => Promise.resolve([])
      return promise
    },
  }))

  const select = vi.fn(() => ({
    from: () => ({
      where: () => {
        // `where` phai vua la thenable (await truc tiep) vua co `.orderBy`/`.limit`.
        const whereResult = {
          orderBy: () => ({ limit: async () => stored }),
          limit: async () => stored,
        }
        return Object.assign(Promise.resolve(stored), whereResult)
      },
    }),
  }))

  return { db: { insert, select } as never, insert, inserted, stored }
}

describe('decodeBase64Image', () => {
  it('giai ma base64 thanh Buffer', () => {
    const buffer = decodeBase64Image('aGVsbG8=')
    expect(buffer.toString('utf-8')).toBe('hello')
  })

  it('chuoi rong → buffer rong', () => {
    expect(decodeBase64Image('').byteLength).toBe(0)
  })
})

describe('toDataUrl', () => {
  it('tao data url day du', () => {
    expect(toDataUrl('image/png', 'aGVsbG8=')).toBe('data:image/png;base64,aGVsbG8=')
  })
})

describe('persistAttachments', () => {
  it('khong co anh → khong ghi DB', async () => {
    const { db, insert } = makeDb()

    await persistAttachments(db, {
      conversationId: 'c-1',
      messageId: 'm-1',
      attachments: [],
    })

    expect(insert).not.toHaveBeenCalled()
  })
  it('luu anh voi dung metadata', async () => {
    const { db, inserted } = makeDb()

    await persistAttachments(db, {
      conversationId: 'c-1',
      messageId: 'm-1',
      attachments: [
        { ...makeAttachment(), fileName: 'a.png', width: 1, height: 1 } as never,
      ],
    })

    expect(inserted).toHaveLength(1)
    const row = inserted[0]
    expect(row?.['id']).toBe('11111111-2222-4333-8444-555555555555')
    expect(row?.['messageId']).toBe('m-1')
    expect(row?.['conversationId']).toBe('c-1')
    expect(row?.['mimeType']).toBe('image/png')
    expect(row?.['fileName']).toBe('a.png')
    expect(row?.['width']).toBe(1)
    // `ord` bat dau tu 0 → thu tu trong message.
    expect(row?.['ord']).toBe(0)
    // Kich thuoc thuc te cua data.
    expect(row?.['byteSize']).toBe(decodeBase64Image(PNG_BASE64).byteLength)
    expect(Buffer.isBuffer(row?.['data'])).toBe(true)
  })

  it('nhieu anh → ord tang dan', async () => {
    const { db, inserted } = makeDb()

    await persistAttachments(db, {
      conversationId: 'c-1',
      messageId: 'm-1',
      attachments: [
        makeAttachment({ id: '11111111-2222-4333-8444-555555555551' }),
        makeAttachment({ id: '11111111-2222-4333-8444-555555555552' }),
      ],
    })

    expect(inserted.map((row) => row['ord'])).toEqual([0, 1])
  })

  it('anh rong → bo qua, khong ghi DB', async () => {
    const { db, inserted } = makeDb()

    await persistAttachments(db, {
      conversationId: 'c-1',
      messageId: 'm-1',
      attachments: [makeAttachment({ data: '' })],
    })

    expect(inserted).toHaveLength(0)
  })

  it('anh vuot gioi han kich thuoc that → bo qua', async () => {
    const { db, inserted } = makeDb()

    await persistAttachments(db, {
      conversationId: 'c-1',
      messageId: 'm-1',
      attachments: [
        makeAttachment({
          data: Buffer.alloc(VISION.MAX_IMAGE_BYTES + 1).toString('base64'),
        }),
      ],
    })

    expect(inserted).toHaveLength(0)
  })
})

describe('loadRecentAttachments', () => {
  it('tra ve danh sach anh tu DB', async () => {
    const { db } = makeDb([
      { mimeType: 'image/png', data: decodeBase64Image(PNG_BASE64) },
    ])

    const images = await loadRecentAttachments(db, 'c-1')

    expect(images).toHaveLength(1)
    expect(images[0]?.mimeType).toBe('image/png')
    expect(images[0]?.data).toBe(PNG_BASE64)
  })

  it('khong co anh → mang rong', async () => {
    const { db } = makeDb([])

    const images = await loadRecentAttachments(db, 'c-1')

    expect(images).toEqual([])
  })
})

describe('getAttachment', () => {
  it('tra ve anh theo id', async () => {
    const { db } = makeDb([
      { mimeType: 'image/jpeg', data: decodeBase64Image('aGVsbG8=') },
    ])

    const attachment = await getAttachment(db, 'a-1')

    expect(attachment?.mimeType).toBe('image/jpeg')
    expect(attachment?.data.toString('utf-8')).toBe('hello')
  })

  it('khong tim thay → undefined', async () => {
    const { db } = makeDb([])

    expect(await getAttachment(db, 'a-1')).toBeUndefined()
  })
})

describe('countAttachments', () => {
  it('dem so anh cua message', async () => {
    const { db } = makeDb([{ id: 'a-1' }, { id: 'a-2' }])

    expect(await countAttachments(db, 'm-1')).toBe(2)
  })
})
