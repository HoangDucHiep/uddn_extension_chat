/**
 * Client goi BFF.
 *
 * Endpoint mac dinh la BFF local. Co the ghi de bang `chrome.storage.local`
 * (`sidekick.bffUrl`) de tro sang host khac.
 */

export const DEFAULT_BFF_URL = 'http://127.0.0.1:8787'

/** Khoa storage cho endpoint BFF. */
export const BFF_URL_STORAGE_KEY = 'sidekick.bffUrl'

/** Doc endpoint BFF tu storage, fallback ve mac dinh. */
export async function getBffUrl(): Promise<string> {
  try {
    const stored = await chrome.storage.local.get(BFF_URL_STORAGE_KEY)
    const value = stored[BFF_URL_STORAGE_KEY]
    if (typeof value === 'string' && value.length > 0) return value.replace(/\/$/, '')
  } catch {
    // Storage khong truy cap duoc (vd trong dev ngoai extension) -> dung mac dinh.
  }
  return DEFAULT_BFF_URL
}

/** Luu endpoint BFF vao storage. */
export async function setBffUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ [BFF_URL_STORAGE_KEY]: url.replace(/\/$/, '') })
}

/** Response error chuan cua BFF. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/**
 * Fetch JSON tu BFF, tu dong parse error body chuan.
 */
export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = await getBffUrl()
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init?.headers,
    },
  })

  const text = await response.text()

  // Body co the khong phai JSON (vd proxy loi tra HTML) → parse phong bien.
  let payload: unknown = null
  if (text.length > 0) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const body = payload as { error?: { code?: string; message?: string } } | null
    throw new ApiError(
      body?.error?.code ?? 'INTERNAL_ERROR',
      body?.error?.message ?? `HTTP ${response.status}`,
      response.status,
    )
  }

  return payload as T
}
