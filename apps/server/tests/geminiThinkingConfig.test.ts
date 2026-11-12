import { describe, expect, it } from 'vitest'
import { thinkingConfigFor } from '../src/providers/gemini.js'

/**
 * Test cho `thinkingConfigFor` (T-M2-14 — fix do live eval phat hien).
 *
 * Bug 1: adapter gui `thinkingConfig: { thinkingBudget: 0 }` cho **moi** model
 * Gemini → model khong ho tro thinking (vi du `gemini-flash-lite-latest`) tra
 * `400 INVALID_ARGUMENT` → ca luot chat that bai (fallback sang provider khac).
 *
 * Bug 2: `thinkingConfig` bi **flatten** truc tiep vao `generationConfig`
 * (`{ generationConfig: { thinkingBudget: 0 } }`) thay vi **nested**
 * (`{ generationConfig: { thinkingConfig: { thinkingBudget: 0 } } }`) → Google
 * tra `400 INVALID_ARGUMENT` ("Unknown name thinkingBudget at
 * 'generation_config'") cho **moi** model Gemini (ke ca model co thinking).
 */

describe('thinkingConfigFor', () => {
  it('model co thinking → tat thinking (thinkingBudget 0)', () => {
    expect(thinkingConfigFor('gemini-2.5-flash')).toEqual({ thinkingBudget: 0 })
    expect(thinkingConfigFor('gemini-3.5-flash')).toEqual({ thinkingBudget: 0 })
    expect(thinkingConfigFor('gemini-3.6-flash')).toEqual({ thinkingBudget: 0 })
  })

  it('model khong ho tro thinking (lite) → KHONG gui field', () => {
    expect(thinkingConfigFor('gemini-flash-lite-latest')).toEqual({})
    expect(thinkingConfigFor('gemini-3.5-flash-lite')).toEqual({})
  })

  it('thinkingConfig phai NESTED trong generationConfig (khong flatten)', () => {
    for (const model of ['gemini-flash-lite-latest', 'gemini-3.5-flash']) {
      const thinking = thinkingConfigFor(model)

      // Sai (flatten) → Google 400 "Unknown name thinkingBudget".
      const flattened = {
        temperature: 0,
        ...thinking,
      }
      expect(Object.keys(flattened).sort()).toEqual(
        model.includes('lite') ? ['temperature'] : ['temperature', 'thinkingBudget'],
      )

      // Dung (nested) → `thinkingConfig` la 1 field con cua `generationConfig`.
      const nested = {
        temperature: 0,
        ...(Object.keys(thinking).length > 0 ? { thinkingConfig: thinking } : {}),
      }
      expect(Object.keys(nested).sort()).toEqual(
        model.includes('lite') ? ['temperature'] : ['temperature', 'thinkingConfig'],
      )
      expect(nested).not.toHaveProperty('thinkingBudget')
    }
  })

  it('model lite → generationConfig khong co field thinkingConfig nao', () => {
    const thinking = thinkingConfigFor('gemini-flash-lite-latest')
    const generationConfig = {
      temperature: 0,
      ...(Object.keys(thinking).length > 0 ? { thinkingConfig: thinking } : {}),
    }
    expect(generationConfig).toEqual({ temperature: 0 })
  })
})
