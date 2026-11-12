/**
 * Subcommand `run` — chay he thong cua nhom tren dataset (T-M2-13).
 *
 * Docs: docs/EVAL_PLAN.md §6.1, §7.1
 */

import { randomUUID } from 'node:crypto'
import { loadDataset } from '../dataset.js'
import { EVAL_RUNS_PER_TASK } from '../types.js'
import { readBoolFlag, readFlag, readListFlag, readNumberFlag } from '../cliFlags.js'
import { readRunResults, runEval, writeRunResults, type TaskRun } from '../runners/ours.js'

/** Provider mac dinh khi do he thong cua nhom. */
export const DEFAULT_PROVIDER = 'gemini'

/** Model mac dinh khi do he thong cua nhom. */
export const DEFAULT_MODEL = 'gemini-2.5-flash'

/** Base URL cua BFF (co the override bang `--base-url`). */
export const DEFAULT_BASE_URL = process.env['SIDECKICK_BFF_URL'] ?? 'http://127.0.0.1:8787'

/**
 * Cho nghi giua 2 luot chay (ms).
 *
 * Provider free tier (Gemini) gioi han RPM → ban lien tiep 156 luot se
 * dinh `429 quota exceeded`. Cho nghi giup chay 156 luot on dinh.
 */
export const DEFAULT_DELAY_MS = 1_500

/**
 * Chay subcommand `run` — chay he thong cua nhom tren dataset.
 *
 * @param args - Tham so CLI (khong bao gom ten subcommand).
 */
export async function runOurs(args: readonly string[]): Promise<void> {
  const baseUrl = readFlag(args, '--base-url', DEFAULT_BASE_URL)
  const provider = readFlag(args, '--provider', DEFAULT_PROVIDER)
  const model = readFlag(args, '--model', DEFAULT_MODEL)
  const runs = readNumberFlag(args, '--runs') ?? EVAL_RUNS_PER_TASK
  const limit = readNumberFlag(args, '--limit')
  const group = readFlag(args, '--group', '')
  const lang = readFlag(args, '--lang', '')
  const dryRun = readBoolFlag(args, '--dry-run')
  const runId = readFlag(args, '--run-id', '')
  const merge = readBoolFlag(args, '--merge')
  const force = readBoolFlag(args, '--force')
  const delayMs = readNumberFlag(args, '--delay') ?? DEFAULT_DELAY_MS

  let tasks = await loadDataset()
  if (group.length > 0) {
    tasks = tasks.filter((task) => task.group === group)
  }
  if (lang.length > 0) {
    tasks = tasks.filter((task) => task.lang === lang)
  }

  const taskIds = readListFlag(args, '--tasks')

  if (tasks.length === 0) {
    console.warn('Không có task nào khớp bộ lọc.')
    return
  }

  const effectiveRunId =
    runId.length > 0 ? runId : `run-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 6)}`

  // Merge + chi chay luot loi → doc ket qua cu de biet luot nao da thanh cong.
  const existing = merge ? await readRunResults(effectiveRunId) : []
  const retryFailedOnly = merge && existing.length > 0 && !force

  console.log(
    `Chạy ${tasks.length} task × ${runs} lần | provider=${provider} model=${model} | run_id=${effectiveRunId}`,
  )
  if (retryFailedOnly) {
    console.log('Chế độ retry: chỉ chạy lại các lượt chạy bị lỗi trước đó.')
  }
  if (force) {
    console.log('Chế độ force: chạy lại TẤT CẢ lượt chạy (kể cả lượt đã thành công).')
  }

  const { results, runs: allRuns } = await runEval(tasks, {
    baseUrl,
    provider,
    model,
    runs,
    runId: effectiveRunId,
    ...(taskIds !== undefined ? { taskIds } : {}),
    ...(limit !== undefined ? { limit } : {}),
    delayMs,
    dryRun,
    ...(merge ? { retryFailedOnly: true, existing } : {}),
    ...(force ? { force: true } : {}),
  })

  if (!dryRun) {
    const dir = await writeRunResults(effectiveRunId, results, merge)
    console.log('')
    console.log(`Kết quả: ${dir}`)
    if (merge) {
      console.log('Chế độ merge: lượt mới thành công đã ghi đè lượt lỗi cũ.')
    }
  }

  printRunSummary(allRuns)
}

/**
 * In tom tat cac luot chay.
 *
 * @param runs - Danh sach luot chay.
 */
function printRunSummary(runs: readonly TaskRun[]): void {
  const errors = runs.filter((run) => run.status === 'error')
  const ttfts = runs
    .map((run) => run.ttftMs)
    .filter((value): value is number => value !== undefined)
  const latencies = runs
    .map((run) => run.latencyMs)
    .filter((value): value is number => value !== undefined)
  const cost = runs.reduce((sum, run) => sum + (run.costUsd ?? 0), 0)

  console.log('')
  console.log(`Tổng hợp: ${runs.length} lượt chạy, ${errors.length} lỗi`)
  console.log(`  - TTFT TB: ${average(ttfts)} ms`)
  console.log(`  - Latency TB: ${average(latencies)} ms`)
  console.log(`  - Chi phi: $${cost.toFixed(6)}`)
}

/**
 * Trung binh 1 day so (lam tron).
 *
 * @param values - Day so.
 */
function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}
