/**
 * Zod schema cho contract **Skills** (FR-SKILL-01/02/03 — T-M2-04).
 *
 * Dat o `packages/shared` de server (validate o bien) va extension (parse
 * response) dung **chung 1 nguon su that**.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

import { z } from 'zod'
import {
  SKILL_MAX_DESCRIPTION_CHARS,
  SKILL_MAX_NAME_CHARS,
  SKILL_MAX_PROMPT_CHARS,
  SKILL_MAX_TAG_CHARS,
  SKILL_MAX_TAGS,
  SKILL_SCOPES,
  normalizeSkillName,
} from '../skill.js'

/** Pham vi cua mot skill. */
export const skillScopeSchema = z.enum(SKILL_SCOPES)
export type SkillScopeInput = z.infer<typeof skillScopeSchema>

/**
 * Mot skill (prompt mau dung lai duoc).
 *
 * `scope` = `builtin` (san co, khong sua/xoa) · `user` (user tu tao).
 */
export const skillSchema = z.object({
  id: z.string().uuid(),
  /** Ten skill — slug de go bang `/` (vd `tom-tat`). */
  name: z.string().min(1).max(SKILL_MAX_NAME_CHARS),
  /** Mo ta ngan (hien thi trong menu `/` va drawer). */
  description: z.string().max(SKILL_MAX_DESCRIPTION_CHARS).default(''),
  /** Prompt mau cua skill. */
  promptTemplate: z.string().min(1).max(SKILL_MAX_PROMPT_CHARS),
  /** Pham vi. */
  scope: skillScopeSchema,
  /** Skill co bat hay khong. */
  enabled: z.boolean().default(true),
  /** Tag de loc (FR-SKILL-07 — T-M2-06). */
  tags: z.array(z.string().min(1).max(SKILL_MAX_TAG_CHARS)).max(SKILL_MAX_TAGS).default([]),
  /** Model mac dinh cua skill (optional — FR-SKILL-02). */
  model: z.string().max(200).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Skill = z.infer<typeof skillSchema>

/** Response cua `GET /api/skills`. */
export const skillListResponseSchema = z.object({
  items: z.array(skillSchema),
})
export type SkillListResponse = z.infer<typeof skillListResponseSchema>

/**
 * Body cua `POST /api/skills`.
 *
 * `name` duoc chuan hoa (slug) **truoc** khi validate → user go "Tóm tắt"
 * thi server luu `tom-tat`.
 */
export const createSkillSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(SKILL_MAX_NAME_CHARS)
    .transform((value) => normalizeSkillName(value))
    .refine((value) => value.length > 0, { message: 'Ten skill khong hop le' }),
  description: z.string().max(SKILL_MAX_DESCRIPTION_CHARS).optional().default(''),
  promptTemplate: z.string().min(1).max(SKILL_MAX_PROMPT_CHARS),
  tags: z.array(z.string().min(1).max(SKILL_MAX_TAG_CHARS)).max(SKILL_MAX_TAGS).optional().default([]),
  model: z.string().max(200).optional(),
})
export type CreateSkillInput = z.infer<typeof createSkillSchema>

/**
 * Body cua `PATCH /api/skills/:id`.
 *
 * Chi cho phep doi cac field da biet · phai co it nhat 1 field.
 */
export const updateSkillSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(SKILL_MAX_NAME_CHARS)
      .transform((value) => normalizeSkillName(value))
      .refine((value) => value.length > 0, { message: 'Ten skill khong hop le' })
      .optional(),
    description: z.string().max(SKILL_MAX_DESCRIPTION_CHARS).optional(),
    promptTemplate: z.string().min(1).max(SKILL_MAX_PROMPT_CHARS).optional(),
    enabled: z.boolean().optional(),
    tags: z.array(z.string().min(1).max(SKILL_MAX_TAG_CHARS)).max(SKILL_MAX_TAGS).optional(),
    model: z.string().max(200).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Can it nhat mot truong de cap nhat',
  })
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>

/** Query cua `GET /api/skills`. */
export const skillListQuerySchema = z.object({
  /** Loc theo pham vi (`user` | `builtin`). */
  scope: skillScopeSchema.optional(),
  /** Loc theo ten (prefix, khong phan biet hoa thuong). */
  q: z.string().max(SKILL_MAX_NAME_CHARS).optional(),
})
export type SkillListQuery = z.infer<typeof skillListQuerySchema>
