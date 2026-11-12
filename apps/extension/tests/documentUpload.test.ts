import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOCUMENT, ERROR_CODES } from '@sidekick/shared'
import {
  documentExtensionOf,
  documentKindOf,
  isDocumentFile,
  readFileAsBase64,
  requestDocumentExtract,
  validateDocumentFile,
} from '../src/lib/documentUpload'

/**
 * Unit test cho helper xu ly tai lieu dinh kem (FR-CONTEXT-14 — T-M2-23).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.29
 */

/** Tao File gia lap voi type/size cho truoc. */
function makeFile(name: string, type: string, size: number): File {
  return { name, type, size } as unknown as File
}

describe('documentExtensionOf', () => {
  it('lay duoi file (khong phan biet hoa thuong)', () => {
    expect(documentExtensionOf('bao-cao.PDF')).toBe('.pdf')
    expect(documentExtensionOf('/a/b/tai-lieu.DOCX')).toBe('.docx')
  })

  it('tra chuoi rong khi khong co duoi', () => {
    expect(documentExtensionOf('khong-co-duoi')).toBe('')
  })
})

describe('documentKindOf', () => {
  it('doan loai tai lieu theo duoi file', () => {
    expect(documentKindOf('a.pdf')).toBe('pdf')
    expect(documentKindOf('a.docx')).toBe('docx')
    expect(documentKindOf('a.txt')).toBe('text')
    expect(documentKindOf('a.md')).toBe('text')
    expect(documentKindOf('a.csv')).toBe('text')
  })

  it('tra undefined cho dinh dang khong ho tro', () => {
    expect(documentKindOf('a.xlsx')).toBeUndefined()
    expect(documentKindOf('a.doc')).toBeUndefined()
    expect(documentKindOf('a.exe')).toBeUndefined()
  })
})

describe('isDocumentFile', () => {
  it('true voi tai lieu duoc ho tro', () => {
    expect(isDocumentFile(makeFile('a.pdf', 'application/pdf', 10))).toBe(true)
    expect(isDocumentFile(makeFile('a.txt', 'text/plain', 10))).toBe(true)
  })

  it('false voi file khac', () => {
    expect(isDocumentFile(makeFile('a.png', 'image/png', 10))).toBe(false)
    expect(isDocumentFile(makeFile('a.xlsx', '', 10))).toBe(false)
  })
})

describe('validateDocumentFile', () => {
  it('accept cac dinh dang core', () => {
    for (const name of ['a.pdf', 'a.docx', 'a.txt', 'a.md', 'a.csv']) {
      const result = validateDocumentFile(makeFile(name, '', 100))
      expect(result.ok).toBe(true)
    }
  })

  it('reject dinh dang khong duoc phep', () => {
    const result = validateDocumentFile(makeFile('a.xlsx', '', 100))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe(ERROR_CODES.DOCUMENT_UNSUPPORTED_TYPE)
    }
  })

  it('reject tai lieu vuot gioi han kich thuoc', () => {
    const result = validateDocumentFile(makeFile('a.pdf', '', DOCUMENT.MAX_BYTES + 1))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe(ERROR_CODES.DOCUMENT_TOO_LARGE)
    }
  })

  it('reject tai lieu rong', () => {
    const result = validateDocumentFile(makeFile('a.txt', '', 0))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe(ERROR_CODES.DOCUMENT_EMPTY)
    }
  })
})

describe('readFileAsBase64', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('cat prefix data url', async () => {
    vi.stubGlobal(
      'FileReader',
      class {
        result = 'data:text/plain;base64,aGVsbG8='
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        readAsDataURL(): void {
          this.onload?.()
        }
      },
    )

    await expect(readFileAsBase64(makeFile('a.txt', 'text/plain', 10))).resolves.toBe(
      'aGVsbG8=',
    )
  })
})

describe('requestDocumentExtract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('tra text khi BFF thanh cong', async () => {
    vi.stubGlobal(
      'FileReader',
      class {
        result = 'data:text/plain;base64,aGVsbG8='
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        readAsDataURL(): void {
          this.onload?.()
        }
      },
    )

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ kind: 'text', text: 'noi dung', title: 'a.txt', truncated: false }),
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('chrome', {
      storage: { local: { get: async () => ({}), set: async () => undefined } },
    })

    const outcome = await requestDocumentExtract(makeFile('a.txt', 'text/plain', 10))

    expect(outcome.error).toBeUndefined()
    expect(outcome.text).toBe('noi dung')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('khong throw khi BFF tra error trong body (loi nghiep vu)', async () => {
    vi.stubGlobal(
      'FileReader',
      class {
        result = 'data:text/plain;base64,aGVsbG8='
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        readAsDataURL(): void {
          this.onload?.()
        }
      },
    )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            kind: 'text',
            text: '',
            truncated: false,
            error: ERROR_CODES.DOCUMENT_NOT_READABLE,
            errorMessage: 'file hong',
          }),
      }),
    )
    vi.stubGlobal('chrome', {
      storage: { local: { get: async () => ({}), set: async () => undefined } },
    })

    const outcome = await requestDocumentExtract(makeFile('a.pdf', 'application/pdf', 10))

    expect(outcome.error).toBe(ERROR_CODES.DOCUMENT_NOT_READABLE)
    expect(outcome.text).toBe('')
  })

  it('khong throw khi BFF offline', async () => {
    vi.stubGlobal(
      'FileReader',
      class {
        result = 'data:text/plain;base64,aGVsbG8='
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        readAsDataURL(): void {
          this.onload?.()
        }
      },
    )

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    vi.stubGlobal('chrome', {
      storage: { local: { get: async () => ({}), set: async () => undefined } },
    })

    const outcome = await requestDocumentExtract(makeFile('a.txt', 'text/plain', 10))

    expect(outcome.error).toBeDefined()
    expect(outcome.text).toBe('')
  })
})
