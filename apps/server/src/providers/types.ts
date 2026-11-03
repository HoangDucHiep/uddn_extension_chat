/**
 * Interface chuan cua provider adapter.
 *
 * Moi provider (Groq / OpenRouter / Gemini / Ollama / Mock) implement
 * cung mot interface de BFF khong can biet chi tiet tung provider.
 * Docs: docs/SYSTEM_DESIGN.md §4.4
 */

import type { ProviderChunk, ProviderStreamRequest } from '@sidekick/shared'

export interface ProviderAdapter {
  /** Id cua provider (khop voi PROVIDER_IDS). */
  readonly id: string
  /** Ten hien thi. */
  readonly name: string
  /** Provider co can API key hay khong. */
  readonly requiresKey: boolean

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
