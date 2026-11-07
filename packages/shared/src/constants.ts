/**
 * Hang so dung chung giua extension / server / eval.
 * Moi thay doi o day deu phai reflect vao docs/SYSTEM_DESIGN.md.
 */

/** Id provider duoc ho tro. */
export const PROVIDER_IDS = ['mock', 'groq', 'openrouter', 'gemini', 'ollama'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

/** Provider ID dung cho mock (test, offline). */
export const MOCK_PROVIDER_ID = 'mock' satisfies ProviderId

/** Nguon API key. */
export const KEY_SOURCES = ['K1', 'K2', 'K3'] as const
export type KeySource = (typeof KEY_SOURCES)[number]

/** Gioi han an toan. */
export const LIMITS = {
  MAX_MESSAGE_CHARS: 32_000,
  MAX_CONTEXT_CHARS: 100_000,
  MAX_HISTORY_MESSAGES: 40,
  MAX_OUTPUT_TOKENS: 4096,
  REQUEST_TIMEOUT_MS: 120_000,
  MAX_SSE_BUFFER_BYTES: 1_000_000,
  /** Do dai toi da cua noi dung trang da trich xuat (ky tu). */
  MAX_PAGE_TEXT_CHARS: 40_000,
  /** Do dai toi da cua excerpt/selection context. */
  MAX_EXCERPT_CHARS: 500,
  /** Do dai toi da cua doan text user boi den (ky tu) — T-M1-02. */
  MAX_SELECTION_CHARS: 10_000,
  /** Do dai nho nhat de doan boi den duoc xem la co y nghia — T-M1-02. */
  MIN_SELECTION_CHARS: 10,
  /** Kich thuoc toi da cua file PDF duoc fetch ve (byte) — T-M1-21. */
  MAX_PDF_BYTES: 20_000_000,
  /** Do dai toi da cua transcript / text da trich (ky tu) — T-M1-21/22. */
  MAX_EXTRACT_TEXT_CHARS: 40_000,
  /** Timeout khi BFF fetch URL ben ngoai (ms) — T-M1-21/22. */
  EXTRACT_FETCH_TIMEOUT_MS: 15_000,
} as const

/**
 * Context window (token) cua tung provider.
 *
 * Dung de tinh ngan sach context (FR-CONTEXT-07) — server cat theo context
 * window cua provider thuc te, extension hien thi meter theo provider dang
 * dung. Docs: docs/SYSTEM_DESIGN.md §8
 */
export const CONTEXT_WINDOWS: Record<ProviderId, number> = {
  mock: 8_000,
  groq: 128_000,
  openrouter: 128_000,
  gemini: 1_000_000,
  ollama: 32_000,
}

/**
 * Margin an toan (token) giu lai khi tinh ngan sach context.
 *
 * Token uoc luong bang heuristic nen can dem cho phan sinh output + prompt
 * he thong de tranh tran context window cua provider.
 */
export const CONTEXT_SAFETY_MARGIN_TOKENS = 2_000

/** So context item toi da trong 1 request. */
export const MAX_CONTEXT_ITEMS = 20

/**
 * Thoi gian cache context theo URL (ms) — T-M1-06.
 *
 * Cache dung de (a) khong trich xuat lai trang da doc va (b) fallback khi
 * trang dang loi. TTL ngan de trang thay doi van duoc lay noi dung moi.
 */
export const CONTEXT_CACHE_TTL_MS = 30 * 60_000

/** So entry toi da giu trong cache context (T-M1-06). */
export const CONTEXT_CACHE_MAX_ENTRIES = 20

/**
 * Thoi gian cho mot doan boi den cho chờ (ms) — T-M1-02.
 *
 * Doan chon nam trong `chrome.storage.local` cho panel mo sau. Qua thoi gian
 * nay doan bi bo (user dang chuyen sang task khac) → tranh dinh kem nham.
 */
export const SELECTION_PENDING_TTL_MS = 300_000

/**
 * Cac MIME type duoc phep cho anh dinh kem (FR-VISION-01).
 *
 * Khai bao o day (khong phai trong `schemas/vision.ts`) de `constants.ts`
 * khong phai import nguoc lai `vision.ts` — tranh vong lap import.
 * `schemas/vision.ts` re-export tu day de chi co mot nguon su that.
 */
export const VISION_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const
export type VisionMimeType = (typeof VISION_MIME_TYPES)[number]

/**
 * Gioi han cho anh dinh kem (FR-VISION-01 — T-M1-24).
 *
 * Dùng chung giữa extension (validate som khi user chon file) và server
 * (validate lai o bien) → mot quy tac, mot nguon su that.
 */
export const VISION = {
  /** Kich thuoc toi da cua mot anh (byte) — 5 MB. */
  MAX_IMAGE_BYTES: 5_000_000,
  /** So toi da cua anh moi turn hoi thoai. */
  MAX_IMAGES_PER_MESSAGE: 4,
  /** Tong kich thuoc toi da cua tat ca anh trong mot turn (byte) — 12 MB. */
  MAX_TOTAL_IMAGE_BYTES: 12_000_000,
  /** Cac MIME type duoc phep. */
  ALLOWED_MIME_TYPES: VISION_MIME_TYPES,
  /**
   * Token uoc luong cho moi anh.
   *
   * Heuristic theo quy uoc OpenAI (~258 token / anh 512px). Chi de uoc luong
   * ngan sach context — so token thật den tu `usage` event cua provider.
   */
  TOKEN_ESTIMATE_PER_IMAGE: 258,
} as const

/** Endpoint cua BFF. */
export const API_BASE_PATH = '/api'

export const API_ROUTES = {
  health: `${API_BASE_PATH}/health`,
  chat: `${API_BASE_PATH}/chat`,
  conversations: `${API_BASE_PATH}/conversations`,
  /** Lich su hoi thoai cua 1 conversation — template, thay `:id`. */
  conversationMessages: `${API_BASE_PATH}/conversations/:id/messages`,
  /** Doi bien the active cua 1 turn — template, thay `:id` va `:turnId`. */
  conversationTurnActivate: `${API_BASE_PATH}/conversations/:id/turns/:turnId/activate`,
  providers: `${API_BASE_PATH}/providers`,
  /** API key BYOK (K2) — GET/POST/DELETE + test. */
  providerKeys: `${API_BASE_PATH}/providers/keys`,
  extractPdf: `${API_BASE_PATH}/extract/pdf`,
  extractYoutube: `${API_BASE_PATH}/extract/youtube`,
  /** Anh dinh kem — GET /api/attachments/:id tra ve binary. */
  attachment: `${API_BASE_PATH}/attachments`,
} as const

/**
 * Cac buoc cua onboarding lan dau (FR-UX-02 — T-M1-25).
 *
 * Thu tu: giai thich quyen → chon provider (nhap key) → thu cau hoi.
 */
export const ONBOARDING_STEPS = ['permissions', 'provider', 'try'] as const
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

/** Co loi bao gio phai dung. */
export const DEFAULT_SYSTEM_PROMPT =
  'Ban la Sidekick AI, tro ly ao trong sidebar cua trinh duyet. Tra loi ngan gon, dung nham hinh, ' +
  'va uu tien thong tin mau dich chinh xac.'

/**
 * Chi dan them cho provider khi tiep tuc cau tra loi da bi stop (FR-CHAT-07).
 *
 * Client gui `operation: 'continue'` → server append turn nay sau phan
 * cau tra loi da ngat de model chi viet phan con thieu.
 */
export const CONTINUE_INSTRUCTION =
  'Tiep tuc cau tra loi truoc do tu dung cho no bi ngat. Chi viet phan tiep theo, ' +
  'khong lap lai phan da co.'

/**
 * Prompt tom tat trang 1-click (FR-UX-04 — T-M1-11).
 *
 * Dung chung wording voi dataset eval `summarize` (docs/EVAL_PLAN.md §3) →
 * do duoc, khong lech giua UI va eval.
 */
export const SUMMARY_PROMPT =
  'Tóm tắt trang này thành 5 ý chính, nêu 2 con số nổi bật và 1 câu hỏi chưa được trả lời. Trả lời bằng tiếng Việt.'
