import { describe, expect, it } from 'vitest'
import {
  applyContextBudget,
  CONTEXT_SAFETY_MARGIN_TOKENS,
  LIMITS,
  OUTPUT_LIMITS,
  PROVIDER_OUTPUT_CAPS,
  resolveMaxOutputTokens,
} from '../src/index.js'

/**
 * Test gioi han do dai output (FR-CHAT-15 — T-M2-24).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.30
 */

describe('resolveMaxOutputTokens', () => {
  it('khong chi dinh → dung mac dinh chung', () => {
    for (const provider of Object.keys(PROVIDER_OUTPUT_CAPS) as Array<
      keyof typeof PROVIDER_OUTPUT_CAPS
    >) {
      const resolved = resolveMaxOutputTokens(provider)
      expect(resolved).toBeGreaterThan(0)
      expect(resolved).toBeLessThanOrEqual(OUTPUT_LIMITS.DEFAULT_MAX_OUTPUT_TOKENS)
    }
  })

  it('mac dinh chung la 8192 (nang tu 2048)', () => {
    expect(OUTPUT_LIMITS.DEFAULT_MAX_OUTPUT_TOKENS).toBe(8_192)
  })

  it('client chi dinh gia tri nho hon cap → dung gia tri do', () => {
    expect(resolveMaxOutputTokens('gemini', 1_000)).toBe(1_000)
  })

  it('client chi dinh gia tri lon hon cap cua provider → bi clamp', () => {
    expect(resolveMaxOutputTokens('mock', 32_768)).toBe(PROVIDER_OUTPUT_CAPS.mock)
    expect(resolveMaxOutputTokens('ollama', 32_768)).toBe(PROVIDER_OUTPUT_CAPS.ollama)
  })

  it('client chi dinh gia tri lon hon tran schema → bi clamp ve tran schema', () => {
    const resolved = resolveMaxOutputTokens('gemini', LIMITS.MAX_OUTPUT_TOKENS + 10_000)
    expect(resolved).toBe(LIMITS.MAX_OUTPUT_TOKENS)
  })

  it('gia tri khong hop le → tra >= 1', () => {
    expect(resolveMaxOutputTokens('gemini', 0)).toBe(1)
    expect(resolveMaxOutputTokens('gemini', -5)).toBe(1)
  })

  it('moi provider deu co cap rieng', () => {
    expect(PROVIDER_OUTPUT_CAPS.gemini).toBeGreaterThan(PROVIDER_OUTPUT_CAPS.groq)
    expect(PROVIDER_OUTPUT_CAPS.groq).toBeGreaterThan(PROVIDER_OUTPUT_CAPS.ollama)
  })
})

describe('applyContextBudget — clamp reservedOutputTokens (T-M2-24)', () => {
  it('reservedOutputTokens vuot qua context window → ngan sach khong am', () => {
    const result = applyContextBudget(
      [{ id: 'a', kind: 'tab', tier: 'attachment', title: 'T', text: 'x'.repeat(100) }],
      { contextWindow: 8_000, reservedOutputTokens: 32_768 },
    )

    expect(result.maxTokens).toBeGreaterThanOrEqual(0)
    expect(result.historyBudget).toBeGreaterThanOrEqual(0)
  })

  it('reservedOutputTokens hop le → ngan sach = window - reserved - margin', () => {
    const result = applyContextBudget([], {
      contextWindow: 32_000,
      reservedOutputTokens: 8_192,
    })

    expect(result.maxTokens).toBe(32_000 - 8_192 - CONTEXT_SAFETY_MARGIN_TOKENS)
  })

  it('context window mock du chua cho output mac dinh + context', () => {
    const result = applyContextBudget(
      [{ id: 'a', kind: 'tab', tier: 'attachment', title: 'T', text: 'x'.repeat(4_000) }],
      {
        contextWindow: 32_000,
        reservedOutputTokens: OUTPUT_LIMITS.DEFAULT_MAX_OUTPUT_TOKENS,
      },
    )

    // Context van con nhieu token sau khi cat.
    expect(result.maxTokens).toBeGreaterThan(0)
    expect(result.usedTokens).toBeGreaterThan(0)
  })
})
