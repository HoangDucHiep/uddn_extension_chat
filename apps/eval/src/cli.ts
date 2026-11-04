import { loadDataset } from './dataset.js'
import { EVAL_RUNS_PER_TASK } from './types.js'

/**
 * CLI cua eval harness.
 *
 * M0: chi kiem tra dataset co load duoc va hien thi thong ke.
 * M2 se them chay that + LLM-as-judge + xuat `EVAL_REPORT.md`.
 * Docs: docs/EVAL_PLAN.md §3, §5
 */

async function main(): Promise<void> {
  const tasks = await loadDataset()
  const groups = new Map<string, number>()
  const langs = new Map<string, number>()

  for (const task of tasks) {
    groups.set(task.group, (groups.get(task.group) ?? 0) + 1)
    langs.set(task.lang, (langs.get(task.lang) ?? 0) + 1)
  }

  console.log(`Dataset: ${tasks.length} task`)
  for (const [group, count] of groups) {
    console.log(`  - ${group}: ${count}`)
  }
  for (const [lang, count] of langs) {
    console.log(`  - lang ${lang}: ${count}`)
  }
  console.log(
    `So lan chay moi task: ${EVAL_RUNS_PER_TASK} → tong ${tasks.length * EVAL_RUNS_PER_TASK} luot chay moi he thong`,
  )

  if (tasks.length === 0) {
    console.warn('Dataset rong — can them task truoc khi chay eval that.')
  }
}

main().catch((error: unknown) => {
  console.error('Eval CLI loi:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
