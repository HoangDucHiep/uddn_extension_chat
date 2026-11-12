import { describe, expect, it } from 'vitest'
import type { EvalJudgeResult, EvalTask } from '@sidekick/shared'
import {
  aggregateAll,
  aggregateRuns,
  computeOverallScore,
  isCorrectTask,
  percentile,
  type ScoredRun,
} from '../src/metrics/aggregate.js'

/**
 * Test metrics aggregator (T-M2-13).
 *
 * AC goc:
 *  - p50/p95 dung **nearest-rank**.
 *  - `overallScore` 0–100 co trong so rubric theo nhom.
 *  - Luot **khong** co diem judge → khong tinh vao `overallScore`.
 *  - Chi phi/task + chi phi/task-dat-chuan.
 *
 * Docs: docs/EVAL_PLAN.md §5
 */

/** Diem judge mau (R1..R5, R7 deu 5). */
function judge(overrides: Partial<EvalJudgeResult> = {}): EvalJudgeResult {
  return {
    scores: { R1: 5, R2: 5, R3: 5, R4: 5, R5: 5, R7: 5 },
    missing_key_points: [],
    hallucinated_claims: [],
    citation_check: { cited: 2, verified: 2 },
    reasoning: '',
    ...overrides,
  }
}

/** Luot chay mau. */
function scoredRun(overrides: Partial<ScoredRun> = {}): ScoredRun {
  return {
    taskId: 'page-qa-001',
    group: 'page_qa',
    lang: 'vi',
    run: 1,
    judge: judge(),
    runResult: {
      taskId: 'page-qa-001',
      run: 1,
      status: 'ok',
      answer: 'cau tra loi',
      latencyMs: 1_000,
      ttftMs: 200,
      tokensIn: 100,
      tokensOut: 50,
      costUsd: 0.001,
      citations: [{ index: 1, url: 'https://example.com', title: 'T', snippet: 's' }],
      startedAt: '2026-11-11T00:00:00.000Z',
      finishedAt: '2026-11-11T00:00:01.000Z',
    },
    ...overrides,
  }
}

/** Task mau. */
function task(overrides: Partial<EvalTask> = {}): EvalTask {
  return {
    id: 'page-qa-001',
    group: 'page_qa',
    lang: 'vi',
    page: {
      url: 'https://example.com',
      title: 'T',
      snapshot_path: 'apps/eval/dataset/snapshots/x.txt',
      content_hash: 'sha256:abc',
    },
    prompt: 'Hoi?',
    expected_citations: 1,
    ...overrides,
  }
}

describe('percentile', () => {
  it('tra undefined khi rong', () => {
    expect(percentile([], 0.5)).toBeUndefined()
  })

  it('p50 cua 1 phan tu', () => {
    expect(percentile([42], 0.5)).toBe(42)
  })

  it('p50 nearest-rank', () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(20)
  })

  it('p95 nearest-rank', () => {
    expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.95)).toBe(100)
  })

  it('p95 cua 4 gia tri → gia tri lon nhat', () => {
    expect(percentile([1, 2, 3, 4], 0.95)).toBe(4)
  })
})

describe('computeOverallScore', () => {
  it('diem 5 o moi tieu chi → 100', () => {
    expect(computeOverallScore(judge(), 'page_qa')).toBe(100)
  })

  it('diem 1 o moi tieu chi → 0', () => {
    const low = judge({
      scores: { R1: 1, R2: 1, R3: 1, R4: 1, R5: 1, R7: 1 },
    })
    expect(computeOverallScore(low, 'page_qa')).toBe(0)
  })

  it('diem 3 → 50', () => {
    const mid = judge({
      scores: { R1: 3, R2: 3, R3: 3, R4: 3, R5: 3, R7: 3 },
    })
    expect(computeOverallScore(mid, 'page_qa')).toBe(50)
  })

  it('khong vuot qua 100', () => {
    expect(computeOverallScore(judge(), 'writing')).toBeLessThanOrEqual(100)
  })
})

describe('isCorrectTask', () => {
  it('R1/R2/R3 deu >= 4 → true', () => {
    expect(isCorrectTask(judge())).toBe(true)
  })

  it('R3 = 3 → false', () => {
    const result = judge({ scores: { R1: 5, R2: 5, R3: 3, R4: 5, R5: 5, R7: 5 } })
    expect(isCorrectTask(result)).toBe(false)
  })

  it('undefined → false', () => {
    expect(isCorrectTask(undefined)).toBe(false)
  })
})

describe('aggregateRuns', () => {
  it('tinh p50/p95 TTFT va latency', () => {
    const runs = [
      scoredRun({ runResult: { ...scoredRun().runResult, ttftMs: 100, latencyMs: 500 } }),
      scoredRun({ runResult: { ...scoredRun().runResult, ttftMs: 200, latencyMs: 1_500 } }),
      scoredRun({ runResult: { ...scoredRun().runResult, ttftMs: 300, latencyMs: 2_500 } }),
    ]
    const slice = aggregateRuns(runs)

    expect(slice.ttftP50).toBe(200)
    expect(slice.ttftP95).toBe(300)
    expect(slice.latencyP50).toBe(1_500)
    expect(slice.latencyP95).toBe(2_500)
  })

  it('luot khong co diem judge → khong tinh vao overallScore', () => {
    const slice = aggregateRuns([scoredRun({ judge: undefined })])
    expect(slice.scoredRuns).toBe(0)
    expect(slice.overallScore).toBeUndefined()
  })

  it('task success rate dem theo R1/R2/R3', () => {
    const runs = [
      scoredRun(),
      scoredRun({ run: 2, judge: judge({ scores: { R1: 5, R2: 5, R3: 2, R4: 5, R5: 5, R7: 5 } }) }),
    ]
    const slice = aggregateRuns(runs)
    expect(slice.taskSuccessRate).toBe(50)
  })

  it('citation recall = min(actual, expected) / expected', () => {
    const slice = aggregateRuns([scoredRun()], [task({ expected_citations: 1 })])
    expect(slice.citationRecall).toBe(100)
  })

  it('citation recall < 100 khi thieu trich dan', () => {
    const run = scoredRun({
      runResult: { ...scoredRun().runResult, citations: [] },
    })
    const slice = aggregateRuns([run], [task({ expected_citations: 2 })])
    expect(slice.citationRecall).toBe(0)
  })

  it('cost/task = tong cost / so task', () => {
    const slice = aggregateRuns([scoredRun(), scoredRun({ run: 2 })], [task()])
    expect(slice.costUsd).toBeCloseTo(0.002, 6)
    expect(slice.costPerTask).toBeCloseTo(0.002, 6)
  })

  it('cost per correct task chi tinh khi co task dat chuan', () => {
    const slice = aggregateRuns([scoredRun()], [task()])
    expect(slice.costPerCorrectTask).toBeCloseTo(0.001, 6)
  })

  it('khong co task dat chuan → costPerCorrectTask undefined', () => {
    const run = scoredRun({
      judge: judge({ scores: { R1: 2, R2: 2, R3: 2, R4: 2, R5: 2, R7: 2 } }),
    })
    const slice = aggregateRuns([run], [task()])
    expect(slice.costPerCorrectTask).toBeUndefined()
  })

  it('dem loi tach rieng', () => {
    const run = scoredRun({
      runResult: { ...scoredRun().runResult, status: 'error' },
    })
    expect(aggregateRuns([run]).errors).toBe(1)
  })

  it('hallucination rate tinh tu judge', () => {
    const run = scoredRun({
      judge: judge({
        hallucinated_claims: ['a sai', 'b sai'],
        citation_check: { cited: 2, verified: 2 },
      }),
    })
    // totalClaims = cited(2) + missing(0) + hallucinated(2) = 4 → 2/4 = 50%
    expect(aggregateRuns([run]).hallucinationRate).toBe(50)
  })
})

describe('aggregateAll', () => {
  it('tach theo nhom va theo ngon ngu', () => {
    const runs = [
      scoredRun({ taskId: 'a', group: 'page_qa', lang: 'vi' }),
      scoredRun({ taskId: 'b', group: 'writing', lang: 'en' }),
    ]
    const { overall, byGroup, byLang } = aggregateAll(runs, [task(), task({ id: 'b' })])

    expect(overall.runs).toBe(2)
    expect(Object.keys(byGroup).sort()).toEqual(['page_qa', 'writing'])
    expect(Object.keys(byLang).sort()).toEqual(['en', 'vi'])
    expect(byGroup['page_qa']?.runs).toBe(1)
    expect(byLang['en']?.runs).toBe(1)
  })
})
