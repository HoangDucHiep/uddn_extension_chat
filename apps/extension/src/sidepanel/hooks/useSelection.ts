import { useCallback, useEffect, useRef } from 'react'
import { PENDING_SELECTION_STORAGE_KEY, consumePendingSelection } from '@/lib/storage'
import type { PendingSelection } from '@/lib/selectionProtocol'

/**
 * Hook `useSelection` — nhan doan text user boi den do content script gui
 * (T-M1-02, FR-CONTEXT-04).
 *
 * Luong:
 *  1. Panel mo → `consumePendingSelection()` (doan cho trong storage).
 *  2. Panel dang mo + user boi den tren trang → `chrome.storage.onChanged`
 *     ban → `consumePendingSelection()` → `onAttach(selection)`.
 *
 * Doan chon chi duoc dinh kem khi user **chu dong** thao tac (bam nut nobi
 * tren trang) → hieu luc nay khong phai tu dong dinh kem.
 */

/** Lop bao cho callback nhan doan chon. */
export interface UseSelectionOptions {
  /** Callback khi nhan duoc doan chon. */
  onAttach: (selection: PendingSelection) => void
}

/** Ket qua hook. */
export interface UseSelectionResult {
  /** Doc doan cho ngay lap (dung khi user bam nut trong panel). */
  consumeNow: () => Promise<void>
}

/**
 * Hook theo doi doan text user boi den.
 *
 * `onAttach` duoc giu trong `ref` de effect khong chay lai moi render
 * (callback inline trong App moi tao moi moi render).
 *
 * @param options - Callback nhan doan chon.
 */
export function useSelection(options: UseSelectionOptions): UseSelectionResult {
  const { onAttach } = options

  const onAttachRef = useRef(onAttach)
  useEffect(() => {
    onAttachRef.current = onAttach
  }, [onAttach])

  const consumeNow = useCallback(async (): Promise<void> => {
    const pending = await consumePendingSelection()
    if (pending !== undefined) {
      onAttachRef.current(pending)
    }
  }, [])

  useEffect(() => {
    // Panel vua mo → co doan cho trong storage tu truoc?
    void consumeNow()

    // Panel dang mo → doan chon moi den se bat `storage.onChanged`.
    if (typeof chrome === 'undefined') return undefined
    if (chrome.storage?.onChanged === undefined) return undefined

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName !== 'local') return
      if (changes[PENDING_SELECTION_STORAGE_KEY] === undefined) return
      void consumeNow()
    }

    chrome.storage.onChanged.addListener(listener)
    return () => {
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [consumeNow])

  return { consumeNow }
}
