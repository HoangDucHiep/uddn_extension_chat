/**
 * Contract + ham thuan cho **import/export skill dang JSON** (FR-SKILL-05 —
 * T-M2-05).
 *
 * File nay **thuan** (khong dung Zod, khong dung React, khong dung DB) →
 * dung chung cho extension (sinh file / doc file) + test.
 *
 * ## Vì sao export chi lay skill `scope === 'user'`?
 *
 * Skill **built-in** nam trong registry trong code (`apps/server/src/skills/
 * builtin.ts`) → khong nam trong DB → export ra roi import lai vo nghia
 * (va se dung ten voi skill built-in).
 *
 * ## Vì sao import bo qua `id` / `scope` / timestamp?
 *
 * File JSON co the duoc chuyen may → `id` cu cua may A khong ton tai o may B
 * → server tu sinh `id` moi + gan `scope: 'user'` → khong de skill cua may
 * khac bi ghi de.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

import {
  SKILL_MAX_DESCRIPTION_CHARS,
  SKILL_MAX_NAME_CHARS,
  SKILL_MAX_PROMPT_CHARS,
  SKILL_MAX_TAGS,
  SKILL_MAX_TAG_CHARS,
  normalizeSkillName,
} from './skill.js'
import type { CreateSkillInput, Skill } from './schemas/skill.js'

/** Version format file skill — tang khi doi shape. */
export const SKILL_IO_VERSION = 1

/** So skill toi da cho 1 lan import. */
export const SKILL_MAX_IMPORT_ITEMS = 100

/** Mot skill doc tu file (chi lay cac field **noi dung**). */
export interface SkillImportItem {
  /** Ten skill (slug se duoc chuan hoa khi tao). */
  name: string
  /** Mo ta ngan. */
  description: string
  /** Prompt mau. */
  promptTemplate: string
  /** Tag de loc. */
  tags: string[]
  /** Model mac dinh (optional). */
  model?: string | undefined
}

/** Payload ghi ra file JSON. */
export interface SkillExportPayload {
  /** Version format. */
  version: number
  /** Thoi diem xuat (ISO 8601). */
  exportedAt: string
  /** Danh sach skill da xuat (chi `scope === 'user'`). */
  skills: Skill[]
}

/** Payload doc tu file JSON. */
export interface SkillImportPayload {
  /** Version format (co the vang khi user tu viet file). */
  version?: number | undefined
  /** Thoi diem xuat (optional). */
  exportedAt?: string | undefined
  /** Danh sach skill can import. */
  skills: SkillImportItem[]
}

/**
 * Tao payload export tu danh sach skill.
 *
 * Chi lay skill `scope === 'user'` — skill built-in nam trong code, khong
 * export (xem ghi chu dau file).
 *
 * @param skills - Danh sach skill (builtin + user).
 * @param at - Thoi diem ghi vao payload (mac dinh `new Date()`).
 * @returns Payload export.
 */
export function buildSkillExport(
  skills: readonly Skill[],
  at: Date = new Date(),
): SkillExportPayload {
  return {
    version: SKILL_IO_VERSION,
    exportedAt: at.toISOString(),
    skills: skills.filter((skill) => skill.scope === 'user').map((skill) => ({ ...skill })),
  }
}

/**
 * Chuan hoa payload import thanh danh sach input tao skill.
 *
 * - Ten duoc chuan hoa thanh slug (giong server) → tranh 2 skill trung ten.
 * - Bo qua `id` / `scope` / `createdAt` / `updatedAt` (server tu sinh lai).
 * - Skill co ten rong sau khi chuan hoa → **bi loai** (khong tao duoc ten hop le).
 *
 * @param payload - Payload doc tu file.
 * @returns Danh sach input tao skill.
 */
export function toImportableSkills(payload: SkillImportPayload): CreateSkillInput[] {
  const result: CreateSkillInput[] = []
  const seen = new Set<string>()

  for (const item of payload.skills) {
    const name = normalizeSkillName(item.name)
    if (name.length === 0) continue
    // Trung ten trong cung 1 file → chi giu ban dau.
    if (seen.has(name)) continue
    seen.add(name)

    const tags = (item.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0)
    const model = item.model?.trim()

    result.push({
      name,
      description: item.description ?? '',
      promptTemplate: item.promptTemplate,
      tags: tags.slice(0, SKILL_MAX_TAGS),
      ...(model !== undefined && model.length > 0 ? { model } : {}),
    })
  }

  return result
}

/**
 * Sinh ten file an toan cho skill export (Windows/macOS/Linux).
 *
 * @param at - Thoi diem dung trong ten file.
 * @returns Ten file.
 */
export function buildSkillFileName(at: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const stamp = [
    `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}`,
    `${pad(at.getHours())}${pad(at.getMinutes())}`,
  ].join('-')

  return `sidekick-skills-${stamp}.json`
}

/** Gioi han do dai ten skill khi doc tu file (input khong qua server). */
export const SKILL_IMPORT_MAX_NAME_CHARS = SKILL_MAX_NAME_CHARS

/** Gioi han do dai mo ta skill khi doc tu file. */
export const SKILL_IMPORT_MAX_DESCRIPTION_CHARS = SKILL_MAX_DESCRIPTION_CHARS

/** Gioi han do dai prompt skill khi doc tu file. */
export const SKILL_IMPORT_MAX_PROMPT_CHARS = SKILL_MAX_PROMPT_CHARS

/** Gioi han do dai 1 tag skill khi doc tu file. */
export const SKILL_IMPORT_MAX_TAG_CHARS = SKILL_MAX_TAG_CHARS
