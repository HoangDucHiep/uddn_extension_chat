/**
 * CLI cua eval harness.
 *
 * Subcommand:
 *  - `collect` — thu thap snapshot trang that (T-M2-12).
 *  - `run`     — chay he thong cua nhom tren dataset (goi BFF `POST /api/chat`) (T-M2-13).
 *  - `judge`   — cham bang LLM-as-judge (temperature 0, blind mapping) (T-M2-14).
 *  - `report`  — tong hop metric → JSON + Markdown (T-M2-13).
 *  - `logs`    — doc `request_logs` tu BFF (T-M1-14).
 *  - (khong co subcommand) — thong ke dataset.
 *
 * moi subcommand nam trong `src/commands/<ten>.ts` → file nay chi giu phan
 * dispatch + thong ke dataset.
 *
 * Docs: docs/EVAL_PLAN.md §3, §5, §7.1
 */

import { loadDataset } from './dataset.js'
import { EVAL_RUNS_PER_TASK } from './types.js'
import { runCollect } from './commands/collect.js'
import { runOurs } from './commands/run.js'
import { runJudge } from './commands/judge.js'
import { runReport } from './commands/report.js'
import { runLogs } from './commands/logs.js'

/**
 * Chay lenh chinh cua CLI.
 *
 * @param args - Tham so CLI (khong bao gom `node` + script path).
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'collect':
      await runCollect(args.slice(1))
      return
    case 'run':
      await runOurs(args.slice(1))
      return
    case 'judge':
      await runJudge(args.slice(1))
      return
    case 'report':
      await runReport(args.slice(1))
      return
    case 'logs':
      await runLogs(args.slice(1))
      return
    default:
      break
  }

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
    `Số lần chạy mỗi task: ${EVAL_RUNS_PER_TASK} → tổng ${tasks.length * EVAL_RUNS_PER_TASK} lượt chạy mỗi hệ thống`,
  )

  if (tasks.length === 0) {
    console.warn('Dataset rỗng — cần thêm task trước khi chạy eval thật.')
  }

  console.log('')
  console.log('Lệnh khác:')
  console.log('  pnpm eval:collect            — thu thập snapshot trang thật')
  console.log('  pnpm eval:run -- run         — chạy hệ thống của nhóm')
  console.log('  pnpm eval:judge -- --run <id> — chấm LLM-as-judge')
  console.log('  pnpm eval:report -- --run <id> — tổng hợp metric')
  console.log('  pnpm eval:run logs --limit 20 — đọc request_logs từ BFF (T-M1-14)')
}

main().catch((error: unknown) => {
  console.error('Eval CLI lỗi:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
