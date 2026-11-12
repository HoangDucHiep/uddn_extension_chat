/**
 * Subcommand `judge` — cham LLM-as-judge (T-M2-14).
 *
 * Blind mapping (FC-6): judge chi nhan nhan gia `system_A/B/C`, khong biet
 * ten he thong that.
 *
 * Docs: docs/EVAL_PLAN.md §4.3, §6.2, §7.1
 */

import { readSnapshot } from '../snapshot.js'
import { readBoolFlag, readFlag, readNumberFlag } from '../cliFlags.js'
import { readRunResults } from '../runners/ours.js'
import { createBlindMap, type BlindLabel, type BlindMap, type EvalSystem } from '../judge/blind.js'
import { judgeOnce, readJudgeResults, writeBlindMap, writeJudgeResults, type JudgeResult } from '../judge/run_judge.js'
import { DEFAULT_BASE_URL, DEFAULT_DELAY_MS, DEFAULT_MODEL, DEFAULT_PROVIDER } from './run.js'

/**
 * Chay subcommand `judge` — cham LLM-as-judge.
 *
 * @param args - Tham so CLI (khong bao gom ten subcommand).
 */
export async function runJudge(args: readonly string[]): Promise<void> {
  const baseUrl = readFlag(args, '--base-url', DEFAULT_BASE_URL)
  const runId = readFlag(args, '--run', '')
  const provider = readFlag(args, '--judge-provider', DEFAULT_PROVIDER)
  const model = readFlag(args, '--judge-model', DEFAULT_MODEL)
  const limit = readNumberFlag(args, '--limit')
  const dryRun = readBoolFlag(args, '--dry-run')
  const seed = readFlag(args, '--seed', runId)
  const delayMs = readNumberFlag(args, '--delay') ?? DEFAULT_DELAY_MS

  if (runId.length === 0) {
    console.error('Thiếu --run <run_id>.')
    process.exitCode = 1
    return
  }

  const taskResults = await readRunResults(runId)
  if (taskResults.length === 0) {
    console.error(`Không tìm thấy kết quả cho run "${runId}".`)
    process.exitCode = 1
    return
  }

  const systems: EvalSystem[] = ['sidekick']
  const map: BlindMap = createBlindMap(systems, seed.length > 0 ? seed : runId)

  const blindMapPath = await writeBlindMap(runId, map)
  console.log(`Blind map: ${blindMapPath}`)

  // Luot da cham **thanh cong** → giu nguyen (tiet kiem quota provider).
  const existing = await readJudgeResults(runId)
  const done = new Set(
    existing
      .filter((item) => item.status === 'ok')
      .map((item) => `${item.taskId}__${item.label}__run${item.run}`),
  )
  if (done.size > 0) {
    console.log(`Chấm lại: ${done.size} lượt đã chấm xong sẽ bỏ qua.`)
  }

  const results: JudgeResult[] = []
  let count = 0

  for (const taskResult of taskResults) {
    const label = findLabelFor(map, 'sidekick')
    if (label === undefined) continue

    for (const run of taskResult.runs) {
      if (limit !== undefined && count >= limit) break

      // Luot chay da **that bai** (provider loi) → khong cham (khong co cau loi).
      if (run.status !== 'ok') continue

      if (done.has(`${taskResult.task.id}__${label}__run${run.run}`)) continue

      // Lay source material tu snapshot (ground truth cho judge).
      const sourceMaterial = await readSourceMaterial(taskResult.task)

      const judgeResult = await judgeOnce(
        taskResult.task,
        run.answer,
        sourceMaterial,
        label,
        'sidekick',
        run.run,
        { baseUrl, runId, provider, model, dryRun, delayMs },
        run.citations,
      )
      results.push(judgeResult)
      count += 1

      const status = judgeResult.status === 'ok' ? 'OK' : 'ERR'
      console.log(`  [${status}] ${judgeResult.taskId} run${run.run}`)

      // Cho provider "nghỉ" giữa 2 lượt chấm → tránh vượt RPM free tier.
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    if (limit !== undefined && count >= limit) break
  }

  if (!dryRun) {
    const dir = await writeJudgeResults(runId, results)
    console.log('')
    console.log(`Kết quả judge: ${dir}`)
  }

  const ok = results.filter((result) => result.status === 'ok').length
  console.log(`Chấm xong: ${ok}/${results.length} lượt chạy.`)
}

/**
 * Tim nhan gia blind cua 1 he thong.
 *
 * @param map - Blind map.
 * @param system - He thong can tim.
 */
function findLabelFor(map: BlindMap, system: EvalSystem): BlindLabel | undefined {
  const entry = (Object.entries(map) as Array<[BlindLabel, EvalSystem]>).find(
    ([, value]) => value === system,
  )
  return entry?.[0]
}

/**
 * Doc source material (snapshot) cua 1 task.
 *
 * Task `context_mode: 'none'` (nhom `general_qa`) **khong** co tai lieu →
 * source material rong → judge **khong** co gi de doi chieu → phai noi
 * ro cho judge (xem `buildJudgeUserMessage`) de no **khong** cham "hallucination"
 * cho nhung noi dung dung ban chat thuan LLM (FC-12).
 *
 * @param task - Task can doc.
 */
async function readSourceMaterial(task: {
  context_mode?: string | undefined
  page: { snapshot_path: string }
  pages?: Array<{ snapshot_path: string }> | undefined
}): Promise<string> {
  if (task.context_mode === 'none') return ''

  const paths = [task.page.snapshot_path, ...(task.pages ?? []).map((page) => page.snapshot_path)]
  const parts: string[] = []

  for (const path of paths) {
    if (path.length === 0) continue
    try {
      parts.push(await readSnapshot(path))
    } catch {
      // Snapshot khong doc duoc → bo qua phan nay.
    }
  }

  return parts.join('\n\n---\n\n')
}
