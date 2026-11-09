/**
 * Zod schema cho **eval dataset** — nguon su that cho contract dataset.
 *
 * Contract nay **phai khop** voi [`EVAL_PLAN.md`](../../docs/EVAL_PLAN.md)
 * §3.1 (shape 1 task) + §3.2 (8 nhom task).
 *
 * Vi sao dat o `packages/shared`?
 *  - `apps/eval` dung de validate dataset.
 *  - `apps/server` (tuong lai) co the phuc vu dataset / nhan dataset tu
 *    client → dung **chung 1 nguon su that**, khong viet 2 ban.
 *
 * Docs: docs/EVAL_PLAN.md §3.1, §3.2
 */

import { z } from 'zod'

/**
 * 8 nhom task eval — theo `EVAL_PLAN.md` §3.2.
 *
 * Nhom `workflow` **khong** nam trong day: no thuoc M4 (`EVAL_PLAN.md`
 * §3.2.1) va chi chay khi da implement workflow → them sau, khong lam
 * dataset M2 khong the chay bi reject.
 */
export const EVAL_GROUPS = [
  'page_qa',
  'summarize',
  'cross_tab',
  'writing',
  'vision',
  'doc_extract',
  'video_transcript',
  'general_qa',
] as const

/** Nhom task eval. */
export const evalGroupSchema = z.enum(EVAL_GROUPS)
export type EvalGroup = z.infer<typeof evalGroupSchema>

/** Ngon ngu cua task (theo `EVAL_PLAN.md` §3.2 — ≥ 40% tieng Viet). */
export const evalLangSchema = z.enum(['vi', 'en'])
export type EvalLang = z.infer<typeof evalLangSchema>

/**
 * Trang web dung lam context cho task.
 *
 * `snapshot_path` tro toi file snapshot trong `apps/eval/dataset/snapshots/`
 * → dung lai nguyen tac "tai lap duoc" (`EVAL_PLAN.md` §3.4).
 */
export const evalPageSchema = z.object({
  /** URL day du cua trang. */
  url: z.string().url(),
  /** Tieu de trang. */
  title: z.string(),
  /** Duong dan snapshot noi dung trang (tuong doi repo root). */
  snapshot_path: z.string().min(1),
  /** Hash noi dung — phat hien thay doi snapshot. */
  content_hash: z.string().min(1),
})
export type EvalPage = z.infer<typeof evalPageSchema>

/**
 * Cau tra loi tham chieu — dung cho metric tu dong + LLM-as-judge.
 *
 * `EVAL_PLAN.md` §3.3: **moi task phai co mot dap an tham chieu** de judge
 * cham duoc dinh luong, khong chi dua vao cam nhan.
 */
export const evalReferenceSchema = z.object({
  /** Cac diem chinh can co trong cau tra loi. */
  key_points: z.array(z.string().min(1)).optional(),
  /** Facts bat buoc phai xuat hien (VD con so `87%`). */
  must_include_facts: z.array(z.string().min(1)).optional(),
  /** Cau tra loi **khong** duoc chua (canh bao sai lech). */
  must_not_contain: z.array(z.string().min(1)).optional(),
})
export type EvalReference = z.infer<typeof evalReferenceSchema>

/**
 * Schema cua 1 task eval — theo `EVAL_PLAN.md` §3.1.
 *
 * Luu y: dung **snake_case** cho field (`snapshot_path` · `content_hash` ·
 * `key_points` · `must_include_facts` · `must_not_contain` ·
 * `expected_citations`) — vi du dataset la JSON interchange, dung chung
 * voi transcript thu cong cua Edge/Gemini.
 */
export const evalTaskSchema = z.object({
  /** Id duy nhat, dang `<group>-<nguoi-tao>-<so>`. */
  id: z.string().min(1),
  /** Nhom task. */
  group: evalGroupSchema,
  /** Ngon ngu cua task. */
  lang: evalLangSchema,
  /** Trang dung lam context. */
  page: evalPageSchema,
  /** Cau hoi dua vao side panel. */
  prompt: z.string().min(1),
  /** Cau tra loi tham chieu. */
  reference: evalReferenceSchema.optional(),
  /** So nguon trich dan ky vong (metric citation precision). */
  expected_citations: z.number().int().nonnegative().optional(),
  /** Nhan de loc dataset (VD `["news", "vi"]`). */
  tags: z.array(z.string().min(1)).optional(),
  /** Ghi chu cho nguoi cham / run (VD provider limitation). */
  notes: z.string().optional(),
})
export type EvalTask = z.infer<typeof evalTaskSchema>

/** Dataset la mot mang task. */
export const evalTaskListSchema = z.array(evalTaskSchema)
export type EvalTaskList = z.infer<typeof evalTaskListSchema>
