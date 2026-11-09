/**
 * Luu lua chon provider + model cua nguoi dung (T-M2-02 — FR-PROVIDER-03).
 *
 * Luu trong `chrome.storage.local` key `sidekick.modelSelection`:
 *  - `providerId` — provider user chon (undefined → dung mac dinh cua BFF).
 *  - `model` — model user chon (undefined → dung model mac dinh cua provider).
 *
 * File nay **thuan** (chi dung `chrome.*`) → test duoc truc tiep trong jsdom,
 * khong keo Zod vao bundle (gioi han kich thuoc bundle content script —
 * xem `docs/SYSTEM_DESIGN.md` §7.5).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.22
 */

import { PROVIDER_IDS, type ProviderId } from '@sidekick/shared'

/** Khoa storage luu lua chon provider + model. */
export const MODEL_SELECTION_STORAGE_KEY = 'sidekick.modelSelection'

/** Lua chon provider + model. */
export interface ModelSelection {
  /** Provider user chon. */
  providerId: ProviderId | undefined
  /** Model user chon. */
  model: string | undefined
}

/** Lua chon rong (chua chon gi). */
export const EMPTY_MODEL_SELECTION: ModelSelection = {
  providerId: undefined,
  model: undefined,
}

/**
 * Kiem tra gia tri co phai `ProviderId` hay khong.
 *
 * @param value - Gia tri can kiem tra.
 */
function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value)
}

/**
 * Doc lua chon provider + model hien tai.
 *
 * Storage loi / du lieu sai → tra ve lua chon rong (fallback ve mac dinh BFF).
 */
export async function readModelSelection(): Promise<ModelSelection> {
  try {
    const stored = await chrome.storage.local.get(MODEL_SELECTION_STORAGE_KEY)
    const raw = stored[MODEL_SELECTION_STORAGE_KEY]
    if (typeof raw !== 'object' || raw === null) return EMPTY_MODEL_SELECTION

    const record = raw as Record<string, unknown>
    const providerId = record['providerId']
    const model = record['model']

    return {
      providerId: isProviderId(providerId) ? providerId : undefined,
      model: typeof model === 'string' && model.length > 0 ? model : undefined,
    }
  } catch {
    return EMPTY_MODEL_SELECTION
  }
}

/**
 * Luu lua chon provider + model.
 *
 * @param selection - Lua chon moi (undefined → xoa).
 */
export async function writeModelSelection(selection: ModelSelection): Promise<void> {
  try {
    await chrome.storage.local.set({
      [MODEL_SELECTION_STORAGE_KEY]: {
        providerId: selection.providerId ?? null,
        model: selection.model ?? null,
      },
    })
  } catch {
    // Storage loi → bo qua (lua chon chi la tien ich, khong chan chat).
  }
}

/**
 * Xoa lua chon provider + model → quay ve mac dinh cua BFF.
 */
export async function clearModelSelection(): Promise<void> {
  try {
    await chrome.storage.local.remove(MODEL_SELECTION_STORAGE_KEY)
  } catch {
    // Storage loi → bo qua.
  }
}
