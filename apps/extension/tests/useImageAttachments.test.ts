import { describe, expect, it, beforeEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ERROR_CODES, VISION } from '@sidekick/shared'
import { useChatStore } from '../src/sidepanel/store/chatStore'

/**
 * Unit test cho hook `useImageAttachments` (FR-VISION-01 — T-M1-24).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.4
 */

/**
 * Tao File gia lap voi type/size cho truoc.
 */
function makeFile(name: string, type: string, size: number): File {
  return { name, type, size } as unknown as File
}

/**
 * Mock `FileReader` de doc file → data URL nhanh (khong can DOM thuc).
 */
function stubFileReader(content: string): void {
  class FakeFileReader {
    onerror: (() => void) | null = null
    onload: (() => void) | null = null
    result: string | null = null

    readAsDataURL(): void {
      this.result = `data:image/png;base64,${content}`
      this.onload?.()
    }
  }

  vi.stubGlobal('FileReader', FakeFileReader)
}

const { useImageAttachments } = await import('../src/sidepanel/hooks/useImageAttachments')

beforeEach(() => {
  useChatStore.getState().reset()
  stubFileReader('aGVsbG8=')
})

describe('useImageAttachments', () => {
  it('bat dau rong, khong loi', () => {
    const { result } = renderHook(() => useImageAttachments())

    expect(result.current.images).toEqual([])
    expect(result.current.error).toBeUndefined()
  })

  it('them file hop le → anh vao tray', async () => {
    const { result } = renderHook(() => useImageAttachments())

    await act(async () => {
      await result.current.addFiles([makeFile('a.png', 'image/png', 5)])
    })

    await waitFor(() => {
      expect(result.current.images).toHaveLength(1)
    })
    expect(result.current.images[0]?.mimeType).toBe('image/png')
    expect(result.current.images[0]?.data).toBe('aGVsbG8=')
    expect(result.current.error).toBeUndefined()
  })

  it('file sai mime → bao loi, khong them anh', async () => {
    const { result } = renderHook(() => useImageAttachments())

    await act(async () => {
      await result.current.addFiles([makeFile('a.txt', 'text/plain', 5)])
    })

    expect(result.current.images).toHaveLength(0)
    expect(result.current.error?.code).toBe(ERROR_CODES.VISION_UNSUPPORTED_TYPE)
  })

  it('file vuot kich thuoc → bao loi VISION_IMAGE_TOO_LARGE', async () => {
    const { result } = renderHook(() => useImageAttachments())

    await act(async () => {
      await result.current.addFiles([
        makeFile('a.png', 'image/png', VISION.MAX_IMAGE_BYTES + 1),
      ])
    })

    expect(result.current.images).toHaveLength(0)
    expect(result.current.error?.code).toBe(ERROR_CODES.VISION_IMAGE_TOO_LARGE)
  })

  it('vuot so anh toi da → bao loi VISION_TOO_MANY_IMAGES', async () => {
    useChatStore.getState().addPendingImages(
      Array.from({ length: VISION.MAX_IMAGES_PER_MESSAGE }, (_, index) => ({
        id: `11111111-2222-4333-8444-55555555555${index}`,
        mimeType: 'image/png' as const,
        data: 'aGVsbG8=',
        bytes: 5,
      })),
    )

    const { result } = renderHook(() => useImageAttachments())

    await act(async () => {
      await result.current.addFiles([makeFile('a.png', 'image/png', 5)])
    })

    expect(result.current.images).toHaveLength(VISION.MAX_IMAGES_PER_MESSAGE)
    expect(result.current.error?.code).toBe(ERROR_CODES.VISION_TOO_MANY_IMAGES)
  })

  it('removeImage xoa dung anh', async () => {
    const { result } = renderHook(() => useImageAttachments())

    await act(async () => {
      await result.current.addFiles([makeFile('a.png', 'image/png', 5)])
    })

    const id = result.current.images[0]?.id
    expect(id).toBeDefined()

    act(() => {
      result.current.removeImage(id as string)
    })

    expect(result.current.images).toHaveLength(0)
  })

  it('clearImages xoa tat ca anh', async () => {
    const { result } = renderHook(() => useImageAttachments())

    await act(async () => {
      await result.current.addFiles([
        makeFile('a.png', 'image/png', 5),
        makeFile('b.png', 'image/png', 5),
      ])
    })

    act(() => {
      result.current.clearImages()
    })

    expect(result.current.images).toHaveLength(0)
  })

  it('clearError xoa loi', async () => {
    const { result } = renderHook(() => useImageAttachments())

    await act(async () => {
      await result.current.addFiles([makeFile('a.txt', 'text/plain', 5)])
    })
    expect(result.current.error).toBeDefined()

    act(() => {
      result.current.clearError()
    })

    expect(result.current.error).toBeUndefined()
  })

  it('danh sach rong → khong lam gi', async () => {
    const { result } = renderHook(() => useImageAttachments())

    await act(async () => {
      await result.current.addFiles([])
    })

    expect(result.current.images).toHaveLength(0)
    expect(result.current.error).toBeUndefined()
  })
})
