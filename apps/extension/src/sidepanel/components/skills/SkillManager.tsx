import { useEffect, useMemo, useState } from 'react'
import { Copy, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Skill } from '@sidekick/shared'
import { Button } from '@/components/ui/button'
import { useSkillStore } from '@/sidepanel/store/skillStore'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { ConfirmDialog } from '@/sidepanel/components/chat/ConfirmDialog'

/**
 * Drawer quan ly skill (FR-SKILL-02/03 — T-M2-04).
 *
 * 2 nhom: **Co san** (built-in — chi dung, khong sua/xoa) · **Cua tao** (user
 * — sua / nhan ban / xoa).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

export interface SkillManagerProps {
  /** Dung skill nhanh → chen `/ten-skill` vao composer. */
  onUse: (skill: Skill) => void
  /** Mo form sua skill (khong truyen → chi dung nhanh). */
  onEdit?: (skill: Skill) => void
  /** Mo form tao skill moi. */
  onCreate?: () => void
}

export function SkillManager({ onUse, onEdit, onCreate }: SkillManagerProps) {
  const { t } = useI18n()
  const items = useSkillStore((state) => state.items)
  const isLoading = useSkillStore((state) => state.isLoading)
  const error = useSkillStore((state) => state.error)
  const refresh = useSkillStore((state) => state.refresh)
  const remove = useSkillStore((state) => state.remove)
  const duplicate = useSkillStore((state) => state.duplicate)

  const [pendingDelete, setPendingDelete] = useState<Skill | undefined>(undefined)

  // Nap danh sach skill 1 lan khi mo drawer.
  useEffect(() => {
    void refresh()
  }, [refresh])

  const builtin = useMemo(() => items.filter((item) => item.scope === 'builtin'), [items])
  const user = useMemo(() => items.filter((item) => item.scope === 'user'), [items])

  const handleDuplicate = async (skill: Skill): Promise<void> => {
    try {
      await duplicate(skill.id)
      toast.success(t('toast.skillDuplicated'))
    } catch {
      toast.error(t('toast.skillDuplicateFailed'))
    }
  }

  const handleDelete = async (): Promise<void> => {
    const target = pendingDelete
    if (target === undefined) return
    try {
      await remove(target.id)
      toast.success(t('toast.skillDeleted'))
    } catch {
      toast.error(t('toast.skillDeleteFailed'))
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="skill-manager">
      <div className="flex flex-col gap-[var(--space-2)] px-[var(--space-3)] pb-[var(--space-2)] pt-[var(--space-3)]">
        <h2 className="text-[length:var(--font-size-lg)] font-semibold text-[var(--text-primary)]">
          {t('skill.manager.title')}
        </h2>

        {onCreate !== undefined ? (
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={onCreate}
            data-testid="skill-new"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t('skill.manager.new')}
          </Button>
        ) : null}
      </div>

      {error !== undefined ? (
        <p
          className="px-[var(--space-3)] pb-[var(--space-2)] text-[length:var(--font-size-xs)] text-[var(--danger)]"
          role="alert"
          data-testid="skill-error"
        >
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-[var(--space-2)] pb-[var(--space-3)]">
        <SkillGroup
          title={t('skill.manager.builtin')}
          skills={builtin}
          onUse={onUse}
          onEdit={onEdit}
          onDuplicate={handleDuplicate}
          onRequestDelete={setPendingDelete}
        />
        <SkillGroup
          title={t('skill.manager.user')}
          skills={user}
          onUse={onUse}
          onEdit={onEdit}
          onDuplicate={handleDuplicate}
          onRequestDelete={setPendingDelete}
        />

        {!isLoading && items.length === 0 ? (
          <p
            className="px-[var(--space-2)] py-[var(--space-3)] text-[length:var(--font-size-sm)] text-[var(--text-tertiary)]"
            data-testid="skill-empty"
          >
            {t('skill.empty')}
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingDelete !== undefined}
        title={t('skill.manager.deleteTitle')}
        {...(pendingDelete !== undefined
          ? { description: t('skill.manager.deleteDescription', { name: pendingDelete.name }) }
          : {})}
        confirmLabel={t('common.delete')}
        destructive
        onOpenChange={(open) => {
          if (!open) setPendingDelete(undefined)
        }}
        onConfirm={handleDelete}
      />
    </div>
  )
}

/** Props cua 1 nhom skill. */
interface SkillGroupProps {
  title: string
  skills: readonly Skill[]
  onUse: (skill: Skill) => void
  onEdit: ((skill: Skill) => void) | undefined
  onDuplicate: (skill: Skill) => Promise<void>
  onRequestDelete: (skill: Skill) => void
}

/**
 * Mot nhom skill (co san / cua tao).
 */
function SkillGroup({
  title,
  skills,
  onUse,
  onEdit,
  onDuplicate,
  onRequestDelete,
}: SkillGroupProps) {
  const { t } = useI18n()

  if (skills.length === 0) return null

  return (
    <section className="mb-[var(--space-3)]" aria-label={title}>
      <h3 className="px-[var(--space-2)] pb-[var(--space-1)] text-[length:var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
        {title}
      </h3>
      <ul>
        {skills.map((skill) => {
          const isBuiltin = skill.scope === 'builtin'
          return (
            <li
              key={skill.id}
              className="group flex items-center gap-1 rounded-[var(--radius-sm)] px-[var(--space-1)] py-1 hover:bg-[var(--surface-sunken)]"
            >
              <button
                type="button"
                onClick={() => onUse(skill)}
                className="min-w-0 flex-1 rounded-[var(--radius-sm)] py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                aria-label={t('skill.manager.useLabel', { name: skill.name })}
                data-testid="skill-use"
                data-skill-name={skill.name}
              >
                <span className="block truncate text-[length:var(--font-size-sm)] text-[var(--text-primary)]">
                  {skill.name}
                </span>
                {skill.description.length > 0 ? (
                  <span className="block truncate text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                    {skill.description}
                  </span>
                ) : null}
              </button>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onUse(skill)}
                aria-label={t('skill.manager.use')}
                data-testid="skill-use-button"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>

              {isBuiltin ? null : (
                <>
                  {onEdit !== undefined ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(skill)}
                      aria-label={t('skill.manager.edit')}
                      data-testid="skill-edit"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  ) : null}

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      void onDuplicate(skill)
                    }}
                    aria-label={t('skill.manager.duplicate')}
                    data-testid="skill-duplicate"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRequestDelete(skill)}
                    aria-label={t('skill.manager.delete')}
                    data-testid="skill-delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
