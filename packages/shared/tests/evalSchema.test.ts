import { describe, expect, it } from 'vitest'
import {
  EVAL_ASSET_KINDS,
  EVAL_CONTEXT_MODES,
  EVAL_GROUPS,
  evalAssetSchema,
  evalContextModeSchema,
  evalJudgeResultSchema,
  evalTaskSchema,
} from '../src/schemas/eval.js'

/**
 * Test contract eval mo rong (T-M2-12 / T-M2-14).
 *
 * AC goc:
 *  - Truong moi (`pages` · `assets` · `context_mode`) la **optional** →
 *    dataset M1 (chi `page`) van hop le.
 *  - `context_mode` chi nhan 3 gia tri hop le.
 *  - `evalJudgeResultSchema` khop **chinh xac** output schema §4.3 cua
 *    `EVAL_PLAN.md` → reject diem ngoai 1–5.
 *
 * Docs: docs/EVAL_PLAN.md §3.1, §4.3
 */

/** Task hop le toi thieu (shape M1). */
const MINIMAL_TASK = {
  id: 'page-qa-001',
  group: 'page_qa',
  lang: 'vi',
  page: {
    url: 'https://example.com/article',
    title: 'Bai viet mau',
    snapshot_path: 'eval/snapshots/article.txt',
    content_hash: 'sha256:abc123',
  },
  prompt: 'Tom tat bai nay.',
} as const

describe('eval contract — truong moi (T-M2-12)', () => {
  it('task M1 van hop le (khong co truong moi)', () => {
    const result = evalTaskSchema.safeParse(MINIMAL_TASK)
    expect(result.success).toBe(true)
  })

  it('EVAL_CONTEXT_MODES chi co 3 gia tri', () => {
    expect([...EVAL_CONTEXT_MODES]).toEqual(['none', 'page', 'pages'])
  })

  it('context_mode reject gia tri la', () => {
    const result = evalTaskSchema.safeParse({ ...MINIMAL_TASK, context_mode: 'auto' })
    expect(result.success).toBe(false)
  })

  it('context_mode = none hop le (nhom general_qa)', () => {
    const result = evalTaskSchema.safeParse({ ...MINIMAL_TASK, context_mode: 'none' })
    expect(result.success).toBe(true)
    expect(result.data?.context_mode).toBe('none')
  })

  it('pages[] hop le — nhom cross_tab', () => {
    const result = evalTaskSchema.safeParse({
      ...MINIMAL_TASK,
      group: 'cross_tab',
      context_mode: 'pages',
      pages: [
        {
          url: 'https://example.com/b',
          title: 'Trang B',
          snapshot_path: 'eval/snapshots/b.txt',
          content_hash: 'sha256:def456',
        },
      ],
    })
    expect(result.success).toBe(true)
    expect(result.data?.pages).toHaveLength(1)
  })

  it('pages[] reject khi thieu snapshot_path', () => {
    const result = evalTaskSchema.safeParse({
      ...MINIMAL_TASK,
      pages: [{ url: 'https://example.com/b', title: 'B', content_hash: 'sha256:def' }],
    })
    expect(result.success).toBe(false)
  })

  it('EVAL_ASSET_KINDS chi co image + pdf', () => {
    expect([...EVAL_ASSET_KINDS]).toEqual(['image', 'pdf'])
  })

  it('assets[] hop le — nhom vision', () => {
    const result = evalTaskSchema.safeParse({
      ...MINIMAL_TASK,
      group: 'vision',
      assets: [
        {
          kind: 'image',
          path: 'eval/assets/chart.png',
          mime_type: 'image/png',
          bytes: 12_345,
        },
      ],
    })
    expect(result.success).toBe(true)
    expect(result.data?.assets?.[0]?.kind).toBe('image')
  })

  it('assets[] reject kind la', () => {
    const result = evalAssetSchema.safeParse({
      kind: 'video',
      path: 'eval/assets/x.mp4',
      mime_type: 'video/mp4',
      bytes: 100,
    })
    expect(result.success).toBe(false)
  })

  it('assets[] reject bytes am', () => {
    const result = evalAssetSchema.safeParse({
      kind: 'image',
      path: 'eval/assets/x.png',
      mime_type: 'image/png',
      bytes: -1,
    })
    expect(result.success).toBe(false)
  })

  it('contextModeSchema parse dung 3 gia tri', () => {
    for (const mode of EVAL_CONTEXT_MODES) {
      expect(evalContextModeSchema.safeParse(mode).success).toBe(true)
    }
  })
})

describe('eval contract — judge result (T-M2-14)', () => {
  const VALID_JUDGE = {
    scores: { R1: 5, R2: 4, R3: 3, R4: 5, R5: 4, R7: 5 },
    missing_key_points: ['mot ý'],
    hallucinated_claims: [],
    citation_check: { cited: 2, verified: 2 },
    reasoning: 'Cau tra loi bam nguon.',
  }

  it('accept payload day du', () => {
    const result = evalJudgeResultSchema.safeParse(VALID_JUDGE)
    expect(result.success).toBe(true)
  })

  it('fill default cho truong optional', () => {
    const result = evalJudgeResultSchema.safeParse({ scores: VALID_JUDGE.scores })
    expect(result.success).toBe(true)
    expect(result.data?.missing_key_points).toEqual([])
    expect(result.data?.citation_check).toEqual({ cited: 0, verified: 0 })
    expect(result.data?.reasoning).toBe('')
  })

  it('clamp diem > 5 ve 5 (thay vi reject toan bo ket qua)', () => {
    const result = evalJudgeResultSchema.safeParse({
      ...VALID_JUDGE,
      scores: { ...VALID_JUDGE.scores, R1: 6 },
    })
    expect(result.success).toBe(true)
    expect(result.data?.scores.R1).toBe(5)
  })

  it('clamp diem 0 ve 1 (judge tra 0 cho tieu chi "khong ap dung")', () => {
    const result = evalJudgeResultSchema.safeParse({
      ...VALID_JUDGE,
      scores: { ...VALID_JUDGE.scores, R5: 0 },
    })
    expect(result.success).toBe(true)
    expect(result.data?.scores.R5).toBe(1)
  })

  it('diem khong phai so → mac dinh 1 thay vi reject', () => {
    const result = evalJudgeResultSchema.safeParse({
      ...VALID_JUDGE,
      scores: { ...VALID_JUDGE.scores, R3: 'high' },
    })
    expect(result.success).toBe(true)
    expect(result.data?.scores.R3).toBe(1)
  })

  it('reject khi thieu 1 tieu chi (R6 / R8 khong do judge)', () => {
    const result = evalJudgeResultSchema.safeParse({
      scores: { R1: 4, R2: 4, R3: 4, R4: 4, R5: 4 },
    })
    expect(result.success).toBe(false)
  })

  it('EVAL_GROUPS giu nguyen 8 nhom', () => {
    expect(EVAL_GROUPS).toHaveLength(8)
  })
})
