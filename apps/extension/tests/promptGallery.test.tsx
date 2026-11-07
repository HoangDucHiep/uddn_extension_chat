import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { generalSuggestions, suggestionsForPage } from '@sidekick/shared'

import { PromptGallery } from '../src/sidepanel/components/chat/PromptGallery'

/**
 * Unit test cho `PromptGallery` (FR-UX-03 / FR-UX-04 — T-M1-11).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.12
 */

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PromptGallery', () => {
  it('render it nhat 3 chip goi y', () => {
    render(
      <PromptGallery
        profile="docs"
        pageTitle="React Hooks"
        suggestions={suggestionsForPage('docs', 'React Hooks')}
        onSelect={vi.fn()}
        onSummarize={vi.fn()}
        onRefresh={vi.fn()}
        canAttachPage
      />,
    )

    expect(screen.getAllByTestId('prompt-suggestion').length).toBeGreaterThanOrEqual(3)
  })

  it('bam chip → goi onSelect voi dung prompt', () => {
    const onSelect = vi.fn()
    const suggestions = suggestionsForPage('docs', 'React Hooks')

    render(
      <PromptGallery
        profile="docs"
        pageTitle="React Hooks"
        suggestions={suggestions}
        onSelect={onSelect}
        onSummarize={vi.fn()}
        onRefresh={vi.fn()}
        canAttachPage
      />,
    )

    fireEvent.click(screen.getAllByTestId('prompt-suggestion')[0] as HTMLElement)

    expect(onSelect).toHaveBeenCalledWith(suggestions[0]?.prompt)
  })

  it('bam nut lam moi → goi onRefresh', () => {
    const onRefresh = vi.fn()

    render(
      <PromptGallery
        profile="docs"
        pageTitle="React Hooks"
        suggestions={suggestionsForPage('docs', 'React Hooks')}
        onSelect={vi.fn()}
        onSummarize={vi.fn()}
        onRefresh={onRefresh}
        canAttachPage
      />,
    )

    fireEvent.click(screen.getByTestId('prompt-gallery-refresh'))

    expect(onRefresh).toHaveBeenCalled()
  })

  it('bam "Tom tat trang nay" → goi onSummarize', () => {
    const onSummarize = vi.fn()

    render(
      <PromptGallery
        profile="docs"
        pageTitle="React Hooks"
        suggestions={suggestionsForPage('docs', 'React Hooks')}
        onSelect={vi.fn()}
        onSummarize={onSummarize}
        onRefresh={vi.fn()}
        canAttachPage
      />,
    )

    fireEvent.click(screen.getByTestId('summarize-button'))

    expect(onSummarize).toHaveBeenCalled()
  })

  it('nut bi vo hieu hoa khi dang gui', () => {
    render(
      <PromptGallery
        profile="docs"
        pageTitle="React Hooks"
        suggestions={suggestionsForPage('docs', 'React Hooks')}
        onSelect={vi.fn()}
        onSummarize={vi.fn()}
        onRefresh={vi.fn()}
        isSending
        canAttachPage
      />,
    )

    expect((screen.getByTestId('summarize-button') as HTMLButtonElement).disabled).toBe(true)
    expect(
      (screen.getAllByTestId('prompt-suggestion')[0] as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('khong hien nut tom tat khi trang khong doc duoc', () => {
    render(
      <PromptGallery
        profile="general"
        pageTitle=""
        suggestions={generalSuggestions()}
        onSelect={vi.fn()}
        onSummarize={vi.fn()}
        onRefresh={vi.fn()}
        canAttachPage={false}
      />,
    )

    expect(screen.queryByTestId('summarize-button')).toBeNull()
    expect(screen.queryByTestId('prompt-gallery-notice')).toBeNull()
    expect(screen.getAllByTestId('prompt-suggestion').length).toBeGreaterThanOrEqual(3)
  })

  it('hien duong dan minh bach khi se tu dinh kem trang', () => {
    render(
      <PromptGallery
        profile="article"
        pageTitle="Bài viết"
        suggestions={suggestionsForPage('article', 'Bài viết')}
        onSelect={vi.fn()}
        onSummarize={vi.fn()}
        onRefresh={vi.fn()}
        canAttachPage
      />,
    )

    expect(screen.getByTestId('prompt-gallery-notice').textContent).toContain(
      'đính kèm trang này',
    )
  })

  it('dat data-profile de test doi tab', () => {
    render(
      <PromptGallery
        profile="forum"
        pageTitle="Câu hỏi"
        suggestions={suggestionsForPage('forum', 'Câu hỏi')}
        onSelect={vi.fn()}
        onSummarize={vi.fn()}
        onRefresh={vi.fn()}
        canAttachPage
      />,
    )

    expect(screen.getByTestId('prompt-gallery').getAttribute('data-profile')).toBe('forum')
  })
})
