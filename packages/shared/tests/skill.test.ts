import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SKILL_TAB_CONDITION,
  filterSkills,
  hasTabCondition,
  matchesSkillPrefix,
  normalizeSkillName,
} from '../src/skill.js'
import {
  createSkillSchema,
  skillListQuerySchema,
  skillListResponseSchema,
  skillSchema,
  skillTabConditionSchema,
  updateSkillSchema,
} from '../src/schemas/skill.js'

/**
 * Test cho contract Skills (T-M2-04 — FR-SKILL-01/02/03).
 *
 * AC goc: "Menu lọc theo prefix; Enter chọn; Tab autocomplete" → phần
 * chuan hoa ten + lọc prefix nằm ở `packages/shared` → server + extension
 * dung chung 1 hành vi.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

describe('normalizeSkillName', () => {
  it('lowercase + bo dau tieng Viet', () => {
    expect(normalizeSkillName('Tóm Tắt')).toBe('tom-tat')
    expect(normalizeSkillName('Giải Thích Đơn Giản')).toBe('giai-thich-don-gian')
  })

  it('thay khoang trang va dau gach duoi bang dau gach', () => {
    expect(normalizeSkillName('dich nhanh')).toBe('dich-nhanh')
    expect(normalizeSkillName('viet_email')).toBe('viet-email')
  })

  it('ghep nhieu dau gach lien nhau + cat dau/cuoi', () => {
    expect(normalizeSkillName('--a  b--')).toBe('a-b')
  })

  it('ky tu khong hop le bi lo het → chuoi rong', () => {
    expect(normalizeSkillName('!!!')).toBe('')
    expect(normalizeSkillName('   ')).toBe('')
  })

  it('giu chu so', () => {
    expect(normalizeSkillName('skill 2026')).toBe('skill-2026')
  })
})

describe('matchesSkillPrefix', () => {
  it('chuoi rong → khop het', () => {
    expect(matchesSkillPrefix('tom-tat', '')).toBe(true)
    expect(matchesSkillPrefix('tom-tat', '   ')).toBe(true)
  })

  it('khop theo prefix', () => {
    expect(matchesSkillPrefix('tom-tat', 'tom')).toBe(true)
    expect(matchesSkillPrefix('tom-tat', 'tat')).toBe(false)
  })

  it('khong phan biet hoa thuong', () => {
    expect(matchesSkillPrefix('tom-tat', 'TOM')).toBe(true)
  })
})

describe('filterSkills', () => {
  const skills = [
    { name: 'tom-tat' },
    { name: 'dich' },
    { name: 'giai-thich-don-gian' },
  ]

  it('loc theo prefix, giu thu tu', () => {
    expect(filterSkills(skills, 'd').map((s) => s.name)).toEqual(['dich'])
    expect(filterSkills(skills, '').map((s) => s.name)).toEqual([
      'tom-tat',
      'dich',
      'giai-thich-don-gian',
    ])
  })

  it('khong co ket qua → mang rong', () => {
    expect(filterSkills(skills, 'zzz')).toEqual([])
  })
})

describe('createSkillSchema', () => {
  it('chuan hoa ten truoc khi validate', () => {
    const parsed = createSkillSchema.parse({
      name: 'Tóm Tắt',
      promptTemplate: 'Tóm tắt nội dung.',
    })
    expect(parsed.name).toBe('tom-tat')
    expect(parsed.description).toBe('')
    expect(parsed.tags).toEqual([])
  })

  it('prompt rong → sai', () => {
    expect(
      createSkillSchema.safeParse({ name: 'a', promptTemplate: '' }).success,
    ).toBe(false)
  })

  it('ten khong con ky tu hop le → sai', () => {
    expect(
      createSkillSchema.safeParse({ name: '!!!', promptTemplate: 'x' }).success,
    ).toBe(false)
  })
})

describe('updateSkillSchema', () => {
  it('cho phep doi 1 field', () => {
    const parsed = updateSkillSchema.parse({ enabled: false })
    expect(parsed.enabled).toBe(false)
  })

  it('khong co field → sai', () => {
    expect(updateSkillSchema.safeParse({}).success).toBe(false)
  })

  it('model null → xoa model', () => {
    const parsed = updateSkillSchema.parse({ model: null })
    expect(parsed.model).toBeNull()
  })
})

describe('skillSchema', () => {
  const base = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'tom-tat',
    description: 'Tóm tắt',
    promptTemplate: 'Tóm tắt nội dung.',
    scope: 'builtin' as const,
    enabled: true,
    tags: [],
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
  }

  it('parse skill hop le', () => {
    const parsed = skillSchema.parse(base)
    expect(parsed.name).toBe('tom-tat')
    expect(parsed.scope).toBe('builtin')
  })

  it('scope lao → sai', () => {
    expect(skillSchema.safeParse({ ...base, scope: 'khac' }).success).toBe(false)
  })

  it('id khong phai uuid → sai', () => {
    expect(skillSchema.safeParse({ ...base, id: 'abc' }).success).toBe(false)
  })
})

describe('skillListResponseSchema', () => {
  it('parse danh sach skill', () => {
    const parsed = skillListResponseSchema.parse({
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'tom-tat',
          description: '',
          promptTemplate: 'x',
          scope: 'builtin',
          enabled: true,
          tags: [],
          createdAt: '2026-11-10T00:00:00.000Z',
          updatedAt: '2026-11-10T00:00:00.000Z',
        },
      ],
    })
    expect(parsed.items).toHaveLength(1)
  })

  it('items thieu → sai', () => {
    expect(skillListResponseSchema.safeParse({}).success).toBe(false)
  })
})

// --- FR-SKILL-06 — T-M2-21 ---
describe('hasTabCondition', () => {
  it('undefined → false', () => {
    expect(hasTabCondition(undefined)).toBe(false)
  })

  it('ca 2 deu false → false', () => {
    expect(
      hasTabCondition({ useCurrentTab: false, useSelectedTabs: false }),
    ).toBe(false)
  })

  it('bat 1 dieu kien → true', () => {
    expect(hasTabCondition({ useCurrentTab: true, useSelectedTabs: false })).toBe(
      true,
    )
    expect(hasTabCondition({ useCurrentTab: false, useSelectedTabs: true })).toBe(
      true,
    )
  })

  it('dieu kien mac dinh → false', () => {
    expect(hasTabCondition(DEFAULT_SKILL_TAB_CONDITION)).toBe(false)
  })
})

describe('skillTabConditionSchema (FR-SKILL-06)', () => {
  it('parse dieu kien day du', () => {
    const parsed = skillTabConditionSchema.parse({
      useCurrentTab: true,
      useSelectedTabs: false,
    })
    expect(parsed.useCurrentTab).toBe(true)
    expect(parsed.useSelectedTabs).toBe(false)
  })

  it('thieu field → default false', () => {
    const parsed = skillTabConditionSchema.parse({})
    expect(parsed.useCurrentTab).toBe(false)
    expect(parsed.useSelectedTabs).toBe(false)
  })

  it('gia tri khong phai boolean → sai', () => {
    expect(skillTabConditionSchema.safeParse({ useCurrentTab: 'yes' }).success).toBe(
      false,
    )
  })

  it('createSkillSchema nhan tabCondition', () => {
    const parsed = createSkillSchema.parse({
      name: 'a',
      promptTemplate: 'x',
      tabCondition: { useCurrentTab: true, useSelectedTabs: false },
    })
    expect(parsed.tabCondition?.useCurrentTab).toBe(true)
  })

  it('updateSkillSchema nhan tabCondition', () => {
    const parsed = updateSkillSchema.parse({
      tabCondition: { useCurrentTab: false, useSelectedTabs: true },
    })
    expect(parsed.tabCondition?.useSelectedTabs).toBe(true)
  })
})

describe('skillListQuerySchema.tags (FR-SKILL-07)', () => {
  it('mang → giu nguyen', () => {
    const parsed = skillListQuerySchema.parse({ tags: ['a', 'b'] })
    expect(parsed.tags).toEqual(['a', 'b'])
  })

  it('chuoi tach bang dau phay → tach ra', () => {
    const parsed = skillListQuerySchema.parse({ tags: 'a, b' })
    expect(parsed.tags).toEqual(['a', 'b'])
  })

  it('khong co tags → undefined', () => {
    const parsed = skillListQuerySchema.parse({})
    expect(parsed.tags).toBeUndefined()
  })
})
