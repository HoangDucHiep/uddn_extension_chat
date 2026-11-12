/**
 * Kieu du lieu + noi luu ket qua **judge** (T-M2-13/T-M2-14).
 *
 * Tách riêng khỏi `src/judge/run_judge.ts` để subcommand `report`
 * (T-M2-13) đọc được điểm judge mà **không** phụ thuộc module judge
 * (T-M2-14) → mỗi commit build độc lập.
 *
 * Docs: docs/EVAL_PLAN.md §4.3, §6.2
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { EvalJudgeResult } from '@sidekick/shared'

/** Thu muc goc cua repo. */
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..')

/** Ket qua cham cua 1 luot chay. */
export interface JudgeResult {
  /** Id cua task. */
  taskId: string
  /** Nhan gia (blind) — `system_A` · `system_B` · `system_C`. */
  label: string
  /** He thong that (chi ghi sau khi cham xong — de doi chieu). */
  system: string
  /** So lan chay. */
  run: number
  /** Trang thai: `ok` | `judge_error`. */
  status: 'ok' | 'judge_error'
  /** Diem rubric (neu parse thanh cong). */
  judge?: EvalJudgeResult
  /** Loi (neu co). */
  error?: string
  /** Provider / model judge dung. */
  provider?: string
  model?: string
  /** Token tieu thu cua luot cham. */
  tokensIn?: number
  tokensOut?: number
  /** Chi phi cua luot cham (USD). */
  costUsd?: number
}

/**
 * Ghi ket qua judge vao `apps/eval/results/judged/<run_id>/`.
 *
 * @param runId - Id cua run.
 * @param results - Ket qua cham.
 */
export async function writeJudgeResults(
  runId: string,
  results: readonly JudgeResult[],
): Promise<string> {
  const dir = resolve(REPO_ROOT, 'apps/eval/results/judged', runId)
  await mkdir(dir, { recursive: true })

  for (const result of results) {
    const path = resolve(dir, `${result.taskId}__${result.label}__run${result.run}.json`)
    await writeFile(path, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  }

  return dir
}

/**
 * Doc ket qua judge da cham tu dia chi.
 *
 * File hong → bo qua (khong lam fail toan bo lenh report).
 *
 * @param runId - Id cua run.
 */
export async function readJudgeResults(runId: string): Promise<JudgeResult[]> {
  const dir = resolve(REPO_ROOT, 'apps/eval/results/judged', runId)

  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return []
  }

  const results: JudgeResult[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const raw = await readFile(resolve(dir, file), 'utf8')
      results.push(JSON.parse(raw) as JudgeResult)
    } catch {
      // File hong → bo qua.
    }
  }
  return results
}

/**
 * Ghi 1 file JSON (dung chung cho judge + report).
 *
 * @param relativePath - Duong dan tuong doi repo root.
 * @param payload - Noi dung can ghi.
 */
export async function writeJsonFile(relativePath: string, payload: unknown): Promise<void> {
  const absolute = resolve(REPO_ROOT, relativePath)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}
