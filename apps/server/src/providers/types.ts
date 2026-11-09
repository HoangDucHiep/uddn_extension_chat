/**
 * Interface chuan cua provider adapter.
 *
 * Moi provider (Groq / OpenRouter / Gemini / Ollama / Mock) implement
 * cung mot interface de BFF khong can biet chi tiet tung provider.
 * Docs: docs/SYSTEM_DESIGN.md §4.4
 */

import type { ProviderChunk, ProviderStreamRequest } from '@sidekick/shared'

/** Ket qua kiem tra API key cua provider. */
export interface ProviderKeyCheck {
  /** Key hop le (provider chap nhan) hay khong. */
  ok: boolean
  /** Thong diep loi tieng Viet khi `ok === false`. */
  error?: string
}

/**
 * Ket qua discovery danh sach model (T-M2-02 — FR-PROVIDER-03).
 *
 * `source` cho biet danh sach la **goi API that** hay **du phong** (provider
 * loi → dung danh sach model mac dinh).
 */
export interface ProviderModelDiscovery {
  /** Danh sach model. */
  models: string[]
  /** Danh sach la discovery that hay du phong. */
  source: 'live' | 'fallback'
}

export interface ProviderAdapter {
  /** Id cua provider (khop voi PROVIDER_IDS). */
  readonly id: string
  /** Ten hien thi. */
  readonly name: string
  /** Provider co can API key hay khong. */
  readonly requiresKey: boolean

  /**
   * Kiem tra API key co hop le hay khong.
   *
   * Dung cho `POST /api/providers/keys/:id/test` (FR-UX-02 — T-M1-25) →
   * onboarding "Luu & kiem tra" xac nhan key thuc su hoat dong.
   *
   * Provider khong can key (mock, ollama) → tra `ok: true`.
   */
  testKey(apiKey: string): Promise<ProviderKeyCheck>

  /**
    * Provider/model co ho tro xu ly anh (FR-VISION-01 — T-M1-24) hay khong.
   *
   * Server dung ham nay de **bo qua** provider/model khong ho tro vision khi
   * request co anh → fallback sang provider khac. Neu khong con provider
   * nao → tra loi `PROVIDER_VISION_UNSUPPORTED`.
   */
  supportsVision(model: string): boolean

  /**
   * Tra ve danh sach model dang hoat dong.
   *
   * Provider that se goi API `GET /models` de discover dong.
   * Neu that bai -> tra ve danh sach uu tien mac dinh.
   *
   * @param apiKey - API key (optional). Truyen vao de provider goi `GET /models`
   *   **co xac thuc** — Groq/OpenRouter tra 401 neu thieu header
   *   `Authorization` → danh sach rong → phai fallback sang `preferredModels`.
   */
  listModels(apiKey?: string): Promise<string[]>

  /**
   * Discover danh sach model **dong** + biet danh sach do la that hay du phong.
   *
   * T-M2-02 (FR-PROVIDER-03) — `listModels` nuot loi ben trong → khong phan biet
   * duoc "provider tra danh sach that" voi "provider loi, dung danh sach mac
   * dinh". `discoverModels` tra them `source` de server/UI biet canh bao nguoi
   * dung ("danh sach co the cu").
   *
   * Adapter khong implement method nay → server coi danh sach la `live`
   * (danh sach tinh san luon dung).
   *
   * @param apiKey - API key (optional) — truyen vao de `GET /models` co xac thuc.
   */
  discoverModels?(apiKey?: string): Promise<ProviderModelDiscovery>

  /**
   * Chon model se duoc dung thuc te cho request.
   * Neu client khong chi dinh model -> dung model mac dinh cua provider.
   */
  resolveModel(requestedModel?: string): string

  /**
   * Stream tra loi. Yield cac chunk da chuan hoa.
   * Adapter tu xu ly retry/fallback model noi bo.
   */
  stream(request: ProviderStreamRequest): AsyncGenerator<ProviderChunk, void, undefined>
}

/** Helper tao chunk token. */
export function tokenChunk(text: string): ProviderChunk {
  return { kind: 'token', text }
}

/** Helper tao chunk usage. */
export function usageChunk(tokensIn: number, tokensOut: number): ProviderChunk {
  return { kind: 'usage', tokensIn, tokensOut }
}

/** Helper tao chunk done. */
export function doneChunk(finishReason: string): ProviderChunk {
  return { kind: 'done', finishReason }
}

/**
 * Helper tao chunk error.
 *
 * `retryable` = loi co the thu lai khong (FR-CHAT-14 — T-M1-19):
 *  - 401/403 (sai API key) → **false** (retry vo ich).
 *  - 429 → `false` (phai doi het han).
 *  - 5xx / loi mang → `true`.
 *
 * @param errorCode - Error code chuan.
 * @param errorMessage - Thong diep loi.
 * @param options - `retryable` + `retryAfterSeconds` (tu provider).
 */
export function errorChunk(
  errorCode: string,
  errorMessage: string,
  options?: { retryable?: boolean; retryAfterSeconds?: number },
): ProviderChunk {
  return {
    kind: 'error',
    errorCode,
    errorMessage,
    ...(options?.retryable !== undefined ? { errorRetryable: options.retryable } : {}),
    ...(options?.retryAfterSeconds !== undefined
      ? { retryAfterSeconds: options.retryAfterSeconds }
      : {}),
  }
}
