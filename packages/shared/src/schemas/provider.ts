/**
 * Zod schema cho provider adapter (dung chung giua server va eval).
 */

import { z } from 'zod'
import { PROVIDER_IDS } from '../constants.js'
import { providerInfoSchema } from '../types/entities.js'
import { providerImageSchema } from './vision.js'

/** Do dai context cua provider. */
export const providerModelSchema = z.object({
  id: z.string().min(1),
  contextWindow: z.number().int().positive().optional(),
  inputCostPerMillion: z.number().nonnegative().optional(),
  outputCostPerMillion: z.number().nonnegative().optional(),
})
export type ProviderModel = z.infer<typeof providerModelSchema>

/** Thong tin provider cho registry. */
export const providerDescriptorSchema = z.object({
  id: z.enum(PROVIDER_IDS),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  requiresKey: z.boolean(),
  /** Danh sach model uu tien, thu tu giam dan. */
  preferredModels: z.array(z.string()),
})
export type ProviderDescriptor = z.infer<typeof providerDescriptorSchema>

/** Yeu cau stream den provider. */
export const providerStreamRequestSchema = z.object({
    model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
      /**
       * Anh cua turn (FR-VISION-01 — T-M1-24).
       *
       * Server da luu anh vao DB → day la phan server tai len tu `bytea`,
       * khong phai base64 client gui.
       */
      attachments: z.array(providerImageSchema).optional(),
    }),
  ),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  /** API key da resolve (K1/K2/K3) — truyen theo request de tránh shared mutable state. */
  apiKey: z.string().optional(),
  /**
   * Request-id de doi chieu xuyen suot client → BFF → provider (NFR-MAINT-04).
   *
   * Provider gui header `X-Request-Id` de log cua provider ghep duoc voi
   * dong `request_logs` cua Sidekick.
   */
  requestId: z.string().min(1).max(200).optional(),
  signal: z.instanceof(AbortSignal).optional(),
})
export type ProviderStreamRequest = z.infer<typeof providerStreamRequestSchema>

/** Chunk duoc provider tra ve (trước khi chuan hoa thanh SSE event). */
export const providerChunkSchema = z.object({
  kind: z.enum(['token', 'usage', 'error', 'done']),
  text: z.string().optional(),
  tokensIn: z.number().int().nonnegative().optional(),
  tokensOut: z.number().int().nonnegative().optional(),
  finishReason: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  /**
   * Loi co the thu lai khong (FR-CHAT-14 — T-M1-19).
   *
   * `undefined` → server tu suy ra tu `errorCode` (xem `classifyChatError`).
   */
  errorRetryable: z.boolean().optional(),
  /**
   * So giay cho thu lai (tu header `Retry-After` cua provider, HTTP 429).
   */
  retryAfterSeconds: z.number().int().nonnegative().optional(),
})
export type ProviderChunk = z.infer<typeof providerChunkSchema>

/** Ket qua tra ve tu keyResolver. */
export const resolvedKeySchema = z.object({
  apiKey: z.string().min(1),
  source: z.enum(['K1', 'K2', 'K3']),
  providerId: z.enum(PROVIDER_IDS),
  keyId: z.string().optional(),
})
export type ResolvedKey = z.infer<typeof resolvedKeySchema>

/**
 * Metadata cua mot API key da luu (K2).
 *
 * **KHONG** bao gio chua key goc — chi co `masked` (4 ky tu cuoi) de user
 * nhan ra key nao la key nao.
 */
export const providerKeyRecordSchema = z.object({
  id: z.string().uuid(),
  providerId: z.enum(PROVIDER_IDS),
  label: z.string(),
  /** Key da che — vi du `****abcd`. */
  masked: z.string(),
  createdAt: z.string(),
})
export type ProviderKeyRecord = z.infer<typeof providerKeyRecordSchema>

/** Ket qua kiem tra mot API key co hoat dong khong. */
export const providerKeyTestResultSchema = z.object({
  ok: z.boolean(),
  latencyMs: z.number().nonnegative(),
  /** Thong diep loi khi `ok === false`. */
  error: z.string().max(500).optional(),
})
export type ProviderKeyTestResult = z.infer<typeof providerKeyTestResultSchema>

/** Response cua `GET /api/providers`. */
export const providersResponseSchema = z.object({
  items: z.array(providerInfoSchema),
})
export type ProvidersResponse = z.infer<typeof providersResponseSchema>

/**
 * Nguon danh sach model cua 1 provider.
 *
 * - `live` — goi API `GET /models` cua provider **thanh cong** → danh sach
 *   model co that.
 * - `fallback` — provider loi (401/500/network) → dung danh sach model uu tien
 *   khai bao trong config. UI phai hieu rang danh sach nay co the cu.
 */
export const providerModelSourceSchema = z.enum(['live', 'fallback'])
export type ProviderModelSource = z.infer<typeof providerModelSourceSchema>

/**
 * Response cua `GET /api/providers/:id/models` (T-M2-02).
 *
 * Danh sach model **dong** cua 1 provider — phuc vu model picker (FR-PROVIDER-03).
 */
export const providerModelsResponseSchema = z.object({
  /** Provider ma danh sach nay thuoc ve. */
  providerId: z.enum(PROVIDER_IDS),
  /** Danh sach model (co the rong neu provider khong con model nao). */
  models: z.array(z.string()),
  /** Danh sach nay la discovery that hay fallback. */
  source: providerModelSourceSchema,
})
export type ProviderModelsResponse = z.infer<typeof providerModelsResponseSchema>

/** Response cua `GET /api/providers/keys`. */
export const providerKeyListResponseSchema = z.object({
  items: z.array(providerKeyRecordSchema),
})
export type ProviderKeyListResponse = z.infer<typeof providerKeyListResponseSchema>

/** Response cua `POST /api/providers/keys`. */
export const saveProviderKeyResponseSchema = z.object({
  id: z.string().uuid(),
  providerId: z.enum(PROVIDER_IDS),
  label: z.string(),
  masked: z.string(),
  createdAt: z.string(),
})
export type SaveProviderKeyResponse = z.infer<typeof saveProviderKeyResponseSchema>
