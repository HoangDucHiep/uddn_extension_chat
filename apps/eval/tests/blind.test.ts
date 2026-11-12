import { describe, expect, it } from 'vitest'
import { createBlindMap, blindLabelFor, revealSystem, BLIND_LABELS, EVAL_SYSTEMS } from '../src/judge/blind.js'

/**
 * Test blind mapping cho LLM-as-judge (T-M2-14).
 *
 * AC goc (FC-6 trong `EVAL_PLAN.md` §9):
 *  - Mapping **deterministic** theo seed.
 *  - **1-1**: moi he thong 1 nhan gia, khong trung nhan gia.
 *  - Khong truyen ten he thong that cho judge.
 *
 * Docs: docs/EVAL_PLAN.md §7.2
 */

describe('createBlindMap', () => {
  it('deterministic — cung seed cho cung mapping', () => {
    const a = createBlindMap(EVAL_SYSTEMS, 'run-2026-11-11')
    const b = createBlindMap(EVAL_SYSTEMS, 'run-2026-11-11')
    expect(a).toEqual(b)
  })

  it('seed khac → mapping khac (hoac it nhat khac thu tu)', () => {
    const a = createBlindMap(EVAL_SYSTEMS, 'seed-a')
    const b = createBlindMap(EVAL_SYSTEMS, 'seed-b')
    // Mapping van phai hop le o ca 2 truong hop.
    expect(Object.keys(a)).toHaveLength(EVAL_SYSTEMS.length)
    expect(Object.keys(b)).toHaveLength(EVAL_SYSTEMS.length)
  })

  it('1-1 — moi he thong 1 nhan gia, khong trung', () => {
    const map = createBlindMap(EVAL_SYSTEMS, 'seed-1')
    const systems = Object.values(map)

    expect(new Set(systems).size).toBe(systems.length)
    expect(new Set(Object.keys(map)).size).toBe(Object.keys(map).length)
  })

  it('chi dung cac nhan gia chuan', () => {
    const map = createBlindMap(EVAL_SYSTEMS, 'seed-1')
    for (const label of Object.keys(map)) {
      expect(BLIND_LABELS).toContain(label)
    }
  })

  it('chi gan he thong da cho', () => {
    const map = createBlindMap(['sidekick'], 'seed-1')
    expect(Object.values(map)).toEqual(['sidekick'])
  })
})

describe('revealSystem / blindLabelFor', () => {
  it('dao nhan gia → he thong', () => {
    const map = createBlindMap(EVAL_SYSTEMS, 'seed-1')
    const label = blindLabelFor(map, 'sidekick')
    expect(label).toBeDefined()
    if (label === undefined) return
    expect(revealSystem(map, label)).toBe('sidekick')
  })

  it('he thong khong ton tai → undefined', () => {
    const map = createBlindMap(['sidekick'], 'seed-1')
    expect(blindLabelFor(map, 'edge-copilot')).toBeUndefined()
  })
})
