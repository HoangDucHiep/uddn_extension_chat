import { useEffect, useState } from 'react'
import {
  createSkillSchema,
  normalizeSkillName,
  updateSkillSchema,
  type Skill,
} from '@sidekick/shared'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/sidepanel/hooks/useI18n'

/**
 * Form tao / sua skill (FR-SKILL-02/03 — T-M2-04).
 *
 * Validate bang **Zod schema** cua `packages/shared` → server + client dung
 * chung 1 quy tac.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.13
 */

export interface SkillFormDialogProps {
  /** Dialog co mo hay khong. */
  open: boolean
  /** Skill dang sua (`undefined` → dang tao moi). */
  skill: Skill | undefined
  /** Noi dung prefill khi tao tu prompt cua user (FR-SKILL-02). */
  initialPrompt: string | undefined
  /** Dong dialog. */
  onOpenChange: (open: boolean) => void
  /** Luu → tra ve skill da luu. */
  onSubmit: (values: {
    name: string
    description: string
    promptTemplate: string
    model: string | undefined
    tags: string[]
  }) => Promise<void>
}

export function SkillFormDialog({
  open,
  skill,
  initialPrompt,
  onOpenChange,
  onSubmit,
}: SkillFormDialogProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [promptTemplate, setPromptTemplate] = useState('')
  const [model, setModel] = useState('')
  const [tags, setTags] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const [isBusy, setIsBusy] = useState(false)

  const isEditing = skill !== undefined

  // Nap gia tri ban dau khi mo dialog (tao moi hoac sua skill).
  useEffect(() => {
    if (!open) return
    setName(skill?.name ?? '')
    setDescription(skill?.description ?? '')
    setPromptTemplate(skill?.promptTemplate ?? initialPrompt ?? '')
    setModel(skill?.model ?? '')
    setTags(skill?.tags.join(', ') ?? '')
    setError(undefined)
  }, [open, skill, initialPrompt])

  // Ten da chuan hoa (slug) — hien thi de user biet se go bang `/slug`.
  const slugPreview = normalizeSkillName(name)

  const handleSubmit = async (): Promise<void> => {
    const payload = {
      name,
      description,
      promptTemplate,
      ...(model.trim().length > 0 ? { model: model.trim() } : {}),
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    }

    // Ten: khi sua → co thể giu nguyen ten cu (chuoi rong → bo qua).
    const parsed = isEditing
      ? updateSkillSchema.safeParse({
          ...(name.trim().length > 0 ? { name } : {}),
          description: payload.description,
          promptTemplate: payload.promptTemplate,
          ...(payload.model !== undefined ? { model: payload.model } : {}),
          ...(payload.tags.length > 0 ? { tags: payload.tags } : {}),
        })
      : createSkillSchema.safeParse(payload)

    if (!parsed.success) {
      setError(t('skill.form.invalid'))
      return
    }

    // Ten chuan hoa (slug) — server cung chuan hoa lai → phai khop.
    const finalName =
      'name' in parsed.data && parsed.data.name !== undefined
        ? parsed.data.name
        : normalizeSkillName(name)

    setIsBusy(true)
    try {
      await onSubmit({
        name: finalName,
        description: payload.description,
        promptTemplate: payload.promptTemplate,
        model: payload.model,
        tags: payload.tags,
      })
      onOpenChange(false)
    } catch {
      setError(t('skill.form.saveFailed'))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="left-1/2 top-1/2 h-auto max-h-[85vh] w-[min(420px,92vw)] max-w-full -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-default)]"
        data-testid="skill-form"
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? t('skill.form.editTitle') : t('skill.form.newTitle')}</DialogTitle>
          <DialogDescription>{t('skill.form.description')}</DialogDescription>
        </DialogHeader>

        <form
          className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)]"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor="skill-form-name"
              className="text-[length:var(--font-size-sm)] font-medium text-[var(--text-secondary)]"
            >
              {t('skill.form.name')}
            </label>
            <Input
              id="skill-form-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('skill.form.namePlaceholder')}
              aria-label={t('skill.form.name')}
              data-testid="skill-form-name"
            />
            {name.length > 0 ? (
              <p
                className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
                data-testid="skill-form-slug"
              >
                {t('skill.form.slugPreview', { slug: slugPreview })}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="skill-form-description"
              className="text-[length:var(--font-size-sm)] font-medium text-[var(--text-secondary)]"
            >
              {t('skill.form.descriptionLabel')}
            </label>
            <Input
              id="skill-form-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('skill.form.descriptionPlaceholder')}
              aria-label={t('skill.form.descriptionLabel')}
              data-testid="skill-form-description"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="skill-form-prompt"
              className="text-[length:var(--font-size-sm)] font-medium text-[var(--text-secondary)]"
            >
              {t('skill.form.prompt')}
            </label>
            <Textarea
              id="skill-form-prompt"
              value={promptTemplate}
              onChange={(event) => setPromptTemplate(event.target.value)}
              placeholder={t('skill.form.promptPlaceholder')}
              aria-label={t('skill.form.prompt')}
              data-testid="skill-form-prompt"
              className="min-h-[120px]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="skill-form-model"
              className="text-[length:var(--font-size-sm)] font-medium text-[var(--text-secondary)]"
            >
              {t('skill.form.model')}
            </label>
            <Input
              id="skill-form-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={t('skill.form.modelPlaceholder')}
              aria-label={t('skill.form.model')}
              data-testid="skill-form-model"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="skill-form-tags"
              className="text-[length:var(--font-size-sm)] font-medium text-[var(--text-secondary)]"
            >
              {t('skill.form.tags')}
            </label>
            <Input
              id="skill-form-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder={t('skill.form.tagsPlaceholder')}
              aria-label={t('skill.form.tags')}
              data-testid="skill-form-tags"
            />
          </div>

          {error !== undefined ? (
            <p
              className="text-[length:var(--font-size-xs)] text-[var(--danger)]"
              role="alert"
              data-testid="skill-form-error"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter className="mt-[var(--space-2)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isBusy}
              data-testid="skill-form-cancel"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isBusy}
              data-testid="skill-form-submit"
            >
              {t('skill.form.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
