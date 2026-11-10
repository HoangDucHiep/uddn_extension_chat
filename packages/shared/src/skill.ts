/**
 * Contract + ham thuan cho **Skills** (FR-SKILL-01/02/03 — T-M2-04).
 *
 * Skill = prompt mau dung lai duoc, goi bang `/` trong composer.
 *
 * File nay **thuan** (khong dung Chrome API, khong dung React, khong dung DB)
 * → dung chung cho server (validate + resolve) + extension (menu `/`) + test.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

/** Pham vi cua mot skill. */
export const SKILL_SCOPES = ['user', 'builtin'] as const
export type SkillScope = (typeof SKILL_SCOPES)[number]

/** Do dai toi da cua ten skill (ky tu). */
export const SKILL_MAX_NAME_CHARS = 60

/** Do dai toi da cua mo ta skill (ky tu). */
export const SKILL_MAX_DESCRIPTION_CHARS = 200

/** Do dai toi da cua prompt mau cua skill (ky tu). */
export const SKILL_MAX_PROMPT_CHARS = 8_000

/** So tag toi da cua mot skill. */
export const SKILL_MAX_TAGS = 10

/** Do dai toi da cua mot tag (ky tu). */
export const SKILL_MAX_TAG_CHARS = 30

/**
 * Dieu kien tab cua mot skill (FR-SKILL-06 — T-M2-21).
 *
 * Skill co dieu kien tab → khi user **chon skill do** (tu menu `/` hoac tu
 * thu vien) → extension tu dinh kem context theo dieu kien:
 * - `useCurrentTab` → dinh kem trang hien tai.
 * - `useSelectedTabs` → mo popover cho user chon tab.
 *
 * > Khong co dieu kien → skill chi dung prompt mau, **khong** tu dong
 * > dinh kem context (giu nguyen nguyen tac FR-CONTEXT-13).
 */
export interface SkillTabCondition {
  /** Chay tren tab hien tai. */
  useCurrentTab: boolean
  /** Chay tren cac tab duoc user chon. */
  useSelectedTabs: boolean
}

/** Dieu kien tab mac dinh — khong co dieu kien nao. */
export const DEFAULT_SKILL_TAB_CONDITION: SkillTabCondition = {
  useCurrentTab: false,
  useSelectedTabs: false,
}

/**
 * Kiem tra skill co dieu kien tab hay khong.
 *
 * @param condition - Dieu kien (co the `undefined`).
 * @returns `true` neu skill can dinh kem context theo dieu kien.
 */
export function hasTabCondition(condition: SkillTabCondition | undefined): boolean {
  if (condition === undefined) return false
  return condition.useCurrentTab || condition.useSelectedTabs
}

/**
 * Chuan hoa ten skill thanh "slug" de go bang `/` khong bi rui.
 *
 * - lowercase
 * - bo dau tieng Viet (NFD + strip combining marks)
 * - `đ` → `d` (ky tu `Đ` khong phai base char + dau → NFD **khong** tach duoc)
 * - thay khoang trang / dau `_` bang `-`
 * - chi giu `a-z`, `0-9`, `-`
 * - ghep nhieu `-` lien nhau va cat dau/cuoi `-`
 *
 * @param raw - Ten tho (co the co dau, chu hoa, khoang trang).
 * @returns Slug da chuan hoa (co the rong neu `raw` khong con ky tu hop le).
 */
export function normalizeSkillName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Kiem tra ten skill co khop voi chuoi người dùng gõ sau `/` hay khong.
 *
 * Khop theo **prefix** (AC FR-SKILL-01: "Menu loc theo prefix").
 * Chuoi rong → khop het (dung cho menu mac dinh).
 *
 * @param name - Ten skill (da chuan hoa).
 * @param query - Chuoi người dùng gõ sau dau `/`.
 */
export function matchesSkillPrefix(name: string, query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (trimmed.length === 0) return true
  return name.toLowerCase().startsWith(trimmed)
}

/**
 * Loc danh sach skill theo chuoi người dùng gõ sau `/`.
 *
 * @param skills - Danh sach skill.
 * @param query - Chuoi loc (sau dau `/`).
 * @returns Skill khop prefix, giu nguyen thu tu dau vao.
 */
export function filterSkills<T extends { name: string }>(
  skills: readonly T[],
  query: string,
): T[] {
  return skills.filter((skill) => matchesSkillPrefix(skill.name, query))
}

/** Placeholder trong prompt template cua skill — thay bang cau hoi cua user. */
export const SKILL_INPUT_PLACEHOLDER = '{input}'

/** Cau hoi mac dinh khi user goi skill ma khong viet them gi. */
export const SKILL_DEFAULT_INPUT = 'Hãy áp dụng skill này.'

/**
 * Noi `prompt_template` cua skill vao cau hoi cua user.
 *
 * - Template co `{input}` → thay bang cau hoi.
 * - Template khong co `{input}` → append cau hoi vao cuoi.
 * - Cau hoi rong → dung `SKILL_DEFAULT_INPUT` (dam bao `content.min(1)`).
 *
 * @param template - Prompt mau cua skill.
 * @param input - Cau hoi cua user (da bo token `/ten-skill`).
 * @returns Prompt moi cho model.
 */
export function applySkillTemplate(template: string, input: string): string {
  const trimmed = input.trim()
  const value = trimmed.length > 0 ? trimmed : SKILL_DEFAULT_INPUT

  if (template.includes(SKILL_INPUT_PLACEHOLDER)) {
    return template.replace(SKILL_INPUT_PLACEHOLDER, value)
  }
  return `${template}\n\n${value}`
}

/**
 * Chuyen `prompt_template` cua skill thanh **chi dan** cho model.
 *
 * Placeholder `{input}` bi **loai bo** (khong thay bang cau hoi) → cau hoi
 * cua user van nam o user turn (model nhin thay ngay ben duoi chi dan) →
 * khong bi lap lai 2 lan (ton token + nhieu nghia).
 *
 * @param template - Prompt mau cua skill.
 * @returns Chi dan da lam sach.
 */
export function buildSkillInstruction(template: string): string {
  return template.split(SKILL_INPUT_PLACEHOLDER).join('').trim()
}

/**
 * Bo token `/ten-skill` ra khoi cau hoi cua user.
 *
 * Client da bo token truoc khi gui → ham nay la **lop bao ve thu hai**
 * (phong trong hop client cu hon, hoac skill bi goi sai cach).
 *
 * Chi khu vuc dung `name` cua skill vua resolve → khong vo tinh xoa
 * `/api` hay duong dan URL trong cau hoi.
 *
 * @param text - Cau hoi cua user (co the con token).
 * @param skillName - Ten skill da resolve (slug).
 * @returns Cau hoi da bo token.
 */
export function stripSkillToken(text: string, skillName: string): string {
  if (skillName.length === 0) return text.trim()

  const escaped = skillName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(^|\\s)/${escaped}(?![a-z0-9-])`, 'gi')
  return text.replace(pattern, '$1').trim()
}
