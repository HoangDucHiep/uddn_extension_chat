import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { DOCUMENT, ERROR_CODES } from '@sidekick/shared'
import { useChatStore } from '../src/sidepanel/store/chatStore'

/**
 * Unit test cho hook `useDocumentAttachments` (FR-CONTEXT-14 — T-M2-23).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.29
 */

/** Tao File gia lap voi type/size cho truoc. */
function makeFile(name: string, type: string, size: number): File {
  return { name, type, size } as unknown as File
}

/** Mock `FileReader` de doc file → data URL nhanh (khong can DOM thuc). */
function stubFileReader(): void {
  class FakeFileReader {
    onerror: (() => void) | null = null
    onload: (() => void) | null = null
    result: string | null = null

    readAsDataURL(): void {
      this.result = 'data:text/plain;base64,aGVsbG8='
      this.onload?.()
    }
  }

  vi.stubGlobal('FileReader', FakeFileReader)
}

/** Mock `fetch` cua BFF tra payload thanh cong. */
function stubFetchOk(text = 'noi dung tai lieu'): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          kind: 'text',
          text,
          title: 'a.txt',
          excerpt: text.slice(0, 50),
          truncated: false,
        }),
    }),
  )
  vi.stubGlobal('chrome', {
    storage: { local: { get: async () => ({}), set: async () => undefined } },
  })
}

/** Mock `fetch` cua BFF tra loi nghiep vu. */
function stubFetchError(code: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ kind: 'text', text: '', truncated: false, error: code }),
    }),
  )
  vi.stubGlobal('chrome', {
    storage: { local: { get: async () => ({}), set: async () => undefined } },
  })
}

const { useDocumentAttachments } = await import('../src/sidepanel/hooks/useDocumentAttachments')

beforeEach(() => {
  useChatStore.getState().reset()
  // `reset()` giu nguyen context da dinh kem (context la trang thai user chu
  // dong) → xoa rieng de moi test bat dau sach.
  useChatStore.getState().clearAttachedItems()
  stubFileReader()
  stubFetchOk()
})

describe('useDocumentAttachments', () => {
  it('bat dau rong, khong loi', () => {
    const { result } = renderHook(() => useDocumentAttachments())

    expect(result.current.error).toBeUndefined()
    expect(result.current.isReading).toBe(false)
  })

  it('them file hop le → tao context item kind=file', async () => {
    const { result } = renderHook(() => useDocumentAttachments())

    await act(async () => {
      await result.current.addFiles([makeFile('a.txt', 'text/plain', 5)])
    })

    await waitFor(() => {
      expect(useChatStore.getState().attachedItems).toHaveLength(1)
    })

    const item = useChatStore.getState().attachedItems[0]
    expect(item?.kind).toBe('file')
    expect(item?.tier).toBe('attachment')
    expect(item?.title).toBe('a.txt')
    expect(item?.text).toBe('noi dung tai lieu')
    expect(item?.fileName).toBe('a.txt')
    expect(item?.id.startsWith('doc-')).toBe(true)
    expect(result.current.error).toBeUndefined()
  })

  it('file sai dinh dang → bao loi, khong tao context item', async () => {
    const { result } = renderHook(() => useDocumentAttachments())

    await act(async () => {
      await result.current.addFiles([makeFile('a.xlsx', '', 5)])
    })

    expect(useChatStore.getState().attachedItems).toHaveLength(0)
    expect(result.current.error?.code).toBe(ERROR_CODES.DOCUMENT_UNSUPPORTED_TYPE)
  })

  it('file vuot kich thuoc → bao loi DOCUMENT_TOO_LARGE', async () => {
    const { result } = renderHook(() => useDocumentAttachments())

    await act(async () => {
      await result.current.addFiles([makeFile('a.pdf', 'application/pdf', DOCUMENT.MAX_BYTES + 1)])
    })

    expect(useChatStore.getState().attachedItems).toHaveLength(0)
    expect(result.current.error?.code).toBe(ERROR_CODES.DOCUMENT_TOO_LARGE)
  })

  it('BFF tra loi → bao loi + setContextError', async () => {
    stubFetchError(ERROR_CODES.DOCUMENT_NOT_READABLE)

    const { result } = renderHook(() => useDocumentAttachments())

    await act(async () => {
      await result.current.addFiles([makeFile('a.pdf', 'application/pdf', 5)])
    })

    expect(useChatStore.getState().attachedItems).toHaveLength(0)
    expect(result.current.error?.code).toBe(ERROR_CODES.DOCUMENT_NOT_READABLE)
    expect(useChatStore.getState().contextError).toBe(ERROR_CODES.DOCUMENT_NOT_READABLE)
    expect(useChatStore.getState().contextErrorMessage).toBeDefined()
  })

  it('vuot so tai lieu toi da → bao loi', async () => {
    const { result } = renderHook(() => useDocumentAttachments())

    const files = Array.from({ length: DOCUMENT.MAX_PER_MESSAGE + 1 }, (_, index) =>
      makeFile(`a-${index}.txt`, 'text/plain', 5),
    )

    await act(async () => {
      await result.current.addFiles(files)
    })

    expect(useChatStore.getState().attachedItems.length).toBe(DOCUMENT.MAX_PER_MESSAGE)
    expect(result.current.error?.code).toBe(ERROR_CODES.DOCUMENT_TOO_LARGE)
  })

  it('clearError xoa loi', async () => {
    const { result } = renderHook(() => useDocumentAttachments())

    await act(async () => {
      await result.current.addFiles([makeFile('a.xlsx', '', 5)])
    })
    expect(result.current.error).toBeDefined()

    act(() => {
      result.current.clearError()
    })

    expect(result.current.error).toBeUndefined()
  })

  it('danh sach rong → khong lam gi', async () => {
    const { result } = renderHook(() => useDocumentAttachments())

    await act(async () => {
      await result.current.addFiles([])
    })

    expect(useChatStore.getState().attachedItems).toHaveLength(0)
    expect(result.current.error).toBeUndefined()
  })
})
