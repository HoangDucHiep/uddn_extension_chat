import { describe, expect, it } from 'vitest'
import { AppError, ERROR_CODES } from '@sidekick/shared'
import {
  createSkill,
  deleteSkill,
  listSkills,
  resolveSkillForChat,
  updateSkill,
} from '../src/services/skillService.js'
import { BUILTIN_SKILLS } from '../src/skills/builtin.js'
import { createFakeConversationDb } from './helpers/fakeConversationDb.js'

/**
 * Unit test cho `skillService` (T-M2-04 — FR-SKILL-01/02/03).
 *
 * AC goc: "Server resolve skill → nối `prompt_template` vào system prompt"
 * → phần resolve + CRUD test ở đây.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

describe('listSkills', () => {
  it('gop built-in truoc skill cua user', async () => {
    const fake = createFakeConversationDb()
    fake.seedSkill({ name: 'viet-email', scope: 'user' })

    const items = await listSkills(fake.db as never)

    expect(items[0]?.scope).toBe('builtin')
    expect(items.some((item) => item.name === 'viet-email')).toBe(true)
    expect(items.filter((item) => item.scope === 'builtin')).toHaveLength(
      BUILTIN_SKILLS.length,
    )
  })

  it('loc theo scope=builtin → chi co built-in', async () => {
    const fake = createFakeConversationDb()
    fake.seedSkill({ name: 'viet-email', scope: 'user' })

    const items = await listSkills(fake.db as never, { scope: 'builtin' })

    expect(items.every((item) => item.scope === 'builtin')).toBe(true)
  })

  it('loc theo scope=user → chi co skill cua user', async () => {
    const fake = createFakeConversationDb()
    fake.seedSkill({ name: 'viet-email', scope: 'user' })

    const items = await listSkills(fake.db as never, { scope: 'user' })

    expect(items).toHaveLength(1)
    expect(items[0]?.name).toBe('viet-email')
  })

  it('loc theo q (ten chua chuoi) → ket qua dung', async () => {
    const fake = createFakeConversationDb()
    fake.seedSkill({ name: 'soan-email-nhanh', scope: 'user' })

    const items = await listSkills(fake.db as never, { q: 'email' })

    // Built-in `viet-email` cung khop → chi assert skill cua user co mat.
    expect(items.some((item) => item.name === 'soan-email-nhanh')).toBe(true)
    expect(items.every((item) => item.name.includes('email'))).toBe(true)
  })

  it('skill user co model → tra kem model', async () => {
    const fake = createFakeConversationDb()
    fake.seedSkill({ name: 'viet-email', model: 'gpt-4o-mini' })

    const items = await listSkills(fake.db as never, { scope: 'user' })

    expect(items[0]?.model).toBe('gpt-4o-mini')
  })
})

describe('createSkill', () => {
  it('tao skill moi → scope=user, id uuid', async () => {
    const fake = createFakeConversationDb()

    const created = await createSkill(fake.db as never, {
      name: 'soan-mail',
      description: 'Soan email',
      promptTemplate: 'Soan email ngan gon.',
      tags: ['email'],
    })

    expect(created.name).toBe('soan-mail')
    expect(created.scope).toBe('user')
    expect(created.enabled).toBe(true)
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('ten trung → CONFLICT', async () => {
    const fake = createFakeConversationDb()
    fake.seedSkill({ name: 'soan-mail', scope: 'user' })

    await expect(
      createSkill(fake.db as never, {
        name: 'soan-mail',
        description: '',
        promptTemplate: 'x',
        tags: [],
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.CONFLICT })
  })

  it('ten trung voi built-in → CONFLICT', async () => {
    const fake = createFakeConversationDb()

    await expect(
      createSkill(fake.db as never, {
        name: 'tom-tat',
        description: '',
        promptTemplate: 'x',
        tags: [],
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.CONFLICT })
  })
})

describe('updateSkill', () => {
  it('sua field → tra skill moi', async () => {
    const fake = createFakeConversationDb()
    const row = fake.seedSkill({ name: 'viet-email' })

    const updated = await updateSkill(fake.db as never, row.id, {
      description: 'Mo ta moi',
    })

    expect(updated.description).toBe('Mo ta moi')
  })

  it('id khong ton tai → NOT_FOUND', async () => {
    const fake = createFakeConversationDb()

    await expect(
      updateSkill(fake.db as never, 'khong-ton-tai', { enabled: false }),
    ).rejects.toMatchObject({ code: ERROR_CODES.NOT_FOUND })
  })

  it('sua built-in → FORBIDDEN', async () => {
    const fake = createFakeConversationDb()
    const builtin = BUILTIN_SKILLS[0]

    await expect(
      updateSkill(fake.db as never, builtin?.id ?? '', { description: 'x' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.FORBIDDEN })
  })

  it('doi ten trung voi skill khac → CONFLICT', async () => {
    const fake = createFakeConversationDb()
    fake.seedSkill({ name: 'viet-email' })
    const other = fake.seedSkill({ name: 'viet-thu' })

    await expect(
      updateSkill(fake.db as never, other.id, { name: 'viet-email' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.CONFLICT })
  })
})

describe('deleteSkill', () => {
  it('xoa skill cua user → thanh cong', async () => {
    const fake = createFakeConversationDb()
    const row = fake.seedSkill({ name: 'viet-email' })

    await deleteSkill(fake.db as never, row.id)

    const items = await listSkills(fake.db as never, { scope: 'user' })
    expect(items).toHaveLength(0)
  })

  it('id khong ton tai → NOT_FOUND', async () => {
    const fake = createFakeConversationDb()

    await expect(deleteSkill(fake.db as never, 'khong-ton-tai')).rejects.toMatchObject({
      code: ERROR_CODES.NOT_FOUND,
    })
  })

  it('xoa built-in → FORBIDDEN', async () => {
    const fake = createFakeConversationDb()
    const builtin = BUILTIN_SKILLS[0]

    await expect(deleteSkill(fake.db as never, builtin?.id ?? '')).rejects.toMatchObject({
      code: ERROR_CODES.FORBIDDEN,
    })
  })
})

describe('resolveSkillForChat', () => {
  it('khong co skillId → undefined', async () => {
    const fake = createFakeConversationDb()
    expect(await resolveSkillForChat(fake.db as never, undefined)).toBeUndefined()
  })

  it('resolve built-in → tra promptTemplate + ten', async () => {
    const fake = createFakeConversationDb()
    const builtin = BUILTIN_SKILLS[0]

    const resolved = await resolveSkillForChat(fake.db as never, builtin?.id)

    expect(resolved?.promptTemplate).toBe(builtin?.promptTemplate)
    expect(resolved?.name).toBe(builtin?.name)
  })

  it('resolve skill cua user → tra promptTemplate + model', async () => {
    const fake = createFakeConversationDb()
    const row = fake.seedSkill({
      name: 'viet-email',
      promptTemplate: 'Soan email.',
      model: 'gpt-4o-mini',
    })

    const resolved = await resolveSkillForChat(fake.db as never, row.id)

    expect(resolved?.promptTemplate).toBe('Soan email.')
    expect(resolved?.model).toBe('gpt-4o-mini')
  })

  it('skill bi xoa → undefined (chat van chay binh thuong)', async () => {
    const fake = createFakeConversationDb()
    expect(await resolveSkillForChat(fake.db as never, 'khong-ton-tai')).toBeUndefined()
  })

  it('skill bi disable → undefined', async () => {
    const fake = createFakeConversationDb()
    const row = fake.seedSkill({ name: 'viet-email', enabled: false })

    expect(await resolveSkillForChat(fake.db as never, row.id)).toBeUndefined()
  })
})

describe('AppError shape', () => {
  it('AppError mang code chuan', () => {
    const error = new AppError(ERROR_CODES.NOT_FOUND, 'Khong tim thay skill')
    expect(error.code).toBe(ERROR_CODES.NOT_FOUND)
    expect(error.status).toBe(404)
  })
})

// --- FR-SKILL-04/06 — T-M2-21 ---
describe('registry skill co san (FR-SKILL-04 — T-M2-21)', () => {
  it('co it nhat 8 skill', () => {
    expect(BUILTIN_SKILLS.length).toBeGreaterThanOrEqual(8)
  })

  it('ten khong trung nhau', () => {
    const names = BUILTIN_SKILLS.map((skill) => skill.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('id on dinh, khong trung nhau, dung dinh dang uuid', () => {
    const ids = BUILTIN_SKILLS.map((skill) => skill.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    }
  })

  it('moi skill deu co it nhat 1 tag', () => {
    for (const skill of BUILTIN_SKILLS) {
      expect(skill.tags.length).toBeGreaterThan(0)
    }
  })

  it('promptTemplate co placeholder {input}', () => {
    for (const skill of BUILTIN_SKILLS) {
      expect(skill.promptTemplate).toContain('{input}')
    }
  })
})

describe('loc theo tag (FR-SKILL-07 — T-M2-06)', () => {
  it('loc built-in theo tag', async () => {
    const fake = createFakeConversationDb()

    const items = await listSkills(fake.db as never, { tags: ['summary'] })

    expect(items.length).toBeGreaterThan(0)
    expect(items.every((item) => item.tags.includes('summary'))).toBe(true)
  })

  it('loc ca built-in lan skill cua user theo tag', async () => {
    const fake = createFakeConversationDb()
    fake.seedSkill({ name: 've-email', tags: ['email'] })

    const items = await listSkills(fake.db as never, { tags: ['email'] })

    expect(items.some((item) => item.scope === 'builtin')).toBe(true)
    expect(items.some((item) => item.name === 've-email')).toBe(true)
  })

  it('che do any — khop it nhat 1 tag', async () => {
    const fake = createFakeConversationDb()
    fake.seedSkill({ name: 've-email', tags: ['email'] })

    const items = await listSkills(fake.db as never, { tags: ['email', 'khong-ton-tai'] })

    expect(items.some((item) => item.name === 've-email')).toBe(true)
  })

  it('tag khong khop → rong', async () => {
    const fake = createFakeConversationDb()
    fake.seedSkill({ name: 've-email', tags: ['email'] })

    const items = await listSkills(fake.db as never, { tags: ['khong-ton-tai'] })

    expect(items).toHaveLength(0)
  })
})

describe('tabCondition (FR-SKILL-06 — T-M2-21)', () => {
  it('tao skill co dieu kien tab → round-trip', async () => {
    const fake = createFakeConversationDb()

    const created = await createSkill(fake.db as never, {
      name: 'so-sanh-tab-cua-toi',
      description: '',
      promptTemplate: 'So sanh',
      tags: [],
      tabCondition: { useCurrentTab: false, useSelectedTabs: true },
    })

    expect(created.tabCondition).toEqual({
      useCurrentTab: false,
      useSelectedTabs: true,
    })
  })

  it('skill khong co dieu kien tab → undefined', async () => {
    const fake = createFakeConversationDb()

    const created = await createSkill(fake.db as never, {
      name: 've-email',
      description: '',
      promptTemplate: 'Ve email',
      tags: [],
    })

    expect(created.tabCondition).toBeUndefined()
  })

  it('sua dieu kien tab → cap nhat', async () => {
    const fake = createFakeConversationDb()
    const row = fake.seedSkill({ name: 've-email' })

    const updated = await updateSkill(fake.db as never, row.id, {
      tabCondition: { useCurrentTab: true, useSelectedTabs: false },
    })

    expect(updated.tabCondition).toEqual({
      useCurrentTab: true,
      useSelectedTabs: false,
    })
  })

  it('built-in co dieu kien tab → listSkills tra kem', async () => {
    const fake = createFakeConversationDb()

    const items = await listSkills(fake.db as never, { scope: 'builtin' })
    const withCondition = items.filter((item) => item.tabCondition !== undefined)

    expect(withCondition.length).toBeGreaterThan(0)
  })
})
