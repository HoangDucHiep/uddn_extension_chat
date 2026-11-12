/**
 * Subcommand `report` — tong hop metric cua 1 run (T-M2-13).
 *
 * Gom diem judge + metric hieu nang → ghi JSON tong hop + in bang Markdown
 * (phan dung cho `docs/EVAL_REPORT.md` sau nay).
 *
 * Docs: docs/EVAL_PLAN.md §5, §7.1
 */

import { readFlag } from '../cliFlags.js'
import { readJudgeResults, type JudgeResult } from '../judge/run_judge.js'
import { aggregateAll, renderMarkdownTable, type ScoredRun } from '../metrics/aggregate.js'
import { readRunResults, writeJsonFile } from '../runners/ours.js'

/**
 * Chay subcommand `report` — tong hop metric.
 *
 * @param args - Tham so CLI (khong bao gom ten subcommand).
 */
export async function runReport(args: readonly string[]): Promise<void> {
  const runId = readFlag(args, '--run', '')
  const outDir = readFlag(args, '--out-dir', 'apps/eval/reports')

  if (runId.length === 0) {
    console.error('Thieu --run <run_id>.')
    process.exitCode = 1
    return
  }

  const taskResults = await readRunResults(runId)
  if (taskResults.length === 0) {
    console.error(`Khong tim thay ket qua cho run "${runId}".`)
    process.exitCode = 1
    return
  }

  // Doc diem judge neu co.
  const judgeResults = await readJudgeResults(runId)
  const judgeByKey = new Map<string, JudgeResult>()
  for (const result of judgeResults) {
    judgeByKey.set(`${result.taskId}__run${result.run}`, result)
  }

  const scored: ScoredRun[] = []
  for (const taskResult of taskResults) {
    for (const run of taskResult.runs) {
      const judgeResult = judgeByKey.get(`${taskResult.task.id}__run${run.run}`)
      scored.push({
        taskId: taskResult.task.id,
        group: taskResult.task.group,
        lang: taskResult.task.lang,
        run: run.run,
        judge: judgeResult?.judge,
        runResult: run,
      })
    }
  }

  const tasks = taskResults.map((result) => result.task)
  const { overall, byGroup, byLang, byProvider } = aggregateAll(scored, tasks)

  const payload = {
    runId,
    generatedAt: new Date().toISOString(),
    overall,
    byGroup,
    byLang,
    byProvider,
  }

  await writeJsonFile(`${outDir}/summary-${runId}.json`, payload)

  const slices = [
    { label: 'Tat ca', slice: overall },
    ...Object.entries(byGroup).map(([group, slice]) => ({ label: group, slice })),
  ]
  const markdown = renderMarkdownTable(slices, `Ket qua eval — run ${runId}`)

  console.log(markdown)
  console.log('')

  // Tach theo provider → phan biet model capability voi assistant system.
  const providerSlices = Object.entries(byProvider).map(([provider, slice]) => ({
    label: provider,
    slice,
  }))
  if (providerSlices.length > 0) {
    console.log(renderMarkdownTable(providerSlices, `Ket qua theo provider — run ${runId}`))
    console.log('')
  }

  console.log(`Da ghi ${outDir}/summary-${runId}.json`)
}
