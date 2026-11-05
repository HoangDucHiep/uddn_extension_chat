/**
 * Dinh kem context item — chi khi user CHU DONG yeu cau.
 *
 * Mo hinh moi (FR-CONTEXT-07): tab hien tai **khong** tu dong vao context.
 * User bam "Them trang nay" (hoac `@` — T-M1-05) moi tao ra item.
 *
 * Giu nguyen 3 nhanh trich xuat cua T-M1-01/21/22 (html / pdf / youtube) →
 * khong regression.
 *
 * T-M1-02 bo sung nhanh 4: doan text user boi den (`tier: 'selection'` —
 * tier cao nhat trong thu tu uu tien cat bot).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.1
 */

import type { ContextItem } from '@sidekick/shared'
import { LIMITS } from '@sidekick/shared/constants'
import { isMeaningfulSelection, normalizeSelectionText } from '../content/selection.js'
import {
  hasContentChanged,
  readCachedContext,
  toCacheEntry,
  writeCachedContext,
} from './contextCache'
import { captureTabContext, getActiveTabId } from './pageContext'
import {
  SELECTION_EMPTY_ERROR_CODE,
  selectionItemId,
  type PendingSelection,
} from './selectionProtocol'

/** Ket qua dinh kem tab. */
export interface AttachTabResult {
  /** Item context vua tao — `undefined` khi khong trich xuat duoc. */
  item: ContextItem | undefined
  /** Error code trich xuat (vd `CONTEXT_PDF_NOT_READABLE`) → UI hien thi notice. */
  error: string | undefined
  /** Thong diep loi thien nhan. */
  errorMessage: string | undefined
  /** Loai trang da trich xuat. */
  sourceKind: string | undefined
}

/**
 * Dinh kem tab dang active vao context.
 *
 * - `existingItems`: cac item da dinh kem → neu tab dang active da co trong
 *   danh sach thi tra ve item do (khong capture lai).
 * - Khong bao gio throw — loi trich xuat duoc tra ve qua `error` de panel
 *   hien thi `ContextNotice` ma khong lam chat that bai.
 */
export async function attachCurrentTab(
  existingItems: readonly ContextItem[] = [],
): Promise<AttachTabResult> {
  try {
    const tabId = await getActiveTabId()
    if (tabId === undefined) {
      return { item: undefined, error: undefined, errorMessage: undefined, sourceKind: undefined }
    }
    return await attachTab(tabId, existingItems)
  } catch {
    return { item: undefined, error: undefined, errorMessage: undefined, sourceKind: undefined }
  }
}

/**
 * Dinh kem mot tab bat ky vao context (dung cho `@` mention — T-M1-05).
 *
 * - Tab da dinh kem roi → tra ve item do, khong capture lai.
 * - Khong bao gio throw.
 *
 * @param tabId - Id tab can dinh kem.
 * @param existingItems - Cac item da dinh kem.
 */
export async function attachTab(
  tabId: number,
  existingItems: readonly ContextItem[] = [],
): Promise<AttachTabResult> {
  try {
    // Tab da duoc dinh kem roi → khong capture lai.
    const existing = existingItems.find((item) => item.tabId === tabId)
    if (existing !== undefined) {
      return {
        item: existing,
        error: undefined,
        errorMessage: undefined,
        sourceKind: existing.sourceKind,
      }
    }

    const context = await captureTabContext(tabId)

    const withError: AttachTabResult = {
      item: undefined,
      error: context.contextError,
      errorMessage: context.contextErrorMessage,
      sourceKind: context.sourceKind,
    }

    // Trang rong (khong co url/title) → khong tao item.
    if (context.url.length === 0 && context.title.length === 0) return withError

    // --- Cache theo URL (T-M1-06) ---
    // Trang co noi dung → ghi cache (de lan sau khong phai trich xuat lai).
    // Trang khong doc duoc (extractor rong, PDF scan, mat mang) → fallback
    // sang ban da cache (neu con han).
    const fresh = toCacheEntry(context)
    const cached = await readCachedContext(context.url)

    if (context.text !== undefined && context.text.length > 0) {
      if (hasContentChanged(cached, fresh)) {
        await writeCachedContext(fresh)
      }
      return {
        ...withError,
        item: {
          id: tabItemId(tabId),
          kind: 'tab',
          tier: 'attachment',
          url: context.url,
          title: context.title,
          text: context.text,
          ...(context.excerpt !== undefined ? { excerpt: context.excerpt } : {}),
          ...(context.sourceKind !== undefined ? { sourceKind: context.sourceKind } : {}),
          tabId,
        },
      }
    }

    // Khong co text → thu dung ban da cache.
    if (cached !== undefined) {
      return {
        ...withError,
        item: {
          id: tabItemId(tabId),
          kind: 'tab',
          tier: 'attachment',
          url: context.url.length > 0 ? context.url : cached.url,
          title: context.title.length > 0 ? context.title : cached.title,
          text: cached.text,
          ...(cached.excerpt !== undefined ? { excerpt: cached.excerpt } : {}),
          ...(cached.sourceKind !== undefined ? { sourceKind: cached.sourceKind } : {}),
          tabId,
        },
      }
    }

    // Khong co text va khong co cache → giu nguyen hanh vi cu (item khong text).
    return {
      ...withError,
      item: {
        id: tabItemId(tabId),
        kind: 'tab',
        tier: 'attachment',
        url: context.url,
        title: context.title,
        ...(context.excerpt !== undefined ? { excerpt: context.excerpt } : {}),
        ...(context.sourceKind !== undefined ? { sourceKind: context.sourceKind } : {}),
        tabId,
      },
    }
  } catch {
    return { item: undefined, error: undefined, errorMessage: undefined, sourceKind: undefined }
  }
}

/**
 * Id dinh danh item cho mot tab.
 *
 * Dung de tranh capture lai cung mot tab da dinh kem.
 */
export function tabItemId(tabId: number): string {
  return `tab-${tabId}`
}

/**
 * Ket qua dinh kem mot doan text user boi den.
 */
export interface AttachSelectionResult {
  /** Item context vua tao — `undefined` khi doan chon rong. */
  item: ContextItem | undefined
  /** Error code (`CONTEXT_SELECTION_EMPTY`) khi khong co doan chon. */
  error: string | undefined
  /** Thong diep loi thien nhan. */
  errorMessage: string | undefined
}

/**
 * Dinh kem doan text user boi den vao context (T-M1-02).
 *
 * Doan chon co `tier: 'selection'` — **cao nhat** trong thu tu uu tien cat
 * bot (`selection` > `attachment` > `currentTab`).
 *
 * - Doan rong → tra `error` (khong tao item).
 * - Id item = hash noi dung → bôi đen lai cung doan → ghi de item cu, khong
 *   nhan ban.
 *
 * @param selection - Doan text da doc tu content script hoac panel.
 */
export function attachSelection(
  selection: PendingSelection,
): AttachSelectionResult {
  const text = selection.text.trim()

  if (text.length === 0) {
    return {
      item: undefined,
      error: SELECTION_EMPTY_ERROR_CODE,
      errorMessage: 'Hãy bôi đen một đoạn văn bản trên trang trước khi dính.',
    }
  }

  const excerpt =
    text.length > LIMITS.MAX_EXCERPT_CHARS
      ? `${text.slice(0, LIMITS.MAX_EXCERPT_CHARS)}...`
      : text

  return {
    item: {
      id: selection.id.length > 0 ? selection.id : selectionItemId(text),
      kind: 'selection',
      tier: 'selection',
      title: selection.title.length > 0 ? selection.title : 'Đoạn đã bôi đen',
      text,
      excerpt,
      ...(selection.url.length > 0 ? { url: selection.url } : {}),
      ...(selection.tabId !== undefined ? { tabId: selection.tabId } : {}),
    },
    error: undefined,
    errorMessage: undefined,
  }
}

/**
 * Doc doan text user dang boi tren tab dang active (duong B — nut trong panel).
 *
 * Dung `chrome.scripting.executeScript` voi `func` tu chua → serialize qua
 * JSON, khong tham chieu bien module-scope (xem `lib/pageContext.ts`).
 *
 * - Khong co quyen / trang dac biet → `undefined` (khong throw).
 *
 * @param tabId - Id tab can doc (mac dinh: tab dang active).
 */
export async function captureActiveSelection(
  tabId?: number,
): Promise<PendingSelection | undefined> {
  try {
    const targetTabId = tabId ?? (await getActiveTabId())
    if (targetTabId === undefined) return undefined

    const results = (await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: () => {
        const selection = window.getSelection()
        if (selection === null) return null
        if (selection.rangeCount === 0) return null
        const raw = selection.toString()
        if (raw.trim().length === 0) return null
        return {
          text: raw,
          title: document.title,
          url: window.location.href,
        }
      },
    })) as Array<{ result?: unknown }>

    const value = results[0]?.result
    if (typeof value !== 'object' || value === null) return undefined

    const record = value as { text?: unknown; title?: unknown; url?: unknown }
    if (typeof record.text !== 'string') return undefined

    const text = normalizeSelectionText(record.text)
    if (!isMeaningfulSelection(text)) return undefined

    return {
      id: selectionItemId(text),
      text,
      url: typeof record.url === 'string' ? record.url : '',
      title: typeof record.title === 'string' ? record.title : '',
      tabId: targetTabId,
      createdAt: Date.now(),
    }
  } catch {
    // Khong inject duoc (trang dac biet, khong co quyen) → undefined.
    return undefined
  }
}
