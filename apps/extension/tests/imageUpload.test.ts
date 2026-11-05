import { describe, it, expect } from 'vitest'
import { ERROR_CODES, VISION } from '@sidekick/shared'
import {
  createAttachmentId,
  extractImagesFromDataTransfer,
  formatBytes,
  stripDataUrlPrefix,
  validateImageFile,
} from '../src/lib/imageUpload'

/**
 * Unit test cho helper xu ly anh dinh kem (FR-VISION-01 — T-M1-24).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.4
 */

/** Tao File gia lap voi type/size cho truoc. */
function makeFile(name: string, type: string, size: number): File {
  const file = {
    name,
    type,
    size,
  } as unknown as File
  return file
}

describe('validateImageFile', () => {
  it('accept cac mime type duoc phep', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      const result = validateImageFile(makeFile('a.png', type, 100))
      expect(result.ok).toBe(true)
    }
  })

  it('reject dinh dang khong duoc phep', () => {
    const result = validateImageFile(makeFile('a.pdf', 'application/pdf', 100))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe(ERROR_CODES.VISION_UNSUPPORTED_TYPE)
    }
  })

  it('reject file khong co type', () => {
    const result = validateImageFile(makeFile('a', '', 100))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe(ERROR_CODES.VISION_UNSUPPORTED_TYPE)
    }
  })

  it('reject anh vuot gioi han kich thuoc', () => {
    const result = validateImageFile(
      makeFile('a.png', 'image/png', VISION.MAX_IMAGE_BYTES + 1),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe(ERROR_CODES.VISION_IMAGE_TOO_LARGE)
    }
  })

  it('accept anh bang dung gioi han kich thuoc', () => {
    const result = validateImageFile(makeFile('a.png', 'image/png', VISION.MAX_IMAGE_BYTES))
    expect(result.ok).toBe(true)
  })

  it('reject file rong', () => {
    const result = validateImageFile(makeFile('a.png', 'image/png', 0))
    expect(result.ok).toBe(false)
  })
})

describe('stripDataUrlPrefix', () => {
  it('cat prefix data url', () => {
    expect(stripDataUrlPrefix('data:image/png;base64,aGVsbG8=')).toBe('aGVsbG8=')
  })

  it('gia nguyen chuoi khong phai data url', () => {
    expect(stripDataUrlPrefix('aGVsbG8=')).toBe('aGVsbG8=')
  })

  it('gia nguyen chuoi rong', () => {
    expect(stripDataUrlPrefix('')).toBe('')
  })
})

describe('extractImagesFromDataTransfer', () => {
  it('null → mang rong', () => {
    expect(extractImagesFromDataTransfer(null)).toEqual([])
  })

  it('chi lay file co type bat dau bang image/', () => {
    const image = makeFile('a.png', 'image/png', 10)
    const text = makeFile('a.txt', 'text/plain', 10)

    const dataTransfer = {
      items: [
        { kind: 'file', getAsFile: () => image },
        { kind: 'file', getAsFile: () => text },
      ],
    } as unknown as DataTransfer

    expect(extractImagesFromDataTransfer(dataTransfer)).toEqual([image])
  })

  it('bo qua item kind khong phai file', () => {
    const dataTransfer = {
      items: [{ kind: 'string', getAsFile: () => null }],
    } as unknown as DataTransfer

    expect(extractImagesFromDataTransfer(dataTransfer)).toEqual([])
  })

  it('fallback sang `files` khi `items` rong', () => {
    const image = makeFile('a.png', 'image/png', 10)
    const dataTransfer = {
      items: [],
      files: [image],
    } as unknown as DataTransfer

    expect(extractImagesFromDataTransfer(dataTransfer)).toEqual([image])
  })
})

describe('createAttachmentId', () => {
  it('sinh id duy nhat', () => {
    const first = createAttachmentId()
    const second = createAttachmentId()
    expect(first).not.toBe(second)
  })

  it('id la uuid hop le', () => {
    expect(createAttachmentId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })
})

describe('formatBytes', () => {
  it('hien thi byte', () => {
    expect(formatBytes(500)).toBe('500 B')
  })

  it('hien thi KB', () => {
    expect(formatBytes(2048)).toBe('2 KB')
  })

  it('hien thi MB', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
