import { useEffect, useMemo, useState } from 'react'
import { Check, Globe, Layers, Loader2, Search, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { IconButton } from '@/components/ui/icon-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { OpenTab } from '@/lib/tabList'
import { useI18n } from '@/sidepanel/hooks/useI18n'

/**
 * `TabPicker` — chon **nhieu** tab mot luc (T-M3-POLISH — FR-CONTEXT-03).
 *
 * ## Vì sao cần?
 *
 * Luong cu: bam "Them trang nay" → phai **chuyen tab** qua lai → moi
 * dinh kem duoc trang dang active. Tot kieu 1 tab, rất mất công khi can
 * 2–3 nguon.
 *
 * Luong moi: bam nut "Tab" → **mo danh sach tab dang mo** → tick nhieu
 * tab → bam "Dinh kem" → tat ca cung duoc trich xuat va gom vao context
 * cua lượt chat.
 *
 * ## Vì sao tab la **one-shot**?
 *
 * Sau khi gửi tin nhắn, tab da dinh kem **bi loai khoi UI** va khong duoc
 * gui lai o lượt sau (chi dung 1 lan). Lich su hoi thoai van giu duoc
 * noi dung cua lượt do → van thao luan tiep duoc.
 * Xem `chatStore.consumeAttachments()` (FR-CONTEXT-03 — T-M3-POLISH).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.31
 */
export interface TabPickerProps {
  /** Danh sach tab dang mo (da loc trang dac biet). */
  tabs: readonly OpenTab[]
  /** Id cua tab dang active trong cua so hien tai. */
  activeTabId: number | undefined
  /** Id cac tab da dinh kem vao context (hien thi dau tick). */
  attachedTabIds: readonly number[]
  /** Dang tai danh sach tab. */
  isLoading?: boolean
  /** Nap lai danh sach tab (goi khi popover mo). */
  onReload?: (() => void) | undefined
  /**
   * Xac nhan danh sach tab da chon → dinh kem **tat ca** vao context.
   *
   * @param tabIds - Id cac tab user chon.
   */
  onAttachTabs: (tabIds: readonly number[]) => void
  /** So tab da chon (hien thi badge tren trigger). */
  selectedCount?: number
  /** Dang trich xuat → vo hieu hoa nut xac nhan. */
  isAttaching?: boolean
  /**
   * Tong so tab doc duoc trong cua so hien tai.
   *
   * Dung de hien thi chi bao "va N tab khac" khi danh sach bi cat boi
   * `limit` (khong am tham bo tab — T-M3-POLISH).
   */
  totalCount?: number | undefined
  /**
   * Trang thai mo cua popover (controlled).
   *
   * `undefined` → component tu quan ly (dung doc lap).
   * Cho phep parent mo picker tu nut o cho khac (vd nut "Chọn tab" trong
   * hang chip context) ma **chi co 1 popover** trong panel.
   */
  open?: boolean | undefined
  /**
   * Callback khi popover mo/dong.
   *
   * De parent nap danh sach tab chi khi picker thuc su mo (lazy).
   *
   * @param open - Popover dang mo hay dong.
   */
  onOpenChange?: (open: boolean) => void
}

export function TabPicker({
  tabs,
  activeTabId,
  attachedTabIds,
  isLoading = false,
  onReload,
  onAttachTabs,
  selectedCount = 0,
  isAttaching = false,
  totalCount,
  open,
  onOpenChange,
}: TabPickerProps) {
  const { t } = useI18n()
  const [internalOpen, setInternalOpen] = useState(false)
  /** Chuoi tim kiem trong popover. */
  const [query, setQuery] = useState('')
  /** Id tab user tick trong popover (chua commit). */
  const [draft, setDraft] = useState<readonly number[]>([])

  // Controlled (parent lo trang thai) hoac uncontrolled (tu quan ly).
  const isOpen = open ?? internalOpen
  const setIsOpen = (next: boolean): void => {
    setInternalOpen(next)
    onOpenChange?.(next)
  }

  // Mo popover → nap lai danh sach tab (tab co the da dong).
  useEffect(() => {
    if (!isOpen) return
    onReload?.()
  }, [isOpen, onReload])

  // Dong popover → bo draft (khong commit).
  useEffect(() => {
    if (isOpen) return
    setDraft([])
    setQuery('')
  }, [isOpen])

  // Tab da dinh kem truoc do → tick sẵn khi mo popover.
  useEffect(() => {
    if (!isOpen) return
    setDraft(attachedTabIds)
  }, [isOpen, attachedTabIds])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return tabs
    return tabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(q) ||
        tab.domain.toLowerCase().includes(q) ||
        tab.url.toLowerCase().includes(q),
    )
  }, [tabs, query])

  const toggle = (tabId: number): void => {
    setDraft((current) =>
      current.includes(tabId)
        ? current.filter((id) => id !== tabId)
        : [...current, tabId],
    )
  }

  const handleAttach = (): void => {
    if (draft.length === 0) return
    onAttachTabs(draft)
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex min-h-[24px] items-center gap-1 rounded-[var(--radius-full)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-[2px] text-[length:var(--font-size-xs)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              aria-label={t('context.tabPicker.open')}
              data-testid="context-tab-picker-trigger"
            >
              <Layers className="h-3 w-3" aria-hidden="true" />
              {t('context.tabPicker.openLabel')}
              {selectedCount > 0 ? (
                <span
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-accent)] px-1 text-[10px] font-semibold text-[var(--color-accent-fg)]"
                  data-testid="context-tab-picker-count"
                >
                  {selectedCount}
                </span>
              ) : null}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('context.tabPicker.open')}</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="start"
        side="top"
        className="w-[min(320px,calc(100vw-24px))] p-0"
        data-testid="context-tab-picker"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border-default)] px-[var(--space-3)] py-[var(--space-2)]">
          <Search
            className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
            placeholder={t('context.tabPicker.searchPlaceholder')}
            aria-label={t('context.tabPicker.searchPlaceholder')}
            data-testid="context-tab-picker-search"
            className="min-w-0 flex-1 rounded-[var(--radius-sm)] bg-transparent text-[length:var(--font-size-sm)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          />
          {query.length > 0 ? (
            <IconButton
              size="sm"
              aria-label={t('context.tabPicker.clearSearch')}
              onClick={() => {
                setQuery('')
              }}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </IconButton>
          ) : null}
        </div>

        <div className="max-h-[240px] overflow-y-auto p-1" data-testid="context-tab-picker-list">
          {isLoading && tabs.length === 0 ? (
            <p className="flex items-center gap-2 px-2 py-2 text-[length:var(--font-size-sm)] text-[var(--text-tertiary)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {t('context.mentionLoading')}
            </p>
          ) : null}

          {!isLoading && filtered.length === 0 ? (
            <p className="px-2 py-2 text-[length:var(--font-size-sm)] text-[var(--text-tertiary)]">
              {t('context.tabPicker.empty')}
            </p>
          ) : null}

          {filtered.map((tab) => {
            const checked = draft.includes(tab.id)
            const alreadyAttached = attachedTabIds.includes(tab.id)
            const isActive = tab.id === activeTabId

            return (
              <label
                key={tab.id}
                className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 transition-colors hover:bg-[var(--surface-sunken)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--border-focus)]"
                data-testid="context-tab-picker-option"
                data-tab-id={tab.id}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    toggle(tab.id)
                  }}
                  className="h-3.5 w-3.5 shrink-0 accent-[var(--color-accent)]"
                  aria-label={t('context.tabPicker.selectTab', { title: tab.title })}
                />

                {tab.favIconUrl !== undefined && tab.favIconUrl.length > 0 ? (
                  <img
                    src={tab.favIconUrl}
                    alt=""
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 rounded-[2px]"
                  />
                ) : (
                  <Globe
                    className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
                    aria-hidden="true"
                  />
                )}

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[length:var(--font-size-sm)] text-[var(--text-primary)]">
                    {tab.title}
                  </span>
                  <span className="block truncate text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                    {tab.domain}
                  </span>
                </span>

                {alreadyAttached ? (
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]"
                    aria-label={t('context.mentionAttached')}
                  />
                ) : isActive ? (
                  <span
                    className="h-3.5 w-0.5 shrink-0 rounded-[var(--radius-full)] bg-[var(--color-accent)]"
                    aria-label={t('context.mentionOpen')}
                  />
                ) : null}
              </label>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-default)] px-[var(--space-3)] py-[var(--space-2)]">
          <span
            className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
            data-testid="context-tab-picker-summary"
          >
            {t('context.tabPicker.selected', { count: draft.length })}
            {totalCount !== undefined && totalCount > tabs.length ? (
              <span className="ml-1" data-testid="context-tab-picker-more">
                {t('context.tabPicker.moreTabs', { count: totalCount - tabs.length })}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={handleAttach}
            disabled={draft.length === 0 || isAttaching}
            className="inline-flex h-7 items-center rounded-[var(--radius-full)] bg-[var(--color-accent)] px-3 text-[length:var(--font-size-xs)] font-medium text-[var(--color-accent-fg)] transition-colors hover:bg-[var(--color-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:pointer-events-none disabled:opacity-50"
            data-testid="context-tab-picker-attach"
          >
            {isAttaching ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
            ) : null}
            {t('context.tabPicker.attach')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
