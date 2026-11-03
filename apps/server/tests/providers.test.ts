import { describe, expect, it } from 'vitest'
import { MockProvider, estimateTokens } from '../src/providers/mock.js'
import { ProviderRegistry } from '../src/providers/registry.js'
import { resolveFromEnv, listAvailableProviders, maskKey } from '../src/providers/keyResolver.js'

describe('MockProvider', () => {
  it('stream ra nhieu token va ket thuc bang done', async () => {
    const provider = new MockProvider({ response: 'Xin chao ban', delayMs: 0 })
    const chunks = []
    for await (const chunk of provider.stream({
      model: 'mock-model',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      chunks.push(chunk)
    }

    const tokens = chunks.filter((chunk) => chunk.kind === 'token')
    const done = chunks.find((chunk) => chunk.kind === 'done')
    const usage = chunks.find((chunk) => chunk.kind === 'usage')

    expect(tokens.length).toBeGreaterThan(0)
    expect(done?.kind).toBe('done')
    expect(usage?.kind).toBe('usage')
  })

  it('ghÃ©p lai text dung', async () => {
    const provider = new MockProvider({ response: 'abc def', delayMs: 0 })
    let text = ''
    for await (const chunk of provider.stream({
      model: 'mock-model',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      if (chunk.kind === 'token') text += chunk.text ?? ''
    }
    expect(text).toBe('abc def')
  })

  it('dung signal da abort -> done finishReason aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const provider = new MockProvider({ delayMs: 0 })
    const chunks = []
    for await (const chunk of provider.stream({
      model: 'mock-model',
      messages: [{ role: 'user', content: 'hi' }],
      signal: controller.signal,
    })) {
      chunks.push(chunk)
    }
    expect(chunks[0]?.kind).toBe('done')
    expect(chunks[0]?.finishReason).toBe('aborted')
  })

  it('resolveModel tra ve model mac dinh', () => {
    expect(new MockProvider().resolveModel()).toBe('mock-model')
    expect(new MockProvider().resolveModel('custom')).toBe('custom')
  })
})

describe('estimateTokens', () => {
  it('uoc luong so token', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('a'.repeat(40))).toBe(10)
  })

  it('chuoi rong van tra ve >= 1', () => {
    expect(estimateTokens('')).toBe(1)
  })
})

describe('ProviderRegistry', () => {
  const registry = new ProviderRegistry({
    defaultProvider: 'groq',
    fallbacks: ['openrouter', 'gemini'],
    groqModel: 'openai/gpt-oss-120b',
    openRouterModel: 'google/gemini-2.5-flash',
    geminiModel: 'gemini-3.5-flash',
  })

  it('tao duoc provider theo id', () => {
    expect(registry.get('groq')).toBeDefined()
    expect(registry.get('openrouter')).toBeDefined()
    expect(registry.get('gemini')).toBeDefined()
    expect(registry.get('mock')).toBeDefined()
  })

  it('fallback chain bat dau bang provider mac dinh', () => {
    expect(registry.getFallbackChain()).toEqual(['groq', 'openrouter', 'gemini'])
  })

  it('fallbacks khong chua provider mac dinh', () => {
    expect(registry.getFallbacks()).toEqual(['openrouter', 'gemini'])
  })

  it('loai bo trung lap trong fallback chain', () => {
    const dup = new ProviderRegistry({
      defaultProvider: 'groq',
      fallbacks: ['groq', 'openrouter'],
      groqModel: 'm',
      openRouterModel: 'm',
      geminiModel: 'm',
    })
    expect(dup.getFallbackChain()).toEqual(['groq', 'openrouter'])
  })

  it('resolveModel lay model mac dinh cua provider', () => {
    expect(registry.require('groq').resolveModel()).toBe('openai/gpt-oss-120b')
    expect(registry.require('gemini').resolveModel()).toBe('gemini-3.5-flash')
  })

  it('provider that co requiresKey = true, mock = false', () => {
    expect(registry.require('groq').requiresKey).toBe(true)
    expect(registry.require('mock').requiresKey).toBe(false)
  })
})

describe('keyResolver', () => {
  it('lay key tu env (K1)', () => {
    const resolved = resolveFromEnv({ groq: 'gsk_123' }, 'groq')
    expect(resolved?.source).toBe('K1')
    expect(resolved?.apiKey).toBe('gsk_123')
  })

  it('tra undefined khi env khong co key', () => {
    expect(resolveFromEnv({}, 'groq')).toBeUndefined()
  })

  it('tra undefined khi env co chuoi rong', () => {
    expect(resolveFromEnv({ groq: '   ' }, 'groq')).toBeUndefined()
  })

  it('mock khong bao gio lay key tu env', () => {
    expect(resolveFromEnv({ groq: 'x' }, 'mock')).toBeUndefined()
  })

  it('listAvailableProviders gom mock + provider co key', () => {
    const list = listAvailableProviders({ groq: 'x' })
    expect(list).toContain('mock')
    expect(list).toContain('groq')
    expect(list).not.toContain('gemini')
  })

  it('maskKey chi lo 4 ky tu cuoi', () => {
    expect(maskKey('gsk_abcd1234')).toBe('****1234')
  })
})
