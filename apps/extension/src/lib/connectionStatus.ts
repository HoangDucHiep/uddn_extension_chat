import { getBffUrl } from './apiClient'

/**
 * Trang thai ket noi toi BFF (NFR-REL-04 — T-M1-19).
 *
 * Panel phai **hien thi** trang thai ket noi de user biet chat co chay
 * duoc hay khong — giong Edge Copilot / Chrome Gemini.
 *
 * File nay **thuan** (khong React) → test duoc trong vitest.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.15
 */

/** Trang thai ket noi hien thi tren badge. */
export type ConnectionStatus = 'connecting' | 'connected' | 'offline' | 'degraded'

/** Chuoi backoff giua 2 lan probe (ms): 5s → 15s → 30s. */
export const CONNECTION_BACKOFF_MS: readonly number[] = [5_000, 15_000, 30_000]

/** Timeout cua 1 lan probe (ms). */
export const CONNECTION_PROBE_TIMEOUT_MS = 3_000

/** Ket qua 1 lan probe health. */
export interface ConnectionProbeResult {
  status: ConnectionStatus
  /** Timestamp lan probe vua roi (ms). */
  checkedAt: number
}

/**
 * Chon do dai backoff cho lan probe thu `attempt`.
 *
 * `attempt` bat dau tu 0 → 5s, 15s, 30s, roi giu nguyen 30s.
 *
 * @param attempt - So lan probe da thuc hien.
 */
export function backoffFor(attempt: number): number {
  if (attempt < 0) return CONNECTION_BACKOFF_MS[0] ?? 5_000
  const index = Math.min(attempt, CONNECTION_BACKOFF_MS.length - 1)
  return CONNECTION_BACKOFF_MS[index] ?? 30_000
}

/**
 * Lay do dai backoff tiep theo sau khi probe that bai.
 *
 * @param attempt - So lan probe da thuc hien (truoc do).
 * @returns Do dai backoff moi (ms).
 */
export function nextBackoff(attempt: number): number {
  return backoffFor(attempt + 1)
}

/**
 * Probe `GET <bffUrl>/api/health` de xac dinh trang thai ket noi.
 *
 * - Thanh cong → `connected` (hoac `degraded` neu BFF bao `degraded`).
 * - That bai → `offline`.
 * - Timeout → `offline`.
 *
 * @param timeoutMs - Timeout cua request (ms).
 * @returns Trang thai ket noi + thoi diem kiem tra.
 */
export async function probeConnection(
  timeoutMs: number = CONNECTION_PROBE_TIMEOUT_MS,
): Promise<ConnectionProbeResult> {
  const checkedAt = Date.now()
  try {
    const baseUrl = await getBffUrl()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        return { status: 'offline', checkedAt }
      }
      const body = (await response.json()) as { status?: string }
      return {
        status: body.status === 'degraded' ? 'degraded' : 'connected',
        checkedAt,
      }
    } finally {
      clearTimeout(timer)
    }
  } catch {
    // BFF khong phan hoi / mang cut → offline.
    return { status: 'offline', checkedAt }
  }
}

/**
 * Chuyen trang thai `navigator.onLine` sang trang thai hien thi.
 *
 * @param online - Gia tri `navigator.onLine`.
 */
export function statusFromOnline(online: boolean): ConnectionStatus {
  return online ? 'connecting' : 'offline'
}
