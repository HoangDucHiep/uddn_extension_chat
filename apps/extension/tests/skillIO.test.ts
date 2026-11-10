import { describe, expect, it, vi } from 'vitest'
import type { Skill } from '@sidekick/shared'

const downloadTextFileMock = vi.fn()

vi.mock('@/lib/downloadFile', () => ({
  downloadTextFile: (fileName: string, content: string, mimeType: string) =>
    downloadTextFileMock(fileName, content, mimeType),
}))

const { exportSkillsFile, importSkillsFile } = await import('../src/lib/skillIO')

/**
 * Unit test cho import/export skill JSON phia extension (T-M2-05 —
 * FR-SKILL-05).
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
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

/** Tao `File` gia lap voi noi dung cho truoc. */
function fileWith(content: string, name = 'skills.json'): File {
  return {
    name,
    text: async () => content,
  } as unknown as File
}

describe('exportSkillsFile', () => {
  it('tao file JSON dung ten co timestamp', () => {
    downloadTextFileMock.mockClear()

    const fileName = exportSkillsFile([skill()], new Date(2026, 10, 10, 8, 30))

    expect(fileName).toBe('sidekick-skills-20261110-0830.json')
    expect(downloadTextFileMock).toHaveBeenCalledTimes(1)

    const [, content, mime] = downloadTextFileMock.mock.calls[0] ?? []
    expect(mime).toBe('application/json')

    const payload = JSON.parse(String(content)) as { version: number; skills: unknown[] }
    expect(payload.version).toBe(1)
    expect(payload.skills).toHaveLength(1)
  })

  it('khong export skill built-in', () => {
    downloadTextFileMock.mockClear()

    exportSkillsFile([skill({ scope: 'builtin' })])

    const [, content] = downloadTextFileMock.mock.calls[0] ?? []
    const payload = JSON.parse(String(content)) as { skills: unknown[] }
    expect(payload.skills).toHaveLength(0)
  })
})

describe('importSkillsFile', () => {
  it('doc file hop le → danh sach input tao skill', async () => {
    const content = JSON.stringify({
      version: 1,
      exportedAt: '2026-11-10T00:00:00.000Z',
      skills: [
        {
          id: 'a1000000-0000-4000-8000-000000000001',
          name: 'viet-email',
          description: 'Soạn email',
          promptTemplate: 'Viết email: {input}',
          scope: 'user',
          enabled: true,
          tags: ['email'],
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
        },
      ],
    })

    const result = await importSkillsFile(fileWith(content))

    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('viet-email')
    expect(result[0]).not.toHaveProperty('id')
  })

  it('file khong phai JSON → throw loi ro rang', async () => {
    await expect(importSkillsFile(fileWith('khong phai json'))).rejects.toThrow(/JSON/)
  })

  it('file sai shape → throw loi kem field', async () => {
    const content = JSON.stringify({ skills: [{ name: 'a' }] })

    await expect(importSkillsFile(fileWith(content))).rejects.toThrow(/promptTemplate/)
  })

  it('file rong skills → throw', async () => {
    await expect(importSkillsFile(fileWith(JSON.stringify({ skills: [] })))).rejects.toThrow()
  })
})
