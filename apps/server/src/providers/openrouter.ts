/**
 * OpenRouter adapter — provider du phong.
 *
 * Dung `google/gemini-2.5-flash` de so sanh cong bang voi Chrome Gemini Sidebar
 * trong eval (cung mot model class).
 * API kieu OpenAI: https://openrouter.ai/api/v1
 */

import { OpenAiCompatibleProvider } from './openaiCompatible.js'

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

/**
 * Tien to model cua OpenRouter ho tro vision (FR-VISION-01 — T-M1-24).
 *
 * Model mac dinh cua Sidekick (`google/gemini-2.5-flash`) ho tro anh → OpenRouter
 * la duong fallback hop le khi request co anh.
 */
export const OPENROUTER_VISION_MODEL_PREFIXES = [
  'google/gemini',
  'google/gemma',
  'openai/gpt-4o',
  'anthropic/claude-3',
  'anthropic/claude-4',
  'meta-llama/llama-3.2',
  'qwen/qwen2-vl',
] as const

/** Tao provider OpenRouter. */
export function createOpenRouterProvider(options: {
  defaultModel: string
  preferredModels?: string[]
  timeoutMs?: number
}): OpenAiCompatibleProvider {
  return new OpenAiCompatibleProvider({
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: OPENROUTER_BASE_URL,
    buildHeaders: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
      // OpenRouter khuyen nghi dinh danh app de theo doi usage.
      'HTTP-Referer': 'https://github.com/sidekick-ai',
      'X-Title': 'Sidekick AI',
    }),
    defaultModel: options.defaultModel,
    preferredModels: options.preferredModels ?? [options.defaultModel],
    timeoutMs: options.timeoutMs ?? 120_000,
    visionModelPrefixes: [...OPENROUTER_VISION_MODEL_PREFIXES],
  })
}
