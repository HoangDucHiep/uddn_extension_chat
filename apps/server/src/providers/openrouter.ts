/**
 * OpenRouter adapter — provider du phong.
 *
 * Dung `google/gemini-2.5-flash` de so sanh cong bang voi Chrome Gemini Sidebar
 * trong eval (cung mot model class).
 * API kieu OpenAI: https://openrouter.ai/api/v1
 */

import { OpenAiCompatibleProvider } from './openaiCompatible.js'

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

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
  })
}
