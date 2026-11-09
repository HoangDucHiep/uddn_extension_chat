/**
 * Kieu du lieu cua eval dataset.
 *
 * **Nguon su that:** [`packages/shared/src/schemas/eval.ts`](../../packages/shared/src/schemas/eval.ts)
 * → dung chung 1 contract giua eval harness va (tuong lai) server.
 * Shape cua task xem [`docs/EVAL_PLAN.md`](../../docs/EVAL_PLAN.md) §3.1,
 * danh sach 8 nhom xem §3.2.
 *
 * Phan thu thap du lieu va judge LLM duoc implement o M2 (T-M2-*) — M1 chi
 * khoi tao scaffold de monorepo typecheck/build duoc nhat quan.
 */

export {
  EVAL_GROUPS,
  evalGroupSchema,
  evalLangSchema,
  evalPageSchema,
  evalReferenceSchema,
  evalTaskListSchema,
  evalTaskSchema,
  type EvalGroup,
  type EvalLang,
  type EvalPage,
  type EvalReference,
  type EvalTask,
  type EvalTaskList,
} from '@sidekick/shared'

/** Ket qua mot lan chay mot task tren mot he thong. */
export interface EvalRunResult {
  taskId: string
  /** Id he thong: `sidekick` | `edge-copilot` | `chrome-gemini`. */
  system: string
  /** Cau tra loi thu duoc. */
  answer: string
  /** Diem rubric 1-5 do LLM-as-judge cham. */
  rubricScore?: number
  /** Do tre lan dau token (ms) — chi do duoc khi co timestamp server. */
  ttftMs?: number
  /** Tong so token output. */
  tokensOut?: number
  /** Chi phi (USD). */
  costUsd?: number
  /** Loi neu task that bai. */
  error?: string
}

/** Chu ky chay mot task (de tinh trung bin). */
export const EVAL_RUNS_PER_TASK = 3
