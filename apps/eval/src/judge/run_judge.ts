/**
 * Runner LLM-as-judge (T-M2-14).
 *
 * Voi moi luot chay da ghi:
 *  1. Tao/ghi **blind map** (`blind_map.json`) → judge khong biet he thong nao.
 *  2. Gọi BFF (`POST /api/chat`) voi `systemPrompt` = judge prompt ·
 *     `temperature: 0` → **deterministic**.
 *  3. Parse JSON (boc fence ``` ```json ``` ```) → validate bang
 *     `evalJudgeResultSchema` → ghi `apps/eval/results/judged/<run_id>/`.
 *
 * Loi parse → ghi `status: 'judge_error'` (KHONG tinh diem 0 — tranh
 * "phan biet do model" sai lech).
 *
 * Docs: docs/EVAL_PLAN.md §4.3, §6.1, §7.2
 */

import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { evalJudgeResultSchema, type EvalTask } from '@sidekick/shared'
import type { BlindMap, EvalSystem } from './blind.js'
import { buildJudgeUserMessage, JUDGE_SYSTEM_PROMPT, type JudgeCitation } from './prompt.js'
import { streamChat } from '../sse.js'
import { type JudgeResult, readJudgeResults, writeJudgeResults } from '../results/judgeStore.js'

/** Thu muc goc cua repo. */
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..')

/** Ket qua cham cua 1 luot chay — dinh nghia dung chung (xem `judgeStore.ts`). */
export type { JudgeResult }
export { readJudgeResults, writeJudgeResults }

/** Tuy chon chay judge. */
export interface JudgeOptions {
  /** Base URL cua BFF. */
  baseUrl: string
  /** Id cua run. */
  runId: string
  /** Provider judge (mac dinh `gemini`). */
  provider?: string
  /** Model judge (mac dinh `gemini-2.5-flash`). */
  model?: string
  /** He thong duoc cham (mac dinh chi `sidekick`). */
  systems?: readonly EvalSystem[]
  /** Seed sinh blind map (mac dinh = runId). */
  seed?: string
  /** Chi cham nhung task nay. */
  taskIds?: readonly string[] | undefined
  /** Gioi han so task. */
  limit?: number | undefined
  /** Chi in ke hoach, khong goi BFF. */
  dryRun?: boolean
  /** Cho nghi giua 2 luot cham (ms) — tranh vuot RPM cua provider free tier. */
  delayMs?: number | undefined
  /** Ket qua judge da co → chi cham lai nhung luot chua cham thanh cong. */
  existing?: readonly JudgeResult[] | undefined
}

/**
 * Boc JSON tu cau tra loi cua judge.
 *
 * Model hay boc trong fence ``` ```json ... ``` ``` → can loai.
 *
 * @param text - Cau tra loi raw cua judge.
 * @returns JSON string, hoac `undefined` neu khong parse duoc.
 */
export function extractJsonPayload(text: string): string | undefined {
  const trimmed = text.trim()

  // Uu tien noi dung trong fence.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = [fenceMatch?.[1]?.trim(), trimmed].filter(
    (value): value is string => value !== undefined && value.length > 0,
  )

  for (const candidate of candidates) {
    const parsed = tryParse(candidate)
    if (parsed !== undefined) return parsed
  }

  return undefined
}

/**
 * Thu JSON tu 1 chuoi — tra ve **chuoi chuan hoa** (de validate bang Zod).
 *
 * @param text - Text can parse.
 */
function tryParse(text: string): string | undefined {
  try {
    JSON.parse(text)
    return text
  } catch {
    // Thu cat phan dau/cuoi neu model them text thua.
  }

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return undefined

  const slice = text.slice(start, end + 1)
  try {
    JSON.parse(slice)
    return slice
  } catch {
    return undefined
  }
}

/**
 * Cham 1 luot chay.
 *
 * @param task - Task tuong ung.
 * @param answer - Cau tra loi cua he thong.
 * @param sourceMaterial - Noi dung nguon (ground truth).
 * @param label - Nhan gia blind.
 * @param system - He thong that.
 * @param run - So lan chay.
 * @param options - Tuy chon.
 */
export async function judgeOnce(
  task: EvalTask,
  answer: string,
  sourceMaterial: string,
  label: string,
  system: EvalSystem,
  run: number,
  options: JudgeOptions,
  citations: readonly JudgeCitation[] = [],
): Promise<JudgeResult> {
  const base: JudgeResult = {
    taskId: task.id,
    label,
    system,
    run,
    status: 'judge_error',
  }

  if (options.dryRun === true) {
    return base
  }

  try {
    const userMessage = buildJudgeUserMessage({
      question: task.prompt,
      sourceMaterial,
      response: answer,
      ...(citations.length > 0 ? { citations } : {}),
      ...(task.reference?.key_points !== undefined
        ? { keyPoints: task.reference.key_points }
        : {}),
      ...(task.reference?.must_include_facts !== undefined
        ? { mustIncludeFacts: task.reference.must_include_facts }
        : {}),
      ...(task.reference?.must_not_contain !== undefined
        ? { mustNotContain: task.reference.must_not_contain }
        : {}),
    })

    const result = await streamChat(
      options.baseUrl,
      {
        messages: [{ role: 'user', content: userMessage }],
        systemPrompt: JUDGE_SYSTEM_PROMPT,
        temperature: 0,
        ...(options.provider !== undefined ? { provider: options.provider } : {}),
        ...(options.model !== undefined ? { model: options.model } : {}),
      },
      { requestId: `judge-${task.id}-r${run}-${randomUUID().slice(0, 8)}` },
    )

    const payload = extractJsonPayload(result.answer)
    if (payload === undefined) {
      return {
        ...base,
        error: 'Judge không trả về JSON hợp lệ',
        ...(result.errorCode !== undefined ? { error: result.errorCode } : {}),
      }
    }

    const parsed = evalJudgeResultSchema.safeParse(JSON.parse(payload) as unknown)
    if (!parsed.success) {
      return {
        ...base,
        error: `Diem judge khong khop schema: ${parsed.error.issues
          .map((issue) => issue.path.join('.') + ': ' + issue.message)
          .join('; ')}`,
      }
    }

    return {
      ...base,
      status: 'ok',
      judge: parsed.data,
      ...(result.provider !== undefined ? { provider: result.provider } : {}),
      ...(result.model !== undefined ? { model: result.model } : {}),
      ...(result.tokensIn !== undefined ? { tokensIn: result.tokensIn } : {}),
      ...(result.tokensOut !== undefined ? { tokensOut: result.tokensOut } : {}),
      ...(result.costUsd !== undefined ? { costUsd: result.costUsd } : {}),
    }
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Ghi blind map.
 *
 * @param runId - Id cua run.
 * @param map - Blind map.
 */
export async function writeBlindMap(runId: string, map: BlindMap): Promise<string> {
  const path = resolve(REPO_ROOT, 'apps/eval/results', runId, 'blind_map.json')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(map, null, 2)}\n`, 'utf8')
  return path
}
