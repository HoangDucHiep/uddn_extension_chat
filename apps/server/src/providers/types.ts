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
   * Provider that se goi API `GET /models` de discover dong.
   * Neu that bai -> tra ve danh sach uu tien mac dinh.
   */
  listModels(): Promise<string[]>

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

/** Helper tao chunk error. */
export function errorChunk(errorCode: string, errorMessage: string): ProviderChunk {
  return { kind: 'error', errorCode, errorMessage }
}
