/**
 * Client goi BFF cho tool (FR-TOOLS-01/04 — T-M2-09).
 *
 * Dung `fetchJson` cua `lib/apiClient.ts` → loi chuan hoa san (`ApiError`).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26
 */

import {
  API_ROUTES,
  type ToolApprovalResponse,
  type ToolListResponse,
} from '@sidekick/shared'
import { fetchJson } from './apiClient.js'

/**
 * Liet ke tool server dang co.
 *
 * Dung cho Settings (T-M2-08) + hien thi ten tool trong UI.
 */
export async function listTools(): Promise<ToolListResponse> {
  return fetchJson<ToolListResponse>(API_ROUTES.tools)
}

/**
 * Duyet 1 tool call (FR-TOOLS-04 — T-M2-09).
 *
 * Server ghi `approved_by_user = true` vao bang `tool_calls`.
 *
 * @param callId - Id tool call.
 */
export async function approveToolCall(callId: string): Promise<ToolApprovalResponse> {
  return fetchJson<ToolApprovalResponse>(
    `${API_ROUTES.tools}/${encodeURIComponent(callId)}/approve`,
    { method: 'POST' },
  )
}

/**
 * Tu choi 1 tool call (FR-TOOLS-04 — T-M2-09).
 *
 * Server ghi `approved_by_user = false` vao bang `tool_calls`.
 *
 * @param callId - Id tool call.
 */
export async function denyToolCall(callId: string): Promise<ToolApprovalResponse> {
  return fetchJson<ToolApprovalResponse>(
    `${API_ROUTES.tools}/${encodeURIComponent(callId)}/deny`,
    { method: 'POST' },
  )
}
