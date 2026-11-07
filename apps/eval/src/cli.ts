import { loadDataset } from './dataset.js'
import { fetchLogs, fetchUsage, summarizeLogs } from './logs.js'
import { EVAL_RUNS_PER_TASK } from './types.js'

/**
 * CLI cua eval harness.
 *
 * M0: chi kiem tra dataset co load duoc va hien thi thong ke.
 * M2 se them chay that + LLM-as-judge + xuat `EVAL_REPORT.md`.
 *
 * T-M1-14 them subcommand `logs` — doc `request_logs` tu BFF de lay so
 * lieu chi phi / token / ttft / latency cua cac luot chat da chay.
 *
 * Docs: docs/EVAL_PLAN.md §3, §5
 */

/** Base URL cua BFF (co the override bang `--base-url`). */
const DEFAULT_BASE_URL = process.env['SIDECKICK_BFF_URL'] ?? 'http://127.0.0.1:8787'

/**
 * Lay gia tri 1 flag tu argv.
 *
 * @param args - Tham so CLI.
 * @param name - Ten flag (vd `--base-url`).
 * @param fallback - Gia tri mac dinh khi khong co flag.
 */
function readFlag(args: readonly string[], name: string, fallback: string): string {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

/**
 * Chay subcommand `logs` — in cac dong log gan nhat + tong hop usage.
 */
async function runLogs(args: readonly string[]): Promise<void> {
  const baseUrl = readFlag(args, '--base-url', DEFAULT_BASE_URL)
  const limit = Number(readFlag(args, '--limit', '20'))
  const provider = readFlag(args, '--provider', '')

  const logs = await fetchLogs(baseUrl, {
    limit: Number.isFinite(limit) ? limit : 20,
    ...(provider.length > 0 ? { provider } : {}),
  })

  console.log(`BFF: ${baseUrl}`)
  console.log(`Tong so dong khop bo loc: ${logs.total}`)

  if (logs.items.length === 0) {
    console.log('Khong co dong log nao.')
  } else {
    console.log('')
    console.log(
      'requestId           provider      model                    in    out   cost(USD)  ttft   latency  error',
    )
    for (const item of logs.items) {
      console.log(
        [
          item.requestId.slice(0, 18).padEnd(18),
          item.provider.padEnd(13),
          item.model.slice(0, 24).padEnd(24),
          String(item.tokensIn).padStart(5),
          String(item.tokensOut).padStart(6),
          item.costUsd.toFixed(6).padStart(10),
          String(item.ttftMs).padStart(6),
          String(item.latencyMs).padStart(8),
          item.error ?? '-',
        ].join(' '),
      )
    }
  }

  const summary = summarizeLogs(logs.items)
  console.log('')
  console.log(`Tong hop (${summary.requests} dong trong page hien tai):`)
  console.log(`  - requests: ${summary.requests} (${summary.errors} loi)`)
  console.log(`  - tokens:   ${summary.tokensIn} in / ${summary.tokensOut} out`)
  console.log(`  - cost:     $${summary.costUsd.toFixed(6)}`)
  console.log(`  - ttft:     ${summary.avgTtftMs} ms (TB)`)
  console.log(`  - latency:  ${summary.avgLatencyMs} ms (TB)`)

  const usage = await fetchUsage(baseUrl)
  console.log('')
  console.log(`Tong hop toan bo (GET /api/usage): ${usage.totalTokens} tokens, $${usage.totalCostUsd.toFixed(6)}`)
  for (const day of usage.byDay) {
    console.log(
      `  - ${day.date}: ${day.totalTokens} tokens, $${day.costUsd.toFixed(6)}, ${day.requests} luot`,
    )
  }
}

/**
 * Chay lenh chinh cua CLI.
 *
 * @param args - Tham so CLI (khong bao gom `node` + script path).
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'logs') {
    await runLogs(args.slice(1))
    return
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
    `So lan chay moi task: ${EVAL_RUNS_PER_TASK} → tong ${tasks.length * EVAL_RUNS_PER_TASK} luot chay moi he thong`,
  )

  if (tasks.length === 0) {
    console.warn('Dataset rong — can them task truoc khi chay eval that.')
  }

  console.log('')
  console.log('Lenh khac: `pnpm eval:run logs --limit 20` — doc request_logs tu BFF (T-M1-14).')
}

main().catch((error: unknown) => {
  console.error('Eval CLI loi:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
