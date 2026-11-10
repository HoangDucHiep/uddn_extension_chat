import { Globe, Layers } from 'lucide-react'
import { hasTabCondition, type Skill } from '@sidekick/shared'
import { useI18n } from '@/sidepanel/hooks/useI18n'

/**
 * Badge dieu kien tab cua skill (FR-SKILL-06 — T-M2-21).
 *
 * Skill co dieu kien → hien icon nho canh skill (menu `/` + thu vien) →
 * user biet skill se tu dinh kem context theo dieu kien.
 *
 * Khong hardcode mau — dung design token.
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.13
 */
export interface SkillConditionBadgeProps {
  /** Skill can hien badge. */
  skill: Skill
}

export function SkillConditionBadge({ skill }: SkillConditionBadgeProps) {
  const { t } = useI18n()
  const condition = skill.tabCondition

  if (!hasTabCondition(condition) || condition === undefined) return null

  const labels: string[] = []
  if (condition.useCurrentTab) labels.push(t('skill.form.useCurrentTab'))
  if (condition.useSelectedTabs) labels.push(t('skill.form.useSelectedTabs'))
  const summary = labels.join(' · ')

  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-[var(--radius-full)] bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
      data-testid="skill-condition-badge"
      title={summary}
    >
      {condition.useCurrentTab ? (
        <Globe className="h-3 w-3" aria-hidden="true" />
      ) : null}
      {condition.useSelectedTabs ? (
        <Layers className="h-3 w-3" aria-hidden="true" />
      ) : null}
      <span className="sr-only">{summary}</span>
    </span>
  )
}
