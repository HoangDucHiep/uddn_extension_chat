/**
 * Groq adapter — provider mac dinh cua Sidekick AI.
 * API kieu OpenAI: https://api.groq.com/openai/v1
 */

import { OpenAiCompatibleProvider } from './openaiCompatible.js'

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

/**
 * Tien to model cua Groq ho tro vision (FR-VISION-01 — T-M1-24).
 *
 * Model mac dinh cua Sidekick (`openai/gpt-oss-120b`) **khong** ho tro anh →
 * server bo qua provider nay khi request co anh → fallback sang
 * OpenRouter/Gemini.
 */
export const GROQ_VISION_MODEL_PREFIXES = [
  'meta-llama/llama-4-scout',
  'meta-llama/llama-4-maverick',
  'meta-llama/llama-3.2-11b-vision',
  'meta-llama/llama-3.2-90b-vision',
] as const

/** Tao provider Groq. */
export function createGroqProvider(options: {
  defaultModel: string
  preferredModels?: string[]
  timeoutMs?: number
}): OpenAiCompatibleProvider {
  return new OpenAiCompatibleProvider({
    id: 'groq',
    name: 'Groq',
    baseUrl: GROQ_BASE_URL,
    buildHeaders: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    defaultModel: options.defaultModel,
    preferredModels: options.preferredModels ?? [options.defaultModel],
    timeoutMs: options.timeoutMs ?? 120_000,
    visionModelPrefixes: [...GROQ_VISION_MODEL_PREFIXES],
  })
}
