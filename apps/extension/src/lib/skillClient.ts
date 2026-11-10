/**
 * Client goi BFF cho CRUD skill (FR-SKILL-01/02/03 — T-M2-04).
 *
 * Dung `fetchJson` cua `lib/apiClient.ts` → loi chuan hoa san (`ApiError`).
 *
 * Response duoc parse bang **Zod schema** cua `packages/shared` → client
 * khong nhan du lieu sai shape ma khong biet.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.25
 */

import {
  API_ROUTES,
  skillListResponseSchema,
  skillSchema,
  type CreateSkillInput,
  type Skill,
  type UpdateSkillInput,
} from '@sidekick/shared'
import { fetchJson } from './apiClient.js'

/** Tham so loc danh sach skill. */
export interface ListSkillsParams {
  /** Loc theo pham vi (`user` | `builtin`). */
  scope?: 'user' | 'builtin' | undefined
  /** Loc theo ten (prefix). */
  q?: string | undefined
}

/**
 * Liet ke skill.
 *
 * @param params - Bo loc.
 * @returns Danh sach skill (built-in truoc, sau do skill cua user).
 */
export async function listSkills(params: ListSkillsParams = {}): Promise<Skill[]> {
  const search = new URLSearchParams()
  if (params.scope !== undefined) search.set('scope', params.scope)
  if (params.q !== undefined && params.q.length > 0) search.set('q', params.q)

  const suffix = search.toString()
  const raw = await fetchJson<unknown>(
    suffix.length > 0 ? `${API_ROUTES.skills}?${suffix}` : API_ROUTES.skills,
  )
  return skillListResponseSchema.parse(raw).items
}

/**
 * Tao skill moi.
 *
 * @param input - Du lieu skill (ten duoc server chuan hoa).
 * @returns Skill da tao.
 */
export async function createSkill(input: CreateSkillInput): Promise<Skill> {
  const raw = await fetchJson<unknown>(API_ROUTES.skills, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return skillSchema.parse(raw)
}

/**
 * Cap nhat skill.
 *
 * @param id - Id skill.
 * @param patch - Truong can doi.
 * @returns Skill sau khi cap nhat.
 */
export async function updateSkill(id: string, patch: UpdateSkillInput): Promise<Skill> {
  const raw = await fetchJson<unknown>(
    `${API_ROUTES.skills}/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  )
  return skillSchema.parse(raw)
}

/**
 * Xoa skill.
 *
 * @param id - Id skill.
 */
export async function deleteSkill(id: string): Promise<void> {
  await fetchJson<null>(`${API_ROUTES.skills}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
