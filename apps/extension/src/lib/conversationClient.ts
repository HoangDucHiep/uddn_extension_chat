/**
 * Client goi BFF cho CRUD conversation (FR-CHAT-08/09/11 — T-M1-09).
 *
 * Dung `fetchJson` cua `lib/apiClient.ts` → loi chuan hoa san (`ApiError`).
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.10
 */

import {
  API_ROUTES,
  type ConversationListResponse,
  type ConversationMessagesResponse,
  type ConversationSummary,
  type UpdateConversationInput,
} from '@sidekick/shared'
import { fetchJson } from './apiClient.js'

/** Tham so loc danh sach conversation. */
export interface ListConversationsParams {
  /** Chuoi tim kiem theo ten. */
  q?: string | undefined
  /** `true` → tra conversation da luu tru. */
  archived?: boolean
  /** So dong toi da. */
  limit?: number
  /** Con trang (keyset pagination). */
  cursor?: string | undefined
}

/**
 * Liet ke conversation.
 *
 * @param params - Bo loc + phan trang.
 */
export async function listConversations(
  params: ListConversationsParams = {},
): Promise<ConversationListResponse> {
  const search = new URLSearchParams()
  if (params.q !== undefined && params.q.length > 0) search.set('q', params.q)
  if (params.archived === true) search.set('archived', 'true')
  if (params.limit !== undefined) search.set('limit', String(params.limit))
  if (params.cursor !== undefined) search.set('cursor', params.cursor)

  const suffix = search.toString()
  return fetchJson<ConversationListResponse>(
    suffix.length > 0 ? `${API_ROUTES.conversations}?${suffix}` : API_ROUTES.conversations,
  )
}

/**
 * Tao conversation moi.
 *
 * @param title - Tieu de (mac dinh do server sinh).
 */
export async function createConversation(title?: string): Promise<ConversationSummary> {
  return fetchJson<ConversationSummary>(API_ROUTES.conversations, {
    method: 'POST',
    body: JSON.stringify(title === undefined ? {} : { title }),
  })
}

/**
 * Cap nhat conversation (doi ten / ghim / luu tru).
 *
 * @param id - Id conversation.
 * @param patch - Truong can doi.
 */
export async function updateConversation(
  id: string,
  patch: UpdateConversationInput,
): Promise<ConversationSummary> {
  return fetchJson<ConversationSummary>(`${API_ROUTES.conversations}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/**
 * Xoa conversation.
 *
 * @param id - Id conversation.
 */
export async function deleteConversation(id: string): Promise<void> {
  await fetchJson<null>(`${API_ROUTES.conversations}/${id}`, { method: 'DELETE' })
}

/**
 * Tai lich su hoi thoai cua 1 conversation (kem citations da luu).
 *
 * @param id - Id conversation.
 */
export async function getConversationMessages(
  id: string,
): Promise<ConversationMessagesResponse> {
  return fetchJson<ConversationMessagesResponse>(
    `${API_ROUTES.conversations}/${id}/messages`,
  )
}
