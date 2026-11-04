/**
 * Hop dong giữa content script → service worker → side panel cho
 * selection context (T-M1-02, FR-CONTEXT-04).
 *
 * File nay **khong** import Zod hay thu vien ngoai → content script dung
 * duoc (content script phai build o dang IIFE 1 file, khong `import`).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.4
 */

/** Action gui doan boi den tu content script len service worker. */
export const SELECTION_ACTION = 'sidekick:selection'

/** Error code khi user yeu cau dinh doan chon nhung khong co doan nao. */
export const SELECTION_EMPTY_ERROR_CODE = 'CONTEXT_SELECTION_EMPTY'

/**
 * Doan text user boi den, cho chuyen tiep giua cac tang.
 *
 * `createdAt` la epoch (ms) → dung de tinh TTL.
 */
export interface PendingSelection {
  /** Id dinh danh doan (hash nội dung → bôi đen lại cùng đoạn thì thay). */
  id: string
  /** Text da chuan hoa. */
  text: string
  /** URL trang chứa đoạn chọn (có thể rỗng). */
  url: string
  /** Tiêu đề trang (có thể rỗng). */
  title: string
  /** Id tab chứa đoạn chọn (có thể `undefined`). */
  tabId: number | undefined
  /** Thời điểm tạo (epoch ms). */
  createdAt: number
}

/** Shape message do content script gửi lên. */
export interface SelectionMessage {
  action: typeof SELECTION_ACTION
  payload: PendingSelection
}

/**
 * Kiem tra mot value co phai message selection hop le khong.
 *
 * Dung type guard thay vi `zod` de content script khong keo bundle `zod`.
 *
 * @param value - Value nhan duoc tu `chrome.runtime.onMessage`.
 */
export function isSelectionMessage(value: unknown): value is SelectionMessage {
  if (typeof value !== 'object' || value === null) return false

  const record = value as { action?: unknown; payload?: unknown }
  if (record.action !== SELECTION_ACTION) return false
  if (typeof record.payload !== 'object' || record.payload === null) return false

  const payload = record.payload as Partial<PendingSelection>
  return (
    typeof payload.id === 'string' &&
    payload.id.length > 0 &&
    typeof payload.text === 'string' &&
    typeof payload.url === 'string' &&
    typeof payload.title === 'string' &&
    typeof payload.createdAt === 'number' &&
    Number.isFinite(payload.createdAt)
  )
}

/**
 * Hash nội dung doan chon → id on dinh.
 *
 * Dung FNV-1a 32-bit (nhanh, khong can crypto). Mục đích KHÔNG phải bảo
 * mật — chỉ để bôi đen lại cùng một đoạn thì ghi đè item cũ thay vì
 * nhân bản.
 *
 * @param text - Text đã chuẩn hoá.
 */
export function selectionItemId(text: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    // hash *= 16777619 (FNV prime), lam bang phong to de tranh float.
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  return `selection-${hash.toString(16)}`
}
