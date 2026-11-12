/**
 * Gioi han do dai output (token) — nguon su that dung chung extension/server.
 *
 * FR-CHAT-15 — T-M2-24.
 *
 * Truoc day server ep `max_tokens = 2048` cho moi luot → nhieu cau tra loi
 * bi cat giua chung (`finish_reason = 'length'`) va client **bo qua** trang
 * thai nay → user khong co "nut Tiep tuc" nao de bam.
 *
 * Nay:
 *  - nang mac dinh len `OUTPUT_LIMITS.DEFAULT_MAX_OUTPUT_TOKENS` (8192),
 *  - gioi han theo tung provider (`PROVIDER_OUTPUT_CAPS`),
 *  - de server tu noi tiep khi model van bi cat (xem `autoContinue.ts`).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.30
 */

import { LIMITS, OUTPUT_LIMITS, type ProviderId } from './constants.js'

/**
 * Tran output token theo provider.
 *
 * - `mock` — chi dung test, khong can to.
 * - `groq` / `openrouter` — OpenAI-compatible, tran thong thuong la 16k.
 * - `gemini` — context window 1M, cho phep output rat lon.
 * - `ollama` — mac dinh `num_ctx = 4096` → tran 4096 cho an toan
 *   (user tu tang `num_ctx` neu muon cau tra loi dai hon).
 */
export const PROVIDER_OUTPUT_CAPS: Record<ProviderId, number> = {
  mock: 4_096,
  groq: 16_384,
  openrouter: 16_384,
  gemini: 32_768,
  ollama: 4_096,
}

/**
 * So token output cua 1 luot chat.
 *
 * Thu tu uu tien: yeu cau cua client → tran cua provider → tran schema.
 * Client khong chi dinh → dung mac dinh chung.
 *
 * @param providerId - Provider se xu ly request.
 * @param requested - So token client yeu cau (co the `undefined`).
 * @returns So token output cuoi cung (>= 1).
 */
export function resolveMaxOutputTokens(
  providerId: ProviderId,
  requested?: number,
): number {
  const cap = PROVIDER_OUTPUT_CAPS[providerId] ?? OUTPUT_LIMITS.DEFAULT_MAX_OUTPUT_TOKENS
  const wanted = requested ?? OUTPUT_LIMITS.DEFAULT_MAX_OUTPUT_TOKENS
  return Math.max(1, Math.min(wanted, cap, LIMITS.MAX_OUTPUT_TOKENS))
}
