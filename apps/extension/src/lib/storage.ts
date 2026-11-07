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
 * Khoa luu cache context theo URL (T-M1-06).
 *
 * Giu nhung trang da capture de khong trich xuat lai + fallback khi trang
 * dang loi. Co TTL + gioi han so entry (xem `lib/contextCache.ts`).
 */
export const CONTEXT_CACHE_STORAGE_KEY = 'sidekick.contextCache'

/**
 * Tien to khoa luu bản nháp (FR-CHAT-13 — T-M1-10).
 *
 * Moi conversation 1 khoa rieng → `sidekick.draft.<conversationId>`.
 */
export const DRAFT_STORAGE_PREFIX = 'sidekick.draft.'

/**
 * Thoi gian luu toi da cua mot ban nhap (ms) — 30 ngay.
 *
 * Draft la noi dung nguoi dung dang viet → giu lau hon context cache
 * (30 phut) de khong mat khi user dong panel va quay lai hom sau.
 */
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60_000

/**
 * Khoa luu conversation dang mo (de khoi phuc draft sau khi reload).
 *
 * Panel khong giu state conversation qua reload → can luu scope draft
 * de ban nhap cua conversation dang mo van con.
 */
export const ACTIVE_SCOPE_STORAGE_KEY = 'sidekick.activeDraftScope'

/**
 * Scope dung khi chua co conversation nao (panel moi).
 */
export const DRAFT_SCOPE_NEW = 'new'

/**
 * Tao khoa storage cua draft cho 1 conversation.
 *
 * @param conversationId - Id conversation.
 */
export function draftKey(conversationId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${conversationId}`
}

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

/**
 * Doc ban nhap cua 1 conversation (FR-CHAT-13 — T-M1-10).
 *
 * Draft qua TTL → tra `undefined` (va xoa de khong lam bang phinh storage).
 *
 * @param conversationId - Id conversation.
 * @param now - Thoi diem hien tai (epoch ms) — inject de test.
 */
export async function readDraft(
  conversationId: string,
  now = Date.now(),
): Promise<string | undefined> {
  try {
    const key = draftKey(conversationId)
    const stored = await chrome.storage.local.get(key)
    const value = stored[key]

    if (typeof value === 'string') {
      // Ban nhap luu o dang plain string → dung luon (tuong thich client cu).
      return value.length > 0 ? value : undefined
    }

    if (typeof value !== 'object' || value === null) return undefined
    const candidate = value as { content?: unknown; updatedAt?: unknown }

    if (typeof candidate.content !== 'string' || candidate.content.length === 0) {
      return undefined
    }
    if (typeof candidate.updatedAt !== 'number' || !Number.isFinite(candidate.updatedAt)) {
      return undefined
    }

    if (now - candidate.updatedAt > DRAFT_TTL_MS) {
      await clearDraft(conversationId)
      return undefined
    }

    return candidate.content
  } catch {
    return undefined
  }
}

/**
 * Luu ban nhap cua 1 conversation.
 *
 * Draft rong → xoa khoa (khong giu rac).
 *
 * @param conversationId - Id conversation.
 * @param content - Noi dung ban nhap.
 */
export async function writeDraft(conversationId: string, content: string): Promise<void> {
  try {
    const key = draftKey(conversationId)
    if (content.length === 0) {
      await chrome.storage.local.remove(key)
      return
    }
    await chrome.storage.local.set({
      [key]: { content, updatedAt: Date.now() },
    })
  } catch {
    // Storage khong truy cap duoc → bo qua (state trong RAM van dung).
  }
}

/**
 * Xoa ban nhap cua 1 conversation.
 *
 * @param conversationId - Id conversation.
 */
export async function clearDraft(conversationId: string): Promise<void> {
  try {
    await chrome.storage.local.remove(draftKey(conversationId))
  } catch {
    // Storage khong truy cap duoc → bo qua.
  }
}

/**
 * Doc scope draft dang active (conversation dang mo).
 *
 * @returns Id conversation, hoac `'new'` khi chua co conversation.
 */
export async function readActiveDraftScope(): Promise<string> {
  try {
    const stored = await chrome.storage.local.get(ACTIVE_SCOPE_STORAGE_KEY)
    const value = stored[ACTIVE_SCOPE_STORAGE_KEY]
    return typeof value === 'string' && value.length > 0 ? value : DRAFT_SCOPE_NEW
  } catch {
    return DRAFT_SCOPE_NEW
  }
}

/**
 * Luu scope draft dang active (conversation dang mo).
 *
 * @param scope - Id conversation, hoac `'new'`.
 */
export async function writeActiveDraftScope(scope: string): Promise<void> {
  try {
    await chrome.storage.local.set({ [ACTIVE_SCOPE_STORAGE_KEY]: scope })
  } catch {
    // Storage khong truy cap duoc → bo qua.
  }
}
