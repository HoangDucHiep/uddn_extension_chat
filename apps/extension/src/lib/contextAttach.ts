/**
 * Dinh kem context item — chi khi user CHU DONG yeu cau.
 *
 * Mô hình moi (FR-CONTEXT-07): tab hien tai **khong** tu dong vao context.
 * User bam "Thêm trang này" (hoac `@` — T-M1-05) moi tao ra item.
 *
 * Giữ nguyên 3 nhanh trich xuat cua T-M1-01/21/22 (html / pdf / youtube) →
 * khong regression.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.1
 */

import type { ContextItem } from '@sidekick/shared'
import { captureTabContext, getActiveTabId } from './pageContext'

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
  const empty: AttachTabResult = {
    item: undefined,
    error: undefined,
    errorMessage: undefined,
    sourceKind: undefined,
  }

  try {
    const tabId = await getActiveTabId()
    if (tabId === undefined) return empty

    // Tab da duoc dinh kem roi → khong capture lai.
    const existing = existingItems.find((item) => item.tabId === tabId)
    if (existing !== undefined) {
      return { ...empty, item: existing, sourceKind: existing.sourceKind }
    }

    const context = await captureTabContext(tabId)

    const withError: AttachTabResult = {
      item: undefined,
      error: context.contextError,
      errorMessage: context.contextErrorMessage,
      sourceKind: context.sourceKind,
    }

    // Trang rong (khong co url/title/text) → khong tao item.
    if (context.url.length === 0 && context.title.length === 0) return withError

    return {
      ...withError,
      item: {
        id: `tab-${tabId}`,
        kind: 'tab',
        tier: 'attachment',
        url: context.url,
        title: context.title,
        ...(context.text !== undefined ? { text: context.text } : {}),
        ...(context.excerpt !== undefined ? { excerpt: context.excerpt } : {}),
        ...(context.sourceKind !== undefined ? { sourceKind: context.sourceKind } : {}),
        tabId,
      },
    }
  } catch {
    return empty
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
