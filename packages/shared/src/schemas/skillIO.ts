/**
 * Zod schema cho contract **import/export skill JSON** (FR-SKILL-05 —
 * T-M2-05).
 *
 * Dat o `packages/shared` de extension (parse file JSON nguoi dung chon) va
 * server (validate o bien) dung **chung 1 nguon su that**.
 *
 * Ham thuan (sinh payload, chuan hoa input) nam o
 * [`../skillIO.ts`](../skillIO.ts) → file nay chi lo **schema**.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

import { z } from 'zod'
import {
  SKILL_IMPORT_MAX_DESCRIPTION_CHARS,
  SKILL_IMPORT_MAX_NAME_CHARS,
  SKILL_IMPORT_MAX_PROMPT_CHARS,
  SKILL_IMPORT_MAX_TAG_CHARS,
  SKILL_IO_VERSION,
  SKILL_MAX_IMPORT_ITEMS,
} from '../skillIO.js'
import { skillSchema } from './skill.js'

/**
 * 1 skill doc tu file JSON.
 *
 * > Khong export type o day: kieu chuan cua 1 skill trong file import nam o
 * > [`../skillIO.ts`](../skillIO.ts) (`SkillImportItem`) → tranh trung ten
 * > khi barrel `index.ts` gop ca 2 file.
 */
export const skillImportItemSchema = z.object({
  /** Ten skill — se duoc chuan hoa thanh slug khi tao. */
  name: z.string().min(1).max(SKILL_IMPORT_MAX_NAME_CHARS),
  /** Mo ta ngan. */
  description: z.string().max(SKILL_IMPORT_MAX_DESCRIPTION_CHARS).default(''),
  /** Prompt mau. */
  promptTemplate: z.string().min(1).max(SKILL_IMPORT_MAX_PROMPT_CHARS),
  /** Tag de loc. */
  tags: z.array(z.string().min(1).max(SKILL_IMPORT_MAX_TAG_CHARS)).default([]),
  /** Model mac dinh (optional). */
  model: z.string().max(200).optional(),
})

/**
 * Payload doc tu file JSON.
 *
 * `version` **khong** bat buoc → user tu viet file van import duoc (server
 * tu chuan hoa). `skills` toi da `SKILL_MAX_IMPORT_ITEMS` → chan file qua lon.
 */
export const skillImportPayloadSchema = z.object({
  version: z.number().int().optional(),
  exportedAt: z.string().optional(),
  skills: z.array(skillImportItemSchema).min(1).max(SKILL_MAX_IMPORT_ITEMS),
})

/**
 * Payload ghi ra file JSON ( dung khi export).
 *
 * Dung `skillSchema` (contract cua skill) → export ra ** dung shape server
 * tra ve → import lai khong mat du lieu.
 */
export const skillExportPayloadSchema = z.object({
  version: z.literal(SKILL_IO_VERSION),
  exportedAt: z.string(),
  skills: z.array(skillSchema),
})
