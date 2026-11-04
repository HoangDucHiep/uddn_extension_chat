/**
 * Client goi BFF de trich xuat context PDF / transcript YouTube.
 *
 * Khac voi nhanh HTML (content script doc DOM truc tiep), 2 nhanh nay duoc
 * BFF trich xuat server-side rui tra ve cung shape `text`.
 *
 * Nguyen tac: KHONG bao gio throw. Moi loi duoc doi thanh `contextError` de
 * panel van chat duoc (chi mat context, khong mat chuc nang).
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.3.1
 */

import { API_ROUTES, type ExtractResponse } from '@sidekick/shared'
import { ApiError, fetchJson } from './apiClient.js'

/** Ket qua trich xuat — `error` co nghia la that bai (khong phai throw). */
export interface ExtractOutcome {
  text: string
  title: string | undefined
  truncated: boolean
  error: string | undefined
  errorMessage: string | undefined
}

/**
 * Trich xuat noi dung theo loai trang.
 *
 * @param kind - `pdf` hoac `youtube`.
 * @param url - URL cua trang can trich xuat.
 */
export async function requestExtract(
  kind: 'pdf' | 'youtube',
  url: string,
): Promise<ExtractOutcome> {
  const path = kind === 'pdf' ? API_ROUTES.extractPdf : API_ROUTES.extractYoutube

  try {
    const payload = await fetchJson<ExtractResponse>(path, {
      method: 'POST',
      body: JSON.stringify({ kind, url }),
    })

    return {
      text: payload.text,
      title: payload.title,
      truncated: payload.truncated,
      error: payload.error,
      errorMessage: payload.errorMessage,
    }
  } catch (error) {
    // BFF khong phat (offline) hoac body sai → bao loi chung, khong lam chat that bai.
    if (error instanceof ApiError) {
      return {
        text: '',
        title: undefined,
        truncated: false,
        error: error.code,
        errorMessage: error.message,
      }
    }

    return {
      text: '',
      title: undefined,
      truncated: false,
      error: 'CONTEXT_EXTRACT_FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}
