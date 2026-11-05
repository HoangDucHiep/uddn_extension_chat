import { describe, expect, it } from 'vitest'
import { VISION } from '../src/constants.js'
import {
  chatTurnSchema,
  chatRequestSchema,
} from '../src/schemas/chat.js'
import {
  imageAttachmentListSchema,
  imageAttachmentSchema,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BASE64_CHARS,
} from '../src/schemas/vision.js'
import { providerStreamRequestSchema } from '../src/schemas/provider.js'

/** Tao mot attachment hop le. */
function makeAttachment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    mimeType: 'image/png',
    data: 'aGVsbG8=',
    bytes: 5,
    ...overrides,
  }
}

describe('imageAttachmentSchema', () => {
  it('accept anh hop le', () => {
    const parsed = imageAttachmentSchema.safeParse(makeAttachment())
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.mimeType).toBe('image/png')
      expect(parsed.data.bytes).toBe(5)
    }
  })

  it('accept tat ca mime type duoc phep', () => {
    for (const mimeType of ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const) {
      const parsed = imageAttachmentSchema.safeParse(makeAttachment({ mimeType }))
      expect(parsed.success).toBe(true)
    }
  })

  it('reject mime type khong duoc phep', () => {
    const parsed = imageAttachmentSchema.safeParse(
      makeAttachment({ mimeType: 'image/svg+xml' }),
    )
    expect(parsed.success).toBe(false)
  })

  it('chi chap nhan DUNG 4 mime type da chot (bmp/svg khong duoc phep)', () => {
    // Khoa danh sach mime — mutation them mime moi phai bi test nay bat.
    expect(VISION.ALLOWED_MIME_TYPES).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
    ])

    for (const mimeType of ['image/bmp', 'image/svg+xml', 'image/avif', 'image/tiff']) {
      const parsed = imageAttachmentSchema.safeParse(makeAttachment({ mimeType }))
      expect(parsed.success).toBe(false)
    }
  })

  it('VISION.ALLOWED_MIME_TYPES khop voi IMAGE_MIME_TYPES', () => {
    expect(VISION.ALLOWED_MIME_TYPES).toEqual(IMAGE_MIME_TYPES)
  })

  it('reject mime type khong phai image', () => {
    const parsed = imageAttachmentSchema.safeParse(makeAttachment({ mimeType: 'application/pdf' }))
    expect(parsed.success).toBe(false)
  })

  it('reject data rong', () => {
    const parsed = imageAttachmentSchema.safeParse(makeAttachment({ data: '' }))
    expect(parsed.success).toBe(false)
  })

  it('reject bytes bang 0', () => {
    const parsed = imageAttachmentSchema.safeParse(makeAttachment({ bytes: 0 }))
    expect(parsed.success).toBe(false)
  })

  it('reject bytes vuot gioi han', () => {
    const parsed = imageAttachmentSchema.safeParse(
      makeAttachment({ bytes: VISION.MAX_IMAGE_BYTES + 1 }),
    )
    expect(parsed.success).toBe(false)
  })

  it('reject bytes khong phai so nguyen', () => {
    const parsed = imageAttachmentSchema.safeParse(makeAttachment({ bytes: 1.5 }))
    expect(parsed.success).toBe(false)
  })

  it('reject data vuot gioi han chuoi base64', () => {
    const parsed = imageAttachmentSchema.safeParse(
      makeAttachment({ data: 'x'.repeat(MAX_IMAGE_BASE64_CHARS + 1) }),
    )
    expect(parsed.success).toBe(false)
  })

  it('accept data dai bang dung gioi han', () => {
    const parsed = imageAttachmentSchema.safeParse(
      makeAttachment({ data: 'x'.repeat(MAX_IMAGE_BASE64_CHARS) }),
    )
    expect(parsed.success).toBe(true)
  })

  it('reject id khong phai uuid', () => {
    const parsed = imageAttachmentSchema.safeParse(makeAttachment({ id: 'not-a-uuid' }))
    expect(parsed.success).toBe(false)
  })

  it('reject id rong', () => {
    const parsed = imageAttachmentSchema.safeParse(makeAttachment({ id: '' }))
    expect(parsed.success).toBe(false)
  })

  it('accept width/height va fileName', () => {
    const parsed = imageAttachmentSchema.safeParse(
      makeAttachment({ width: 800, height: 600, fileName: 'a.png' }),
    )
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.width).toBe(800)
      expect(parsed.data.fileName).toBe('a.png')
    }
  })
})

describe('imageAttachmentListSchema', () => {
  it('accept danh sach rong', () => {
    expect(imageAttachmentListSchema.safeParse([]).success).toBe(true)
  })

  it('accept so anh bang gioi han', () => {
    const items = Array.from({ length: VISION.MAX_IMAGES_PER_MESSAGE }, (_, index) =>
      makeAttachment({ id: `11111111-2222-4333-8444-55555555555${index}` }),
    )
    expect(imageAttachmentListSchema.safeParse(items).success).toBe(true)
  })

  it('reject so anh vuot gioi han', () => {
    const items = Array.from({ length: VISION.MAX_IMAGES_PER_MESSAGE + 1 }, (_, index) =>
      makeAttachment({ id: `11111111-2222-4333-8444-55555555555${index}` }),
    )
    expect(imageAttachmentListSchema.safeParse(items).success).toBe(false)
  })

  it('reject tong byte vuot gioi han', () => {
    const half = Math.floor(VISION.MAX_TOTAL_IMAGE_BYTES / 2) + 1
    const items = [
      makeAttachment({ bytes: half, id: '11111111-2222-4333-8444-555555555551' }),
      makeAttachment({ bytes: half, id: '11111111-2222-4333-8444-555555555552' }),
    ]
    expect(imageAttachmentListSchema.safeParse(items).success).toBe(false)
  })
})

describe('chatTurnSchema — attachments (FR-VISION-01)', () => {
  it('accept turn khong co anh', () => {
    const parsed = chatTurnSchema.safeParse({ role: 'user', content: 'Xin chao' })
    expect(parsed.success).toBe(true)
  })

  it('accept turn co anh', () => {
    const parsed = chatTurnSchema.safeParse({
      role: 'user',
      content: 'Mo ta anh nay',
      attachments: [makeAttachment()],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.attachments).toHaveLength(1)
    }
  })

  it('reject turn co anh sai mime', () => {
    const parsed = chatTurnSchema.safeParse({
      role: 'user',
      content: 'X',
      attachments: [makeAttachment({ mimeType: 'application/pdf' })],
    })
    expect(parsed.success).toBe(false)
  })

  it('reject turn co qua nhieu anh', () => {
    const attachments = Array.from(
      { length: VISION.MAX_IMAGES_PER_MESSAGE + 1 },
      (_, index) =>
        makeAttachment({ id: `11111111-2222-4333-8444-55555555555${index}` }),
    )
    const parsed = chatTurnSchema.safeParse({ role: 'user', content: 'X', attachments })
    expect(parsed.success).toBe(false)
  })
})

describe('chatRequestSchema — attachments', () => {
  it('accept request co anh', () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Mo ta', attachments: [makeAttachment()] }],
    })
    expect(parsed.success).toBe(true)
  })

  it('reject request co anh khong hop le', () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [
        { role: 'user', content: 'Mo ta', attachments: [makeAttachment({ bytes: -1 })] },
      ],
    })
    expect(parsed.success).toBe(false)
  })
})

describe('providerStreamRequestSchema — attachments', () => {
  it('accept message co anh', () => {
    const parsed = providerStreamRequestSchema.safeParse({
      model: 'gemini-3.6-flash',
      messages: [
        {
          role: 'user',
          content: 'Mo ta',
          attachments: [{ mimeType: 'image/png', data: 'aGVsbG8=' }],
        },
      ],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.messages[0]?.attachments).toHaveLength(1)
    }
  })

  it('reject anh co mime khong hop le', () => {
    const parsed = providerStreamRequestSchema.safeParse({
      model: 'gemini-3.6-flash',
      messages: [
        {
          role: 'user',
          content: 'Mo ta',
          attachments: [{ mimeType: 'application/pdf', data: 'aGVsbG8=' }],
        },
      ],
    })
    expect(parsed.success).toBe(false)
  })

  it('accept message khong co anh', () => {
    const parsed = providerStreamRequestSchema.safeParse({
      model: 'mock-model',
      messages: [{ role: 'user', content: 'Xin chao' }],
    })
    expect(parsed.success).toBe(true)
  })
})
