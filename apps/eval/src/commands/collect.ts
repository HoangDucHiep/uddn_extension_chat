/**
 * Subcommand `collect` — thu thap snapshot trang that (T-M2-12).
 *
 * Idempotent: snapshot da co + hash khop → khong ghi lai.
 *
 * Docs: docs/EVAL_PLAN.md §7.1
 */

import { collectAll, writeDatasetMeta } from '../collect.js'
import { readBoolFlag, readFlag } from '../cliFlags.js'

/**
 * Chay subcommand `collect` — thu thap snapshot trang that.
 *
 * @param args - Tham so CLI (khong bao gom ten subcommand).
 */
export async function runCollect(args: readonly string[]): Promise<void> {
  const baseUrl = readFlag(args, '--base-url', process.env['SIDECKICK_BFF_URL'] ?? 'http://127.0.0.1:8787')
  const force = readBoolFlag(args, '--force')

  console.log(`Thu thap snapshot (BFF: ${baseUrl})...`)
  const results = await collectAll({ force, baseUrl })

  let ok = 0
  for (const result of results) {
    if (result.error !== undefined) {
      console.log(`  [FAIL] ${result.slug}: ${result.error}`)
      continue
    }
    ok += 1
    console.log(`  [ OK ] ${result.slug} — ${result.chars} ky tu`)
  }

  await writeDatasetMeta(results)
  console.log('')
  console.log(`Xong: ${ok}/${results.length} nguon thanh cong.`)
  console.log('Da sinh apps/eval/dataset/dataset_meta.json')
}
