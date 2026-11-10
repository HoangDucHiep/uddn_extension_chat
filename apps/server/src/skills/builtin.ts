/**
 * Registry **skill co san** (built-in) — T-M2-04 (FR-SKILL-01/04).
 *
 * Skill built-in **khong** nam trong Postgres → khong can migration seed,
 * khong bi user xoa/sua → phai `scope: 'builtin'`.
 *
 * ## Vi sao id la **uuid cố định**?
 *
 * Client gui `skillId` (uuid) len `POST /api/chat` → server resolve skill.
 * Built-in skill khong co dong trong DB nen can id **on dinh** de client
 * goi duoc. Id hardcode o day → cung id cho ca moi client → an toan.
 *
 * ## Pham vi
 *
 * T-M2-04 chi seed **3 skill** de kiem chung menu `/` + CRUD.
 * Thu vien day du (>= 8 skill) nam o **T-M2-21** (FR-SKILL-04).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

/** Skill mot phan tu cua registry built-in. */
export interface BuiltinSkill {
  /** Id on dinh (uuid) — client goi skill bang id nay. */
  id: string
  /** Ten skill (slug, go bang `/`). */
  name: string
  /** Mo ta ngan (hien thi trong menu `/`). */
  description: string
  /** Prompt mau cua skill. */
  promptTemplate: string
  /** Tag de loc (FR-SKILL-07 — T-M2-06). */
  tags: string[]
}

/**
 * Registry skill co san.
 *
 * `promptTemplate` dung placeholder `{input}` — server thay bang noi dung
 * cau hoi cua user (neu user khong viet them gi → dung cau mac dinh).
 */
export const BUILTIN_SKILLS: readonly BuiltinSkill[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'tom-tat',
    description: 'Tóm tắt nội dung thành 5 ý chính và 2 con số nổi bật',
    promptTemplate:
      'Tóm tắt nội dung sau thành 5 ý chính, nêu 2 con số nổi bật và 1 câu hỏi chưa được trả lời. Trả lời bằng tiếng Việt.\n\n{input}',
    tags: ['summary'],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    name: 'giai-thich-don-gian',
    description: 'Giải thích như cho người mới, dùng ví dụ đời thường',
    promptTemplate:
      'Giải thích nội dung sau thật đơn giản, như đang nói với người mới, kèm 1 ví dụ đời thường. Trả lời bằng tiếng Việt.\n\n{input}',
    tags: ['explain'],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    name: 'dich',
    description: 'Dịch sang tiếng Việt, giữ nguyên thuật ngữ kỹ thuật',
    promptTemplate:
      'Dịch nội dung sau sang tiếng Việt, giữ nguyên thuật ngữ kỹ thuật và trả lời bằng tiếng Việt.\n\n{input}',
    tags: ['translate'],
  },
]

/**
 * Tim skill built-in theo id.
 *
 * @param id - Id skill can tim.
 * @returns Skill built-in hoac `undefined`.
 */
export function findBuiltinSkillById(id: string): BuiltinSkill | undefined {
  return BUILTIN_SKILLS.find((skill) => skill.id === id)
}

/**
 * Tim skill built-in theo ten (slug).
 *
 * @param name - Ten skill.
 * @returns Skill built-in hoac `undefined`.
 */
export function findBuiltinSkillByName(name: string): BuiltinSkill | undefined {
  return BUILTIN_SKILLS.find((skill) => skill.name === name)
}
