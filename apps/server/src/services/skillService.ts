/**
 * Service **skills** (FR-SKILL-01/02/03 — T-M2-04).
 *
 * ## Nguon su that
 *
 * - Skill **built-in**: registry trong code (`src/skills/builtin.ts`) → khong
 *   nam trong DB, khong sua/xoa duoc.
 * - Skill **cua user**: bang `skills` trong Postgres.
 *
 * ## Vi sao server la noi resolve skill?
 *
 * Client chi gui `skillId` → server noi `prompt_template` vao system prompt
 * + ap `model` cua skill. Nho vay:
 *  - template chi co **1** noi su that (khong phai ban copy sang client),
 *  - skill ap dung nhat quan cho moi provider,
 *  - client khong can download toan bo template.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

import { asc, eq } from 'drizzle-orm'
import {
  AppError,
  applySkillTemplate,
  ERROR_CODES,
  SKILL_DEFAULT_INPUT,
  SKILL_INPUT_PLACEHOLDER,
  type Skill,
} from '@sidekick/shared'
import type { Database } from '../db/index.js'
import { skills } from '../db/schema.js'
import { BUILTIN_SKILLS, findBuiltinSkillById } from '../skills/builtin.js'

export { applySkillTemplate, SKILL_DEFAULT_INPUT, SKILL_INPUT_PLACEHOLDER }

/** Tham so loc danh sach skill. */
export interface ListSkillsParams {
  /** Loc theo pham vi (`user` | `builtin`). */
  scope?: 'user' | 'builtin' | undefined
  /** Loc theo ten (prefix). */
  q?: string | undefined
}

/**
 * Chuyen dong DB thanh contract `Skill`.
 *
 * @param row - Dong tu bang `skills`.
 */
function toSkill(row: {
  id: string
  name: string
  description: string
  promptTemplate: string
  scope: string
  enabled: boolean
  tags: string[]
  model: string | null
  createdAt: Date
  updatedAt: Date
}): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    promptTemplate: row.promptTemplate,
    scope: row.scope === 'builtin' ? 'builtin' : 'user',
    enabled: row.enabled,
    tags: [...row.tags],
    ...(row.model !== null && row.model.length > 0 ? { model: row.model } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Chuyen skill built-in thanh contract `Skill`.
 *
 * @param skill - Skill tu registry code.
 */
function builtinToSkill(skill: (typeof BUILTIN_SKILLS)[number]): Skill {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    promptTemplate: skill.promptTemplate,
    scope: 'builtin',
    enabled: true,
    tags: [...skill.tags],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

/**
 * Liet ke skill (built-in + cua user).
 *
 * Sap xep: `builtin` truoc `user`, trong moi nhom theo `name` tang dan →
 * menu `/` luon de biet.
 *
 * @param db - Database client.
 * @param params - Bo loc.
 * @returns Danh sach skill.
 */
export async function listSkills(
  db: Database,
  params: ListSkillsParams = {},
): Promise<Skill[]> {
  const scope = params.scope
  const query = params.q?.trim().toLowerCase() ?? ''

  const builtins = BUILTIN_SKILLS.filter((skill) => {
    if (scope !== undefined && scope !== 'builtin') return false
    if (query.length === 0) return true
    return skill.name.toLowerCase().includes(query)
  }).map(builtinToSkill)

  if (scope === 'builtin') return builtins

  const rows = await db
    .select()
    .from(skills)
    .where(eq(skills.scope, 'user'))
    .orderBy(asc(skills.name))

  const users = rows
    .map(toSkill)
    .filter((skill) => {
      if (query.length === 0) return true
      return skill.name.toLowerCase().includes(query)
    })

  return [...builtins, ...users]
}

/**
 * Kiem tra ten skill da ton tai chua (trong DB hoac built-in).
 *
 * @param db - Database client.
 * @param name - Ten skill (da chuan hoa).
 * @param excludeId - Id skill duoc bo qua (khi update).
 * @returns `true` neu ten da ton tai.
 */
async function nameExists(
  db: Database,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const builtin = BUILTIN_SKILLS.find((skill) => skill.name === name)
  if (builtin !== undefined) return true

  const rows = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.name, name))

  return rows.some((row) => row.id !== excludeId)
}

/**
 * Tao skill moi (cua user).
 *
 * @param db - Database client.
 * @param input - Du lieu skill (da qua Zod o bien).
 * @returns Skill da tao.
 */
export async function createSkill(
  db: Database,
  input: {
    name: string
    description: string
    promptTemplate: string
    tags: string[]
    model?: string | undefined
  },
): Promise<Skill> {
  if (await nameExists(db, input.name)) {
    throw new AppError(
      ERROR_CODES.CONFLICT,
      `Skill "${input.name}" da ton tai`,
    )
  }

  const rows = await db
    .insert(skills)
    .values({
      name: input.name,
      description: input.description,
      promptTemplate: input.promptTemplate,
      scope: 'user',
      enabled: true,
      tags: input.tags,
      ...(input.model !== undefined ? { model: input.model } : {}),
    })
    .returning()

  const row = rows[0]
  if (row === undefined) {
    throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Khong tao duoc skill')
  }
  return toSkill(row)
}

/**
 * Cap nhat skill (chi skill cua user).
 *
 * @param db - Database client.
 * @param id - Id skill.
 * @param patch - Truong can doi.
 * @returns Skill sau khi cap nhat.
 */
export async function updateSkill(
  db: Database,
  id: string,
  patch: {
    name?: string | undefined
    description?: string | undefined
    promptTemplate?: string | undefined
    enabled?: boolean | undefined
    tags?: string[] | undefined
    model?: string | null | undefined
  },
): Promise<Skill> {
  if (findBuiltinSkillById(id) !== undefined) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      'Khong the sua skill co san',
    )
  }

  if (patch.name !== undefined && (await nameExists(db, patch.name, id))) {
    throw new AppError(
      ERROR_CODES.CONFLICT,
      `Skill "${patch.name}" da ton tai`,
    )
  }

  const values: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.name !== undefined) values['name'] = patch.name
  if (patch.description !== undefined) values['description'] = patch.description
  if (patch.promptTemplate !== undefined) {
    values['promptTemplate'] = patch.promptTemplate
  }
  if (patch.enabled !== undefined) values['enabled'] = patch.enabled
  if (patch.tags !== undefined) values['tags'] = patch.tags
  if (patch.model !== undefined) values['model'] = patch.model

  const rows = await db
    .update(skills)
    .set(values)
    .where(eq(skills.id, id))
    .returning()

  const row = rows[0]
  if (row === undefined) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Khong tim thay skill')
  }
  return toSkill(row)
}

/**
 * Xoa skill (chi skill cua user).
 *
 * @param db - Database client.
 * @param id - Id skill.
 */
export async function deleteSkill(db: Database, id: string): Promise<void> {
  if (findBuiltinSkillById(id) !== undefined) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      'Khong the xoa skill co san',
    )
  }

  const rows = await db
    .delete(skills)
    .where(eq(skills.id, id))
    .returning()

  if (rows.length === 0) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Khong tim thay skill')
  }
}

/**
 * Skill da duoc resolve de ap dung cho luot chat.
 */
export interface ResolvedSkill {
  /** Prompt mau cua skill (chua thay placeholder). */
  promptTemplate: string
  /** Model cua skill (neu co) → ghi de model cua request. */
  model: string | undefined
  /** Ten skill (de log/debug). */
  name: string
}

/**
 * Resolve skill theo id (dung khi chat — FR-SKILL-01).
 *
 * Built-in duoc tra truoc DB.
 *
 * @param db - Database client.
 * @param skillId - Id skill (uuid).
 * @returns Skill da resolve hoac `undefined` (khong ton tai / bi xoa).
 */
export async function resolveSkillForChat(
  db: Database,
  skillId: string | undefined,
): Promise<ResolvedSkill | undefined> {
  if (skillId === undefined) return undefined

  const builtin = findBuiltinSkillById(skillId)
  if (builtin !== undefined) {
    return {
      promptTemplate: builtin.promptTemplate,
      model: undefined,
      name: builtin.name,
    }
  }

  const rows = await db
    .select()
    .from(skills)
    .where(eq(skills.id, skillId))
    .limit(1)

  const row = rows[0]
  if (row === undefined) return undefined
  if (!row.enabled) return undefined

  return {
    promptTemplate: row.promptTemplate,
    model: row.model !== null && row.model.length > 0 ? row.model : undefined,
    name: row.name,
  }
}
