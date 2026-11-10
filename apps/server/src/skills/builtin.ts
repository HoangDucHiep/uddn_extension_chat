/**
 * Registry **skill co san** (built-in) — T-M2-04 (FR-SKILL-01/04),
 * mo rong tai T-M2-21 (FR-SKILL-04/06).
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
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

import type { SkillTabCondition } from '@sidekick/shared'

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
  /**
   * Dieu kien tab cua skill (FR-SKILL-06 — T-M2-21).
   *
   * Khong co → skill chi dung prompt mau, khong tu dong dinh kem context.
   */
  tabCondition?: SkillTabCondition | undefined
}

/**
 * Registry skill co san (>= 8 skill — FR-SKILL-04).
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
  {
    id: 'a1000000-0000-4000-8000-000000000004',
    name: 'so-sanh',
    description: 'So sánh 2+ đối tượng theo bảng tiêu chí, nêu điểm khác biệt',
    promptTemplate:
      'So sánh các đối tượng trong nội dung sau theo bảng tiêu chí (3 tiêu chí phổ biến nhất), nêu rõ điểm giống và điểm khác biệt, kết luận nên chọn cái nào và vì sao. Trả lời bằng tiếng Việt.\n\n{input}',
    tags: ['analysis', 'compare'],
    // So sanh can doc ca 2 trang → tu dong dinh kem tab hien tai.
    tabCondition: { useCurrentTab: true, useSelectedTabs: false },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000005',
    name: 'trich-xuat-du-lieu',
    description: 'Rút bảng / danh sách dữ liệu có cấu trúc từ trang',
    promptTemplate:
      'Trích xuất dữ liệu có cấu trúc từ nội dung sau: trả về bảng Markdown với các cột phù hợp, mỗi hàng là 1 bản ghi, không thêm phần giải thích. Nếu không có dữ liệu dạng bảng, liệt kê các mục chính. Trả lời bằng tiếng Việt.\n\n{input}',
    tags: ['extract', 'data'],
    // Rut du lieu chi lay tu trang → can tab noi co du lieu.
    tabCondition: { useCurrentTab: true, useSelectedTabs: false },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000006',
    name: 'viet-email',
    description: 'Soạn email trình bày + chủ đề ngắn gọn',
    promptTemplate:
      'Soạn email dựa trên nội dung sau. Trả về: 1 dòng chủ đề đề xuất, 1 đoạn thân email trình bày, 1 dòng chữ ký gợi ý. Giữ giọng điệu chuyên nghiệp, thân thiện. Trả lời bằng tiếng Việt.\n\n{input}',
    tags: ['email', 'writing'],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000007',
    name: 'sinh-quiz',
    description: 'Sinh câu đối kèm đáp án từ nội dung đã đọc',
    promptTemplate:
      'Sinh 5 câu hỏi trắc nghiệm (A/B/C/D) từ nội dung sau, kèm đáp án đúng và 1 giải thích ngắn cho mỗi câu. Sắp xếp từ dễ đến khó. Trả lời bằng tiếng Việt.\n\n{input}',
    tags: ['quiz', 'learning'],
    // Sinh quiz tu bai da doc → can tab noi co bai.
    tabCondition: { useCurrentTab: true, useSelectedTabs: false },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000008',
    name: 'kiem-tra-hieu',
    description: 'Kiểm tra hiểu bằng câu hỏi mở, không đưa đáp án sẵn',
    promptTemplate:
      'Kiểm tra mức độ hiểu của tôi về nội dung sau bằng 3 câu hỏi mở (không có đáp án sẵn, không gợi ý). Chỉ hỏi, không trả lời, không tóm tắt lại nội dung. Trả lời bằng tiếng Việt.\n\n{input}',
    tags: ['learning', 'quiz'],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000009',
    name: 'so-sanh-nhieu-tab',
    description: 'So sánh nội dung giữa nhiều tab đã chọn',
    promptTemplate:
      'So sánh nội dung của các trang được cung cấp: lập bảng đối chiếu các tiêu chí chính, chỉ ra điểm giống và điểm khác biệt nổi bật. Trả lời bằng tiếng Việt.\n\n{input}',
    tags: ['analysis', 'compare'],
    // So sanh nhieu trang → user chon tab nao se so sanh.
    tabCondition: { useCurrentTab: false, useSelectedTabs: true },
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
