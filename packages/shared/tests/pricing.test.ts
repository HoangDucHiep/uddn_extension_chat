import { describe, expect, it } from 'vitest'
import {
  calculateCostUsd,
  PROVIDER_PRICING,
  resolveModelPricing,
  roundTo,
} from '../src/pricing.js'

/**
 * Test cho bang gia token + tinh chi phi (T-M1-14).
 *
 * AC goc cua T-M1-14: "Moi luot chat co 1 dong log: provider, model, token,
 * cost, ttft, latency" → `cost_usd` phai **tinh duoc**, khong phai hardcode 0.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.16
 */

describe('roundTo', () => {
  it('lam tron ve so chu so thap phan yeu cau', () => {
    expect(roundTo(1.23456789, 6)).toBe(1.234568)
    expect(roundTo(1.23456789, 2)).toBe(1.23)
  })

  it('lam tron 0 khong doi', () => {
    expect(roundTo(0)).toBe(0)
  })
})

describe('resolveModelPricing', () => {
  it('tra gia rieng khi model co trong bang', () => {
    const pricing = resolveModelPricing('gemini', 'gemini-2.5-flash-lite')
    expect(pricing?.inputPerMillion).toBe(0.1)
    expect(pricing?.outputPerMillion).toBe(0.4)
  })

  it('model la → dung gia mac dinh cua provider', () => {
    const pricing = resolveModelPricing('groq', 'model-la-khong-biet')
    expect(pricing).toEqual(PROVIDER_PRICING['groq']?.default)
  })

  it('provider khong co trong bang → undefined', () => {
    expect(resolveModelPricing('provider-khong-co', 'model')).toBeUndefined()
  })
})

describe('calculateCostUsd', () => {
  it('tinh dung theo bang gia rieng cua model', () => {
    // 1M token input + 1M token output cua gemini-2.5-flash-lite
    // = 0.1 + 0.4 = 0.5 USD
    const cost = calculateCostUsd({
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      tokensIn: 1_000_000,
      tokensOut: 1_000_000,
    })
    expect(cost).toBe(0.5)
  })

  it('model la → dung gia mac dinh cua provider', () => {
    const cost = calculateCostUsd({
      provider: 'groq',
      model: 'model-la',
      tokensIn: 1_000_000,
      tokensOut: 0,
    })
    expect(cost).toBe(PROVIDER_PRICING['groq']?.default.inputPerMillion)
  })

  it('provider local (mock/ollama) → 0', () => {
    expect(
      calculateCostUsd({ provider: 'mock', model: 'mock-model', tokensIn: 999, tokensOut: 999 }),
    ).toBe(0)
    expect(
      calculateCostUsd({ provider: 'ollama', model: 'llama3.2', tokensIn: 999, tokensOut: 999 }),
    ).toBe(0)
  })

  it('provider khong co trong bang → 0 (khong gia tien thuc te)', () => {
    expect(
      calculateCostUsd({
        provider: 'provider-la',
        model: 'model',
        tokensIn: 1000,
        tokensOut: 1000,
      }),
    ).toBe(0)
  })

  it('token 0 → 0', () => {
    expect(
      calculateCostUsd({ provider: 'gemini', model: 'gemini-2.5-flash', tokensIn: 0, tokensOut: 0 }),
    ).toBe(0)
  })

  it('token am → khong tao chi phi am (clamp ve 0)', () => {
    const cost = calculateCostUsd({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      tokensIn: -100,
      tokensOut: -100,
    })
    expect(cost).toBe(0)
    expect(cost).toBeGreaterThanOrEqual(0)
  })

  it('ket qua duoc lam tron 6 chu so (khop numeric(12,6))', () => {
    const cost = calculateCostUsd({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      tokensIn: 1234,
      tokensOut: 5678,
    })
    // 1234/1e6*0.3 + 5678/1e6*2.5 = 0.0003702 + 0.014195 = 0.0145652
    expect(cost).toBe(0.014565)
    expect(String(cost).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6)
  })

  it('chi phi luon khong am', () => {
    const cost = calculateCostUsd({
      provider: 'openrouter',
      model: 'google/gemini-2.5-pro',
      tokensIn: 100,
      tokensOut: 100,
    })
    expect(cost).toBeGreaterThanOrEqual(0)
  })
})
