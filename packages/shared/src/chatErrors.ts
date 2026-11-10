/**
 * Phan loai loi chat (FR-CHAT-14 / NFR-REL-02 — T-M1-19).
 *
 * Server, extension va eval deu can mot **taxonomy duy nhat** de biet:
 *  - loi nao **co the thu lai** (retry) — loi tam thoi (mang, 5xx).
 *  - loi nao **khong duoc thu lai** — sai API key (401) → retry vo ich.
 *  - loi nao can **dem nguoc** (429) → bao user biet bao lau thi thu lai.
 *
 * File nay **thuan** (khong dung Chrome API, khong dung React) → test duoc
 * trong vitest o ca 3 workspace.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.15
 */

import { ERROR_CODES } from './errors.js'

/**
 * Nhom loi cua luong chat.
 *
 * - `network` — khong toi duoc may chu / mat ket noi / timeout.
 * - `rate-limit` — provider bat giu tan (429).
 * - `auth` — API key sai / thieu (401, 403) → **khong** retry.
 * - `provider` — provider loi nhung loi hon (model khong ton tai, loi tham so).
 * - `server` — loi 5xx cua BFF hoac provider.
 * - `budget` — da vuot han muc chi phi (FR-PROVIDER-06) → **khong** retry.
 * - `unknown` — khong phan loai duoc → coi nhu `server` (an toan: cho retry).
 */
export type ChatErrorKind =
  | 'network'
  | 'rate-limit'
  | 'auth'
  | 'provider'
  | 'server'
  | 'budget'
  | 'unknown'

/** Do dai mac dinh cua dem nguoc khi provider khong tra `Retry-After` (giay). */
export const DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS = 60

/**
 * Cac error code la loi xac thuc → khong bao gio retry tu dong.
 *
 * Chi lay tu `ERROR_CODES` de khong phai hardcode chuoi.
 */
const AUTH_ERROR_CODES: readonly string[] = [
  ERROR_CODES.UNAUTHORIZED,
  ERROR_CODES.FORBIDDEN,
  ERROR_CODES.INVALID_API_KEY,
  ERROR_CODES.PROVIDER_KEY_INVALID,
  ERROR_CODES.MISSING_API_KEY,
  ERROR_CODES.MASTER_KEY_NOT_CONFIGURED,
]

/** Cac error code la loi gioi han tan so. */
const RATE_LIMIT_ERROR_CODES: readonly string[] = [
  ERROR_CODES.RATE_LIMITED,
  ERROR_CODES.PROVIDER_RATE_LIMITED,
  ERROR_CODES.PROVIDER_QUOTA_EXCEEDED,
]

/** Cac error code la loi mang / may chu khong phan hoi. */
const NETWORK_ERROR_CODES: readonly string[] = [
  ERROR_CODES.SERVICE_UNAVAILABLE,
  ERROR_CODES.PROVIDER_UNAVAILABLE,
  ERROR_CODES.TIMEOUT,
  ERROR_CODES.STREAM_ERROR,
]

/** Cac error code la loi 5xx cua BFF. */
const SERVER_ERROR_CODES: readonly string[] = [
  ERROR_CODES.INTERNAL_ERROR,
  ERROR_CODES.DB_ERROR,
]

/** Cac error code loi cua provider (khong phai loi xac thuc, khong phai 429). */
const PROVIDER_ERROR_CODES: readonly string[] = [
  ERROR_CODES.PROVIDER_ERROR,
  ERROR_CODES.MODEL_NOT_FOUND,
]

/**
 * Cac error code la **vuot han muc chi phi** (FR-PROVIDER-06 — T-M2-03b).
 *
 * Retry vo ich (chi phi da vuot han muc → moi luot deu bi chan) → phai
 * cho user doi cau hinh budget.
 */
const BUDGET_ERROR_CODES: readonly string[] = [ERROR_CODES.BUDGET_EXCEEDED]

/**
 * Phan loai error code thanh nhom loi.
 *
 * Error code la chuoi (vi SSE `error.code` chi la string) → dung bang danh
 * sach chuoi de tranh phai validate lai o bien. Code la `ERROR_CODES` thi
 * dung chinh xac; code la chuoi bat ky → `unknown`.
 *
 * @param code - Error code tu server (hoac HTTP status duoc chuan hoa).
 * @returns Nhom loi tuong ung.
 */
export function classifyChatError(code: string): ChatErrorKind {
  if (AUTH_ERROR_CODES.includes(code)) return 'auth'
  if (RATE_LIMIT_ERROR_CODES.includes(code)) return 'rate-limit'
  if (NETWORK_ERROR_CODES.includes(code)) return 'network'
  if (SERVER_ERROR_CODES.includes(code)) return 'server'
  if (PROVIDER_ERROR_CODES.includes(code)) return 'provider'
  if (BUDGET_ERROR_CODES.includes(code)) return 'budget'
  return 'unknown'
}

/**
 * Nhom loi co **duoc** thu lai (thu cong) khong.
 *
 * - `auth` → **khong** retry (key sai → retry vo ich) — NFR-REL-02.
 * - `budget` → **khong** retry (vuot han muc → phai doi cau hinh).
 * - `rate-limit` → retry sau khi het han (client dem nguoc).
 * - Con lai → retry duoc (mang, 5xx, provider loi tam thoi).
 *
 * @param kind - Nhom loi.
 */
export function isRetryableKind(kind: ChatErrorKind): boolean {
  return kind !== 'auth' && kind !== 'budget'
}

/**
 * Nhom loi duoc **tu dong** thu lai 1 lan (NFR-REL-02).
 *
 * Chi loi tam thoi moi tu dong retry:
 *  - `network` / `server` / `unknown` → co the loi mat ket noi tam thoi.
 *  - `rate-limit` → **khong** (phai doi het han).
 *  - `auth` → **khong** (key sai).
 *  - `budget` → **khong** (vuot han muc — FR-PROVIDER-06).
 *  - `provider` → **khong** (model khong ton tai / tham so sai → retry cung loi).
 *
 * @param kind - Nhom loi.
 */
export function shouldAutoRetry(kind: ChatErrorKind): boolean {
  return kind === 'network' || kind === 'server' || kind === 'unknown'
}

/**
 * So giay cho user thu lai mac dinh theo nhom loi.
 *
 * - `rate-limit` → 60 giay (provider thuong cho lai sau ~1 phut).
 * - Nhom khac → `undefined` (khong dem nguoc, user thu ngay).
 *
 * @param kind - Nhom loi.
 */
export function defaultRetryAfterSeconds(kind: ChatErrorKind): number | undefined {
  if (kind === 'rate-limit') return DEFAULT_RATE_LIMIT_RETRY_AFTER_SECONDS
  return undefined
}

/**
 * Do dai backoff (ms) cho lan retry tu dong thu hai.
 *
 * Chi 1 lan retry (NFR-REL-02: "tu retry 1 lan") → backoff co dinh, khong
 * can jitter.
 */
export const AUTO_RETRY_BACKOFF_MS = 800
