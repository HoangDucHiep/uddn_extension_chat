/**
 * Import/export skill dang JSON (FR-SKILL-05 — T-M2-05).
 *
 * Module **thuan** (khong DOM, khong React) → test duoc truc tiep trong
 * vitest. Phan tao file thuoc `lib/downloadFile.ts` (dung `Blob` + `<a
 * download>` — khong can `chrome.downloads`).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

import {
  buildSkillExport,
  buildSkillFileName,
  skillImportPayloadSchema,
  toImportableSkills,
  type CreateSkillInput,
  type Skill,
} from '@sidekick/shared'
import { downloadTextFile } from './downloadFile.js'

/** Kieu MIME cua file skill. */
const SKILL_FILE_MIME = 'application/json'

/**
 * Xuat danh sach skill ra file JSON.
 *
 * Chi xuat skill `scope === 'user'` (skill built-in nam trong code →
 * khong xuat). Ten file co timestamp → khong ghi de file cu.
 *
 * @param skills - Danh sach skill can xuat.
 * @param at - Thoi diem dung trong ten file (mac dinh `new Date()`).
 * @returns Ten file da tao.
 */
export function exportSkillsFile(skills: readonly Skill[], at: Date = new Date()): string {
  const payload = buildSkillExport(skills, at)
  const fileName = buildSkillFileName(at)
  downloadTextFile(fileName, JSON.stringify(payload, null, 2), SKILL_FILE_MIME)
  return fileName
}

/**
 * Doc file JSON cua nguoi dung → danh sach input tao skill.
 *
 * Parse bang Zod schema cua `packages/shared` → file sai shape bi lo voi
 * loi ro rang (khong tao skill nao).
 *
 * @param file - File nguoi dung chon.
 * @returns Danh sach input tao skill (da bo id/scope/timestamp).
 * @throws Error neu file khong hop le.
 */
export async function importSkillsFile(file: File): Promise<CreateSkillInput[]> {
  const text = await file.text()

  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('File không phải JSON hợp lệ')
  }

  const parsed = skillImportPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    throw new Error(`File skill không hợp lệ — ${issues}`)
  }

  return toImportableSkills(parsed.data)
}
