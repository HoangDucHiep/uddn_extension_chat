import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSelection } from '../src/sidepanel/hooks/useSelection.js'
import {
  PENDING_SELECTION_STORAGE_KEY,
  writePendingSelection,
} from '../src/lib/storage.js'
import type { PendingSelection } from '../src/lib/selectionProtocol.js'
import type * as StorageModule from '../src/lib/storage.js'

/**
 * Unit test cho hook `useSelection` — nhan doan text user boi den (T-M1-02).
 * Docs: docs/SYSTEM_DESIGN.md §7.3.4
 */

const consumePendingSelectionMock = vi.fn()

vi.mock('@/lib/storage', async () => {
  const actual = await vi.importActual<typeof StorageModule>('../src/lib/storage.js')
  return {
    ...actual,
    consumePendingSelection: () => consumePendingSelectionMock(),
  }
})

const { fireStorageChanged } = await import('./setup.js')

/** Payload selection hop le. */
function pendingSelection(text = 'Doan van ban da boi den tren trang web'): PendingSelection {
  return {
    id: 'selection-abc',
    text,
    url: 'https://example.com/',
    title: 'Bai viet mau',
    tabId: 42,
    createdAt: Date.now(),
  }
}

beforeEach(() => {
  consumePendingSelectionMock.mockReset()
  consumePendingSelectionMock.mockResolvedValue(undefined)
})

describe('useSelection', () => {
  it('consume doan cho ngay khi panel mo', async () => {
    const onAttach = vi.fn()
    consumePendingSelectionMock.mockResolvedValue(pendingSelection())

    renderHook(() => useSelection({ onAttach }))

    await waitFor(() => expect(onAttach).toHaveBeenCalledTimes(1))
    expect(onAttach.mock.calls[0]?.[0]).toMatchObject({
      id: 'selection-abc',
      text: expect.any(String),
    })
  })

  it('KHONG goi onAttach khi khong co doan cho', async () => {
    const onAttach = vi.fn()

    renderHook(() => useSelection({ onAttach }))

    await waitFor(() => expect(consumePendingSelectionMock).toHaveBeenCalled())
    expect(onAttach).not.toHaveBeenCalled()
  })

  it('consume khi storage.onChanged bat (doan chon moi den)', async () => {
    const onAttach = vi.fn()
    consumePendingSelectionMock.mockResolvedValue(undefined)

    renderHook(() => useSelection({ onAttach }))
    await waitFor(() => expect(consumePendingSelectionMock).toHaveBeenCalledTimes(1))

    const selection = pendingSelection()
    consumePendingSelectionMock.mockResolvedValue(selection)
    await act(async () => {
      fireStorageChanged({
        [PENDING_SELECTION_STORAGE_KEY]: { oldValue: undefined, newValue: selection },
      })
    })

    await waitFor(() => expect(onAttach).toHaveBeenCalledTimes(1))
    expect(onAttach.mock.calls[0]?.[0]).toEqual(selection)
  })

  it('KHONG consume khi thay doi key khac', async () => {
    const onAttach = vi.fn()
    consumePendingSelectionMock.mockResolvedValue(undefined)

    renderHook(() => useSelection({ onAttach }))
    await waitFor(() => expect(consumePendingSelectionMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      fireStorageChanged({ 'sidekick.contextEnabled': { oldValue: false, newValue: true } })
    })

    expect(consumePendingSelectionMock).toHaveBeenCalledTimes(1)
  })

  it('KHONG consume khi thay doi o storage area khac', async () => {
    const onAttach = vi.fn()
    consumePendingSelectionMock.mockResolvedValue(undefined)

    renderHook(() => useSelection({ onAttach }))
    await waitFor(() => expect(consumePendingSelectionMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      fireStorageChanged(
        { [PENDING_SELECTION_STORAGE_KEY]: { oldValue: undefined, newValue: {} } },
        'sync',
      )
    })

    expect(consumePendingSelectionMock).toHaveBeenCalledTimes(1)
  })

  it('consumeNow doc doan cho ngay lap', async () => {
    const onAttach = vi.fn()
    const selection = pendingSelection()
    consumePendingSelectionMock.mockResolvedValue(selection)

    const { result } = renderHook(() => useSelection({ onAttach }))
    await waitFor(() => expect(onAttach).toHaveBeenCalledTimes(1))

    onAttach.mockClear()
    await act(async () => {
      await result.current.consumeNow()
    })

    expect(onAttach).toHaveBeenCalledTimes(1)
  })

  it('bo listener khi unmount', async () => {
    const onAttach = vi.fn()

    const { unmount } = renderHook(() => useSelection({ onAttach }))
    await waitFor(() => expect(consumePendingSelectionMock).toHaveBeenCalled())

    unmount()

    // Sau unmount, storage change khong duoc consume nua.
    consumePendingSelectionMock.mockResolvedValue(pendingSelection())
    await act(async () => {
      fireStorageChanged({
        [PENDING_SELECTION_STORAGE_KEY]: { oldValue: undefined, newValue: {} },
      })
    })

    expect(onAttach).not.toHaveBeenCalled()
  })
})

describe('storage round-trip', () => {
  it('write → read trong cung store', async () => {
    const selection = pendingSelection()

    await writePendingSelection(selection)

    const { readPendingSelection } = await import('../src/lib/storage.js')
    expect(await readPendingSelection()).toEqual(selection)
  })
})
