/**
 * Client goi BFF cho provider + BYOK key (FR-UX-02 — T-M1-25).
 *
 * Dung `fetchJson` cua `lib/apiClient.ts` → loi chuan hoa san (`ApiError`).
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1
 */

import {
  API_ROUTES,
  type ProviderId,
  type ProviderInfo,
  type ProviderKeyRecord,
  type ProviderKeyTestResult,
} from '@sidekick/shared'
import { fetchJson } from './apiClient.js'

/** Danh sach provider + trang thai key. */
export async function listProviders(): Promise<ProviderInfo[]> {
  const response = await fetchJson<{ items: ProviderInfo[] }>(API_ROUTES.providers)
  return response.items
}

/** Danh sach key da luu (chi metadata + key da che). */
export async function listProviderKeys(): Promise<ProviderKeyRecord[]> {
  const response = await fetchJson<{ items: ProviderKeyRecord[] }>(API_ROUTES.providerKeys)
  return response.items
}

/**
 * Luu API key (BYOK — K2).
 *
 * @param providerId - Provider can key.
 * @param apiKey - Key goc (chi gui len BFF de ma hoa — khong luu o client).
 * @param label - Nhan tuy chon (mac dinh `default`).
 */
export async function saveProviderKey(
  providerId: ProviderId,
  apiKey: string,
  label?: string,
): Promise<ProviderKeyRecord> {
  return fetchJson<ProviderKeyRecord>(API_ROUTES.providerKeys, {
    method: 'POST',
    body: JSON.stringify({
      providerId,
      apiKey,
      ...(label !== undefined ? { label } : {}),
    }),
  })
}

/**
 * Kiem tra API key da luu co hoat dong khong.
 *
 * @param id - Id cua ban ghi key.
 */
export async function testProviderKey(id: string): Promise<ProviderKeyTestResult> {
  return fetchJson<ProviderKeyTestResult>(`${API_ROUTES.providerKeys}/${id}/test`, {
    method: 'POST',
  })
}

/**
 * Xoa API key da luu.
 *
 * @param id - Id cua ban ghi key.
 */
export async function deleteProviderKey(id: string): Promise<void> {
  await fetchJson<null>(`${API_ROUTES.providerKeys}/${id}`, { method: 'DELETE' })
}
