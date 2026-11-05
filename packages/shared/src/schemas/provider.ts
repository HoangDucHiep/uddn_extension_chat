/**
 * Zod schema cho provider adapter (dung chung giua server va eval).
 */

import { z } from 'zod'
import { PROVIDER_IDS } from '../constants.js'
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
