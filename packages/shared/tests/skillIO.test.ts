import { describe, expect, it } from 'vitest'
import type { Skill } from '@sidekick/shared'
import {
  buildSkillExport,
  buildSkillFileName,
  toImportableSkills,
  SKILL_IO_VERSION,
} from '../src/skillIO.js'
import {
  skillExportPayloadSchema,
  skillImportPayloadSchema,
} from '../src/schemas/skillIO.js'

/**
 * Test contract import/export skill JSON (T-M2-05 — FR-SKILL-05).
 *
 * AC goc: "Round-trip không mất dữ liệu".
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

/** Tao skill gia lap. */
function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'tom-tat',
    description: 'Tóm tắt',
    promptTemplate: 'Tóm tắt {input}',
    scope: 'user',
    enabled: true,
    tags: ['summary'],
    model: 'gemini-2.5-flash',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildSkillExport', () => {
  it('chi lay skill scope user', () => {
    const payload = buildSkillExport([
      skill({ scope: 'user', name: 'cua-toi' }),
      skill({ scope: 'builtin', name: 'co-san' }),
    ])

    expect(payload.skills).toHaveLength(1)
    expect(payload.skills[0]?.name).toBe('cua-toi')
  })

  it('co version + exportedAt', () => {
    const payload = buildSkillExport([skill()], new Date('2026-11-10T08:30:00.000Z'))

    expect(payload.version).toBe(SKILL_IO_VERSION)
    expect(payload.exportedAt).toBe('2026-11-10T08:30:00.000Z')
  })

  it('danh sach rong → skills rong', () => {
    expect(buildSkillExport([]).skills).toEqual([])
  })

  it('payload export validate duoc bang Zod', () => {
    const payload = buildSkillExport([skill()])
    expect(skillExportPayloadSchema.safeParse(payload).success).toBe(true)
  })
})

describe('toImportableSkills', () => {
  it('bo id / scope / timestamp', () => {
    const result = toImportableSkills({
      skills: [
        {
          name: 'tom-tat',
          description: 'Tóm tắt',
          promptTemplate: 'Tóm tắt {input}',
          tags: ['summary'],
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'tom-tat',
      description: 'Tóm tắt',
      promptTemplate: 'Tóm tắt {input}',
      tags: ['summary'],
    })
    expect(result[0]).not.toHaveProperty('id')
    expect(result[0]).not.toHaveProperty('scope')
  })

  it('chuan hoa ten thanh slug', () => {
    const result = toImportableSkills({
      skills: [
        { name: 'Tóm Tắt', description: '', promptTemplate: 'x', tags: [] },
      ],
    })

    expect(result[0]?.name).toBe('tom-tat')
  })

  it('ten rong sau chuan hoa → loai', () => {
    const result = toImportableSkills({
      skills: [{ name: '!!!', description: '', promptTemplate: 'x', tags: [] }],
    })

    expect(result).toEqual([])
  })

  it('trung ten trong cung file → chi giu ban dau', () => {
    const result = toImportableSkills({
      skills: [
        { name: 'a', description: '', promptTemplate: 'x', tags: [] },
        { name: 'a', description: 'khac', promptTemplate: 'y', tags: [] },
      ],
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.promptTemplate).toBe('x')
  })

  it('model rong → khong gan', () => {
    const result = toImportableSkills({
      skills: [
        { name: 'a', description: '', promptTemplate: 'x', tags: [], model: '   ' },
      ],
    })

    expect(result[0]).not.toHaveProperty('model')
  })

  it('tag rong → loai', () => {
    const result = toImportableSkills({
      skills: [
        { name: 'a', description: '', promptTemplate: 'x', tags: ['  ', 'email'] },
      ],
    })

    expect(result[0]?.tags).toEqual(['email'])
  })
})

describe('round-trip', () => {
  it('export → import → giu nguyen du lieu', () => {
    const original = skill({
      name: 'viet-email',
      description: 'Soạn email',
      promptTemplate: 'Viết email: {input}',
      tags: ['email', 'giao-dich'],
    })

    const payload = buildSkillExport([original])
    const parsed = skillExportPayloadSchema.parse(payload)
    const imported = toImportableSkills({
      skills: parsed.skills.map((item) => ({
        name: item.name,
        description: item.description,
        promptTemplate: item.promptTemplate,
        tags: item.tags,
        ...(item.model !== undefined ? { model: item.model } : {}),
      })),
    })

    expect(imported).toHaveLength(1)
    expect(imported[0]?.name).toBe(original.name)
    expect(imported[0]?.description).toBe(original.description)
    expect(imported[0]?.promptTemplate).toBe(original.promptTemplate)
    expect(imported[0]?.tags).toEqual(original.tags)
    expect(imported[0]?.model).toBe(original.model)
  })
})

describe('skillImportPayloadSchema', () => {
  it('skills rong → sai', () => {
    expect(skillImportPayloadSchema.safeParse({ skills: [] }).success).toBe(false)
  })

  it('thieu skills → sai', () => {
    expect(skillImportPayloadSchema.safeParse({}).success).toBe(false)
  })

  it('version khong bat buoc (user tu viet file)', () => {
    const parsed = skillImportPayloadSchema.safeParse({
      skills: [{ name: 'a', promptTemplate: 'x' }],
    })
    expect(parsed.success).toBe(true)
  })

  it('prompt rong → sai', () => {
    const parsed = skillImportPayloadSchema.safeParse({
      skills: [{ name: 'a', promptTemplate: '' }],
    })
    expect(parsed.success).toBe(false)
  })

  it('qua 100 skill → sai', () => {
    const skills = Array.from({ length: 101 }, (_, index) => ({
      name: `s-${index}`,
      promptTemplate: 'x',
    }))
    expect(skillImportPayloadSchema.safeParse({ skills }).success).toBe(false)
  })
})

describe('skillExportPayloadSchema', () => {
  it('version sai → sai', () => {
    const parsed = skillExportPayloadSchema.safeParse({
      version: 999,
      exportedAt: '2026-11-10T00:00:00.000Z',
      skills: [],
    })
    expect(parsed.success).toBe(false)
  })
})

describe('buildSkillFileName', () => {
  it('co ten + timestamp', () => {
    expect(buildSkillFileName(new Date(2026, 10, 10, 8, 30))).toBe(
      'sidekick-skills-20261110-0830.json',
    )
  })
})
