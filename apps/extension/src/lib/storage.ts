/**
 * Helper doc/ghi `chrome.storage.local`.
 *
 * Moi thao tac deu bat loi → storage khong truy cap duoc (vd dev ngoai
 * extension) thi dung gia tri mac dinh thay vi lam panel crash.
 *
 * Docs: docs/SYSTEM_DESIGN.md §3 (lib/storage.ts)
 */

import { SELECTION_PENDING_TTL_MS } from '@sidekick/shared/constants'
import { selectionItemId, type PendingSelection } from './selectionProtocol'

/** Khoa luu trang thai bat/tat context. */
export const CONTEXT_ENABLED_STORAGE_KEY = 'sidekick.contextEnabled'

/**
 * Khoa luu doan text user boi den dang cho panel nhan (T-M1-02).
 *
 * Doan chon co the xuat hien khi panel **dang dong** → service worker luu
 * vao day, panel mo sau tu doc (xem `consumePendingSelection`).
 */
export const PENDING_SELECTION_STORAGE_KEY = 'sidekick.pendingSelection'

/**
 * Doc trang thai bat/tat context da luu.
 *
 * Mac dinh `false` — context chi duoc gui khi user chu dong dinh kem.
 */
export async function readContextEnabled(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(CONTEXT_ENABLED_STORAGE_KEY)
    return stored[CONTEXT_ENABLED_STORAGE_KEY] === true
  } catch {
    return false
  }
}

/** Luu trang thai bat/tat context. */
export async function writeContextEnabled(enabled: boolean): Promise<void> {
  try {
    await chrome.storage.local.set({ [CONTEXT_ENABLED_STORAGE_KEY]: enabled })
  } catch {
    // Storage khong truy cap duoc → bo qua, state trong RAM van dung.
  }
}

/**
 * Luu doan text user boi den dang cho panel nhan (T-M1-02).
 *
 * @param selection - Doan chon (da chuan hoa).
 */
export async function writePendingSelection(selection: PendingSelection): Promise<void> {
  try {
    await chrome.storage.local.set({ [PENDING_SELECTION_STORAGE_KEY]: selection })
  } catch {
    // Storage khong truy cap duoc → panel khong nhan duoc doan chon.
  }
}

/**
 * Doc doan text cho, khong xoa.
 *
 * Doan qua TTL (`SELECTION_PENDING_TTL_MS`) → tra `undefined` (va xoa luon
 * de khong lam bang phinh storage).
 *
 * @param now - Thoi diem hien tai (epoch ms) — inject de test.
 */
export async function readPendingSelection(now = Date.now()): Promise<PendingSelection | undefined> {
  try {
    const stored = await chrome.storage.local.get(PENDING_SELECTION_STORAGE_KEY)
    const value = stored[PENDING_SELECTION_STORAGE_KEY]
    if (typeof value !== 'object' || value === null) return undefined

    const candidate = value as Partial<PendingSelection>
    if (typeof candidate.text !== 'string' || candidate.text.length === 0) return undefined
    if (typeof candidate.createdAt !== 'number' || !Number.isFinite(candidate.createdAt)) {
      return undefined
    }

    if (now - candidate.createdAt > SELECTION_PENDING_TTL_MS) {
      await clearPendingSelection()
      return undefined
    }

    return {
      id: typeof candidate.id === 'string' ? candidate.id : selectionItemId(candidate.text),
      text: candidate.text,
      url: typeof candidate.url === 'string' ? candidate.url : '',
      title: typeof candidate.title === 'string' ? candidate.title : '',
      tabId: typeof candidate.tabId === 'number' ? candidate.tabId : undefined,
      createdAt: candidate.createdAt,
    }
  } catch {
    return undefined
  }
}

/**
 * Doc va xoa doan text cho (chi dung mot lan).
 *
 * Dung khi panel nhan doan chon → xoa de khong dinh kem lai khi panel mo lai.
 */
export async function consumePendingSelection(now = Date.now()): Promise<PendingSelection | undefined> {
  const pending = await readPendingSelection(now)
  if (pending === undefined) return undefined

  await clearPendingSelection()
  return pending
}

/** Xoa doan text cho. */
export async function clearPendingSelection(): Promise<void> {
  try {
    await chrome.storage.local.remove(PENDING_SELECTION_STORAGE_KEY)
  } catch {
    // Storage khong truy cap duoc → bo qua.
  }
}
