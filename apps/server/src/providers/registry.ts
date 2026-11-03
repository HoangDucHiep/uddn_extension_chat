/**
 * Provider registry — tao va tra cuu provider theo id.
 *
 * Fallback chain mac dinh: groq -> openrouter -> gemini.
 * Docs: docs/SYSTEM_DESIGN.md §4.4
 */

import type { ProviderId } from '@sidekick/shared'
import { createGroqProvider } from './groq.js'
import { createOpenRouterProvider } from './openrouter.js'
import { GeminiProvider } from './gemini.js'
import { MockProvider } from './mock.js'
import type { ProviderAdapter } from './types.js'

export interface RegistryConfig {
  defaultProvider: ProviderId
  fallbacks: ProviderId[]
  groqModel: string
  groqFallbackModels?: string[]
  openRouterModel: string
  openRouterFallbackModels?: string[]
  geminiModel: string
  geminiFallbackModels?: string[]
  timeoutMs?: number
}

export class ProviderRegistry {
  private readonly providers = new Map<ProviderId, ProviderAdapter>()
  private readonly fallbackChain: ProviderId[]

  constructor(config: RegistryConfig) {
    const timeoutMs = config.timeoutMs ?? 120_000

    this.providers.set('mock', new MockProvider())
    this.providers.set(
      'groq',
      createGroqProvider({
        defaultModel: config.groqModel,
        preferredModels: config.groqFallbackModels ?? [config.groqModel],
        timeoutMs,
      }),
    )
    this.providers.set(
      'openrouter',
      createOpenRouterProvider({
        defaultModel: config.openRouterModel,
        preferredModels: config.openRouterFallbackModels ?? [config.openRouterModel],
        timeoutMs,
      }),
    )
    this.providers.set(
      'gemini',
      new GeminiProvider({
        defaultModel: config.geminiModel,
        fallbackModels: config.geminiFallbackModels ?? [],
        timeoutMs,
      }),
    )

    // Fallback chain = provider mac dinh + danh sach fallback, bo trung lap.
    this.fallbackChain = [
      config.defaultProvider,
      ...config.fallbacks,
    ].filter((providerId, index, list) => list.indexOf(providerId) === index)
  }

  /** Lay provider theo id. Neu id khong ton tai -> undefined. */
  get(providerId: ProviderId): ProviderAdapter | undefined {
    return this.providers.get(providerId)
  }

  /** Lay provider theo id, nem loi neu khong co. */
  require(providerId: ProviderId): ProviderAdapter {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Khong tim thay provider "${providerId}"`)
    }
    return provider
  }

  /** Danh sach provider co san. */
  list(): ProviderAdapter[] {
    return [...this.providers.values()]
  }

  /** Chuoi fallback day du (provider mac dinh truoc). */
  getFallbackChain(): ProviderId[] {
    return [...this.fallbackChain]
  }

  /** Chuoi fallback bo provider mac dinh. */
  getFallbacks(): ProviderId[] {
    return this.fallbackChain.slice(1)
  }
}
