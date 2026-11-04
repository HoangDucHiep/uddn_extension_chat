/**
 * Loai trang ma ta biet truoc — dung de chon nhanh trich xuat.
 *
 * `html`  → content script doc DOM (Readability-lite) — T-M1-01
 * `pdf`   → BFF fetch bytes + parse server-side — T-M1-21
 * `youtube` → BFF lay transcript qua player API — T-M1-22
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.1
 */

/** Cac loai trang duoc ho tro. */
export const PAGE_KINDS = ['html', 'pdf', 'youtube', 'unknown'] as const
export type PageKind = (typeof PAGE_KINDS)[number]

/** Loai trang ma BFF co the trich xuat (khong gom `html` — nhanh do client lo). */
export const EXTRACTABLE_KINDS = ['pdf', 'youtube'] as const
export type ExtractableKind = (typeof EXTRACTABLE_KINDS)[number]

/** Host cua YouTube — dung de nhanh biet trang video. */
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
])

/**
 * Kiem tra URL co tro toi file PDF hay khong.
 *
 * Chi dua tren duoi file. Server khong kiem tra `Content-Type` ma xac thuc
 * bang cach parse thu (nhieu host tra PDF qua duong dan khong co `.pdf`, hoac
 * tra `application/octet-stream` → check header se tao false negative).
 */
export function isPdfUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    return parsed.pathname.toLowerCase().endsWith('.pdf')
  } catch {
    return false
  }
}

/**
 * Lay video id tu URL YouTube.
 *
 * Ho tro: `/watch?v=ID` · `/shorts/ID` · `/live/ID` · `/embed/ID` · `youtu.be/ID`.
 * Tra `undefined` neu khong phai URL video YouTube.
 */
export function extractYouTubeVideoId(url: string): string | undefined {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }

  const host = parsed.hostname.toLowerCase()
  if (!YOUTUBE_HOSTS.has(host)) return undefined

  // youtu.be/<id>
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0]
    return id && id.length > 0 ? id : undefined
  }

  // /watch?v=<id>
  const queryId = parsed.searchParams.get('v')
  if (queryId && queryId.length > 0) return queryId

  // /shorts/<id> · /live/<id> · /embed/<id>
  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0)
  if (segments.length >= 2) {
    const [first, second] = segments
    if (first === 'shorts' || first === 'live' || first === 'embed') {
      return second
    }
  }

  return undefined
}

/**
 * Doan loai trang tu URL.
 *
 * `unknown` khi URL khong phai http(s) (vd `chrome://`, `file://`) — client
 * phai bo qua context thay vi goi BFF.
 */
export function detectPageKind(url: string): PageKind {
  if (url.length === 0) return 'unknown'

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'unknown'
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'unknown'

  if (extractYouTubeVideoId(url) !== undefined) return 'youtube'
  if (isPdfUrl(url)) return 'pdf'

  return 'html'
}
