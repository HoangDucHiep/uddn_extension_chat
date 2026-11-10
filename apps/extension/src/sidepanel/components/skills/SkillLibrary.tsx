import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Play, Search } from 'lucide-react'
import type { Skill } from '@sidekick/shared'
import { listSkills } from '@/lib/skillClient'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { SkillConditionBadge } from './SkillConditionBadge'

/**
 * Trang duyet **thu vien skill** (FR-SKILL-07 — T-M2-06).
 *
 * - O tim kiem (loc theo ten / mo ta — query `q` cua server).
 * - Hang **chip tag**: bam de toggle loc (query `tags` cua server).
 * - Card: ten + mo ta + badge tag + badge pham vi.
 * - Click 1 card → **chay ngay** (chen `/ten-skill` vao composer).
 *
 * Loc chay **phia server** → khong phai tai toan bo skill ve client de loc.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25.9
 */

export interface SkillLibraryProps {
  /** Chay skill → chen `/ten-skill` vao composer (cha cha: dong drawer). */
  onUse: (skill: Skill) => void
}

export function SkillLibrary({ onUse }: SkillLibraryProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [items, setItems] = useState<Skill[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  /**
   * Nap danh sach skill theo bo loc hien tai.
   *
   * @param filters - Bo loc dang ap dung.
   */
  const load = useCallback(async (filters: { q: string; tags: string[] }): Promise<void> => {
    setIsLoading(true)
    setError(undefined)
    try {
      const result = await listSkills({
        ...(filters.q.length > 0 ? { q: filters.q } : {}),
        ...(filters.tags.length > 0 ? { tags: filters.tags } : {}),
      })
      setItems(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Nap lai khi bo loc (search / tag) thay doi.
  useEffect(() => {
    void load({ q: query.trim(), tags: activeTags })
  }, [load, query, activeTags])

  // Danh sach tag cho chip: suy ra tu **toan bo** skill (khong loc) → user
  // luon thay duoc het tag cua thu vien, ke ca khi dang loc.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const all = await listSkills()
        if (cancelled) return
        const tags = new Set<string>()
        for (const skill of all) {
          for (const tag of skill.tags) tags.add(tag)
        }
        setAllTags([...tags].sort((a, b) => a.localeCompare(b)))
      } catch {
        // Khong tai duoc danh sach tong → bo qua (chip tag chi la phu thu).
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** Bat/tat 1 chip tag. */
  const toggleTag = (tag: string): void => {
    setActiveTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    )
  }

  const isFiltered = useMemo(
    () => query.trim().length > 0 || activeTags.length > 0,
    [query, activeTags],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="skill-library">
      {/* O tim kiem */}
      <div className="px-[var(--space-2)] pb-[var(--space-2)]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
            placeholder={t('skill.library.searchPlaceholder')}
            aria-label={t('skill.library.searchLabel')}
            data-testid="skill-library-search"
            className={[
              'w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-panel)] py-1.5 pl-7 pr-2',
              'text-[length:var(--font-size-sm)] text-[var(--text-primary)]',
              'placeholder:text-[var(--text-tertiary)]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
            ].join(' ')}
          />
        </div>
      </div>

      {/* Hang chip tag */}
      {allTags.length > 0 ? (
        <div
          className="flex flex-wrap gap-1 px-[var(--space-2)] pb-[var(--space-2)]"
          role="group"
          aria-label={t('skill.library.tagFilterLabel')}
          data-testid="skill-library-tags"
        >
          {allTags.map((tag) => {
            const isActive = activeTags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={isActive}
                data-testid="skill-library-tag"
                data-tag={tag}
                onClick={() => {
                  toggleTag(tag)
                }}
                className={[
                  'rounded-[var(--radius-full)] px-2 py-0.5 text-[length:var(--font-size-xs)]',
                  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
                  isActive
                    ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                    : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]',
                ].join(' ')}
              >
                {tag}
              </button>
            )
          })}
        </div>
      ) : null}

      {error !== undefined ? (
        <p
          className="px-[var(--space-3)] pb-[var(--space-2)] text-[length:var(--font-size-xs)] text-[var(--danger)]"
          role="alert"
          data-testid="skill-library-error"
        >
          {error}
        </p>
      ) : null}

      {/* Danh sach card */}
      <div className="min-h-0 flex-1 overflow-y-auto px-[var(--space-2)] pb-[var(--space-3)]">
        {isLoading ? (
          <p
            className="flex items-center gap-2 px-[var(--space-2)] py-[var(--space-3)] text-[length:var(--font-size-sm)] text-[var(--text-tertiary)]"
            data-testid="skill-library-loading"
          >
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            {t('skill.library.loading')}
          </p>
        ) : null}

        {!isLoading && items.length === 0 ? (
          <p
            className="px-[var(--space-2)] py-[var(--space-3)] text-[length:var(--font-size-sm)] text-[var(--text-tertiary)]"
            data-testid="skill-library-empty"
          >
            {isFiltered ? t('skill.library.emptyFiltered') : t('skill.library.empty')}
          </p>
        ) : null}

        <ul className="flex flex-col gap-1">
          {items.map((skill) => (
            <li key={skill.id}>
              <button
                type="button"
                onClick={() => {
                  onUse(skill)
                }}
                data-testid="skill-library-item"
                data-skill-name={skill.name}
                className={[
                  'flex w-full flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--border-default)]',
                  'px-2 py-2 text-left transition-colors hover:bg-[var(--surface-sunken)]',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
                ].join(' ')}
              >
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-[length:var(--font-size-sm)] font-medium text-[var(--text-primary)]">
                    {skill.name}
                  </span>
                  <SkillConditionBadge skill={skill} />
                  <span
                    className="shrink-0 rounded-[var(--radius-full)] bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
                    data-testid="skill-library-scope"
                  >
                    {skill.scope === 'builtin'
                      ? t('skill.manager.builtin')
                      : t('skill.manager.user')}
                  </span>
                  <Play
                    className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]"
                    aria-hidden="true"
                  />
                </span>

                {skill.description.length > 0 ? (
                  <span className="block text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                    {skill.description}
                  </span>
                ) : null}

                {skill.tags.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {skill.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[var(--radius-full)] bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
                        data-testid="skill-library-item-tag"
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
