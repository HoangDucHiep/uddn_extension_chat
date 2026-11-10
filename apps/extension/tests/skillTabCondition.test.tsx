import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Skill } from '@sidekick/shared'

const { SkillFormDialog } = await import('../src/sidepanel/components/skills/SkillFormDialog')
const { SkillConditionBadge } = await import(
  '../src/sidepanel/components/skills/SkillConditionBadge'
)
const { SkillTabPicker } = await import('../src/sidepanel/components/skills/SkillTabPicker')

/**
 * Unit test cho dieu kien tab cua skill (FR-SKILL-06 — T-M2-21).
 *
 * Kiem chung: checkbox trong form · badge dieu kien · popover chon tab.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25.10
 */

/** Tao skill gia lap. */
function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'tom-tat',
    description: 'Tóm tắt',
    promptTemplate: 'Tóm tắt {input}',
    scope: 'builtin',
    enabled: true,
    tags: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('SkillFormDialog — dieu kien tab', () => {
  it('hien 2 checkbox dieu kien tab', () => {
    render(
      <SkillFormDialog
        open
        skill={undefined}
        initialPrompt={undefined}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByTestId('skill-form-use-current-tab')).toBeTruthy()
    expect(screen.getByTestId('skill-form-use-selected-tabs')).toBeTruthy()
  })

  it('tick "tab hien tai" → gui tabCondition khi luu', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <SkillFormDialog
        open
        skill={undefined}
        initialPrompt={undefined}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByTestId('skill-form-name'), { target: { value: 'so-sanh' } })
    fireEvent.change(screen.getByTestId('skill-form-prompt'), {
      target: { value: 'So sanh {input}' },
    })
    fireEvent.click(screen.getByTestId('skill-form-use-current-tab'))
    fireEvent.click(screen.getByTestId('skill-form-submit'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
    expect((onSubmit.mock.calls[0]?.[0] as { tabCondition?: unknown }).tabCondition).toEqual({
      useCurrentTab: true,
      useSelectedTabs: false,
    })
  })

  it('tick "tab duoc chon" → gui tabCondition khi luu', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <SkillFormDialog
        open
        skill={undefined}
        initialPrompt={undefined}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByTestId('skill-form-name'), { target: { value: 'so-sanh' } })
    fireEvent.change(screen.getByTestId('skill-form-prompt'), {
      target: { value: 'So sanh {input}' },
    })
    fireEvent.click(screen.getByTestId('skill-form-use-selected-tabs'))
    fireEvent.click(screen.getByTestId('skill-form-submit'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
    expect((onSubmit.mock.calls[0]?.[0] as { tabCondition?: unknown }).tabCondition).toEqual({
      useCurrentTab: false,
      useSelectedTabs: true,
    })
  })

  it('khong tick dieu kien nao → tao moi khong gui tabCondition', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <SkillFormDialog
        open
        skill={undefined}
        initialPrompt={undefined}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByTestId('skill-form-name'), { target: { value: 've-email' } })
    fireEvent.change(screen.getByTestId('skill-form-prompt'), {
      target: { value: 'Ve email {input}' },
    })
    fireEvent.click(screen.getByTestId('skill-form-submit'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
    expect(
      (onSubmit.mock.calls[0]?.[0] as { tabCondition?: unknown }).tabCondition,
    ).toBeUndefined()
  })

  it('sua skill co dieu kien → checkbox da tick', () => {
    render(
      <SkillFormDialog
        open
        skill={skill({
          scope: 'user',
          tabCondition: { useCurrentTab: true, useSelectedTabs: false },
        })}
        initialPrompt={undefined}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    expect(
      (screen.getByTestId('skill-form-use-current-tab') as HTMLInputElement).checked,
    ).toBe(true)
    expect(
      (screen.getByTestId('skill-form-use-selected-tabs') as HTMLInputElement).checked,
    ).toBe(false)
  })
})

describe('SkillConditionBadge', () => {
  it('skill khong dieu kien → khong hien badge', () => {
    render(<SkillConditionBadge skill={skill()} />)

    expect(screen.queryByTestId('skill-condition-badge')).toBeNull()
  })

  it('skill co dieu kien → hien badge', () => {
    render(
      <SkillConditionBadge
        skill={skill({ tabCondition: { useCurrentTab: true, useSelectedTabs: false } })}
      />,
    )

    expect(screen.getByTestId('skill-condition-badge')).toBeTruthy()
  })
})

describe('SkillTabPicker', () => {
  it('hien danh sach tab va goi onSelect', () => {
    const onSelect = vi.fn()
    render(
      <SkillTabPicker
        tabs={[
          { id: 1, title: 'Trang 1', url: 'https://a.com', domain: 'a.com', active: true },
        ]}
        activeTabId={1}
        attachedTabIds={[]}
        onSelect={onSelect}
      />,
    )

    const options = screen.getAllByTestId('skill-tab-option')
    expect(options).toHaveLength(1)

    fireEvent.click(options[0] as HTMLElement)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('khong co tab → hien thong bao rong', () => {
    render(
      <SkillTabPicker tabs={[]} activeTabId={undefined} attachedTabIds={[]} onSelect={vi.fn()} />,
    )

    expect(screen.getByTestId('skill-tab-picker')).toBeTruthy()
    expect(screen.queryAllByTestId('skill-tab-option')).toHaveLength(0)
  })
})
