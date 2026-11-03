/**
 * Groq adapter — provider mac dinh cua Sidekick AI.
 * API kieu OpenAI: https://api.groq.com/openai/v1
 */

import { OpenAiCompatibleProvider } from './openaiCompatible.js'

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

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
  })
}
