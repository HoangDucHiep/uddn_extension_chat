import { describe, expect, it } from 'vitest'
import { mergeTaskRuns, runEval, type TaskRun } from '../src/runners/ours.js'
import type { EvalTask } from '@sidekick/shared'

/**
 * Test ghep ket qua chay (T-M2-13 — `--merge`).
 *
 * AC:
 *  - Luot moi **thanh cong** → ghi de luot cu cung so.
 *  - Luot moi **that bai** → **giu** luot cu (da co ket qua tot).
 *  - Khong mat luot nao khi ghep.
 */

/** Tao 1 luot chay mau. */
function run(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    taskId: 'page-qa-001',
    run: 1,
    status: 'ok',
    answer: 'cau tra loi',
    latencyMs: 1_000,
    citations: [],
    startedAt: '2026-11-11T00:00:00.000Z',
    finishedAt: '2026-11-11T00:00:01.000Z',
    ...overrides,
  }
}

describe('mergeTaskRuns', () => {
  it('luot moi thanh cong ghi de luot loi cu', () => {
    const merged = mergeTaskRuns(
      [run({ status: 'error', answer: '' })],
      [run({ status: 'ok', answer: 'ket qua tot' })],
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]?.status).toBe('ok')
    expect(merged[0]?.answer).toBe('ket qua tot')
  })

  it('luot moi that bai → giu luot cu da thanh cong', () => {
    const merged = mergeTaskRuns(
      [run({ status: 'ok', answer: 'ket qua tot' })],
      [run({ status: 'error', answer: '' })],
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]?.status).toBe('ok')
    expect(merged[0]?.answer).toBe('ket qua tot')
  })

  it('khong mat luot nao khi ghep', () => {
    const merged = mergeTaskRuns(
      [run({ run: 1 }), run({ run: 2 })],
      [run({ run: 3 })],
    )

    expect(merged.map((item) => item.run)).toEqual([1, 2, 3])
  })

  it('sap xep theo so lan chay', () => {
    const merged = mergeTaskRuns([run({ run: 3 }), run({ run: 1 })], [])
    expect(merged.map((item) => item.run)).toEqual([1, 3])
  })

  it('danh sach rong → ket qua rong', () => {
    expect(mergeTaskRuns([], [])).toEqual([])
  })
})

/**
 * Task mau cho test `retryFailedOnly`.
 */
function task(): EvalTask {
  return {
    id: 'page-qa-001',
    group: 'page_qa',
    lang: 'vi',
    prompt: 'Cau hoi?',
    page: {
      url: 'https://example.com/a',
      title: 'Trang A',
      snapshot_path: '',
    },
  }
}

describe('runEval voi retryFailedOnly', () => {
  it('chi chay lai luot chay bi loi, giu nguyen luot da thanh cong', async () => {
    const existing = [
      {
        task: task(),
        runs: [
          run({ run: 1, status: 'ok', answer: 'tot' }),
          run({ run: 2, status: 'error', answer: '' }),
          run({ run: 3, status: 'error', answer: '' }),
        ],
      },
    ]

    const { results, runs } = await runEval([task()], {
      baseUrl: 'http://127.0.0.1:1',
      runs: 3,
      runId: 'test',
      dryRun: true,
      delayMs: 0,
      retryFailedOnly: true,
      existing,
    })

    // Chi 2 luot loi (run 2, 3) duoc chay lai → khong goi lai run 1.
    expect(runs.map((item) => item.run)).toEqual([2, 3])
    expect(results[0]?.runs.map((item) => item.run)).toEqual([2, 3])
  })

  it('khong co ket qua cu → chay day du', async () => {
    const { runs } = await runEval([task()], {
      baseUrl: 'http://127.0.0.1:1',
      runs: 2,
      runId: 'test',
      dryRun: true,
      delayMs: 0,
      retryFailedOnly: true,
      existing: [],
    })

    expect(runs.map((item) => item.run)).toEqual([1, 2])
  })
})
