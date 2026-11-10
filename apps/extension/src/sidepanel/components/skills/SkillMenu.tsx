import { useEffect, useMemo, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import { filterSkills, type Skill } from '@sidekick/shared'
import { useI18n } from '@/sidepanel/hooks/useI18n'

/**
 * Popover `/` — danh sach skill de goi nhanh (T-M2-04, FR-SKILL-01).
 *
 * - Loc theo **prefix** ten skill (AC FR-SKILL-01).
 * - `ArrowUp` / `ArrowDown` → doi dong active.
 * - `Enter` → chon skill (chen `/ten-skill ` vao textarea).
 * - `Tab` → autocomplete (chen ten day du).
 * - `Escape` → dong popover.
 *
 * Khong hardcode mau — dung design token.
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.12
 */

export interface SkillMenuProps {
  /** Danh sach skill (da loc trong hook). */
  skills: readonly Skill[]
  /** Chuoi da go sau dau `/`. */
  query: string
  /** Chi so dong dang active (keyboard navigation). */
  activeIndex: number
  /** Chon 1 skill. */
  onSelect: (skill: Skill) => void
}

export function SkillMenu({ skills, query, activeIndex, onSelect }: SkillMenuProps) {
  const { t } = useI18n()
  const listRef = useRef<HTMLUListElement>(null)

  // Danh sach sau khi loc prefix.
  const visible = useMemo(() => filterSkills(skills, query), [skills, query])

  // Cuon dong active vao khung nhin khi user bam Arrow lien tuc.
  useEffect(() => {
    const node = listRef.current
    if (node === null) return
    const option = node.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    option?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (visible.length === 0) {
    return (
      <div
        className="absolute bottom-full left-0 right-0 z-10 mb-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-2 shadow-[var(--shadow-2)]"
        data-testid="skill-popover"
        role="listbox"
        aria-label={t('skill.menuLabel')}
      >
        <p className="px-2 py-1 text-[length:var(--font-size-sm)] text-[var(--text-tertiary)]">
          {t('skill.empty')}
        </p>
      </div>
    )
  }

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-10 mb-1 max-h-[240px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-overlay)] p-1 shadow-[var(--shadow-2)]"
      data-testid="skill-popover"
      role="listbox"
      aria-label={t('skill.menuLabel')}
    >
      <ul ref={listRef}>
        {visible.map((skill, index) => {
          const isActive = index === activeIndex
          return (
            <li key={skill.id}>
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                data-testid="skill-option"
                data-index={index}
                data-skill-name={skill.name}
                onClick={() => {
                  onSelect(skill)
                }}
                className={[
                  'flex w-full items-start gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left',
                  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                  'focus-visible:outline-[var(--border-focus)]',
                  isActive ? 'bg-[var(--surface-sunken)]' : 'hover:bg-[var(--surface-sunken)]',
                ].join(' ')}
              >
                <Sparkles
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[length:var(--font-size-sm)] text-[var(--text-primary)]">
                    {skill.name}
                  </span>
                  {skill.description.length > 0 ? (
                    <span className="block truncate text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                      {skill.description}
                    </span>
                  ) : null}
                </span>
                <span
                  className="shrink-0 rounded-[var(--radius-full)] bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
                  data-testid="skill-scope"
                >
                  {skill.scope === 'builtin' ? t('skill.manager.builtin') : t('skill.manager.user')}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
