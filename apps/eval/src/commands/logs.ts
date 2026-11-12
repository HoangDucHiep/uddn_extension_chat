/**
 * Subcommand `logs` — doc `request_logs` tu BFF (T-M1-14).
 *
 * Docs: docs/EVAL_PLAN.md §5.3
 */

import { readFlag } from '../cliFlags.js'
import { fetchLogs, fetchUsage, summarizeLogs } from '../logs.js'
import { DEFAULT_BASE_URL } from './run.js'

/**
 * Chay subcommand `logs` — in cac dong log gan nhat + tong hop usage.
 *
 * @param args - Tham so CLI (khong bao gom ten subcommand).
 */
export async function runLogs(args: readonly string[]): Promise<void> {
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
  console.log(
    `Tong hop toan bo (GET /api/usage): ${usage.totalTokens} tokens, $${usage.totalCostUsd.toFixed(6)}`,
  )
  for (const day of usage.byDay) {
    console.log(
      `  - ${day.date}: ${day.totalTokens} tokens, $${day.costUsd.toFixed(6)}, ${day.requests} luot`,
    )
  }
}
