import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, ArchiveRestore, MessageSquarePlus, Pencil, Pin, PinOff, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ConversationSummary } from '@sidekick/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConversationStore } from '../../store/conversationStore'
import { ConfirmDialog } from './ConfirmDialog'

/**
 * Drawer danh sach cuoc tro chuyen (FR-CHAT-08/09/11 — T-M1-09).
 *
 * 3 nhom: **Đã ghim** / **Gần đây** / **Đã lưu trữ** · search theo tên ·
 * CRUD (tạo / đổi tên / xoá / ghim / lưu trữ) phản ánh trong UI ngay.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.10
 */

/** Do dai debounce cho o search (ms). */
const SEARCH_DEBOUNCE_MS = 250

export interface ConversationListProps {
  /** Chon 1 conversation → tai lai lich su. */
  onSelect: (id: string) => void
  /** Tao chat moi (thread trong panel duoc xoa) — nhan id conversation vua tao. */
  onCreate: (id: string) => void
}

export function ConversationList({ onSelect, onCreate }: ConversationListProps) {
  const items = useConversationStore((state) => state.items)
  const isLoading = useConversationStore((state) => state.isLoading)
  const error = useConversationStore((state) => state.error)
  const query = useConversationStore((state) => state.query)
  const archivedView = useConversationStore((state) => state.archivedView)
  const activeConversationId = useConversationStore((state) => state.activeConversationId)

  const refresh = useConversationStore((state) => state.refresh)
  const setQuery = useConversationStore((state) => state.setQuery)
  const setArchivedView = useConversationStore((state) => state.setArchivedView)
  const create = useConversationStore((state) => state.create)
  const rename = useConversationStore((state) => state.rename)
  const togglePin = useConversationStore((state) => state.togglePin)
  const toggleArchive = useConversationStore((state) => state.toggleArchive)
  const remove = useConversationStore((state) => state.remove)

  const [searchValue, setSearchValue] = useState(query)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [editingTitle, setEditingTitle] = useState('')
  const [pendingDelete, setPendingDelete] = useState<ConversationSummary | undefined>(undefined)

  const editingInputRef = useRef<HTMLInputElement>(null)
  // Nap danh sach lan dau + khi chuyen sang/ra khoang luu tru.
  useEffect(() => {
    void refresh()
  }, [refresh, archivedView])

  // Debounce search → khong goi API moi sau moi phim.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue === query) return
      setQuery(searchValue)
      void refresh()
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
    // `refresh` la function store (Zustand) → danh tinh, khong can dua vao deps.
  }, [searchValue, query, setQuery, refresh])

  // Focus o input khi bat dau sua ten.
  useEffect(() => {
    if (editingId !== undefined) {
      editingInputRef.current?.focus()
      editingInputRef.current?.select()
    }
  }, [editingId])

  const pinned = useMemo(() => items.filter((item) => item.pinned), [items])
  const recent = useMemo(
    () => items.filter((item) => !item.pinned && !item.archived),
    [items],
  )

  const handleCreate = async (): Promise<void> => {
    try {
      const created = await create()
      onCreate(created.id)
      toast.success('Đã tạo cuộc trò chuyện mới')
    } catch {
      toast.error('Không tạo được cuộc trò chuyện mới')
    }
  }
  const startRename = (item: ConversationSummary): void => {
    setEditingId(item.id)
    setEditingTitle(item.title)
  }

  const commitRename = async (id: string): Promise<void> => {
    const title = editingTitle.trim()
    setEditingId(undefined)
    if (title.length === 0) return
    try {
      await rename(id, title)
    } catch {
      toast.error('Không đổi được tên cuộc trò chuyện')
    }
  }

  const handleTogglePin = async (item: ConversationSummary): Promise<void> => {
    try {
      await togglePin(item.id)
      toast.success(item.pinned ? 'Đã bỏ ghim' : 'Đã ghim cuộc trò chuyện')
    } catch {
      toast.error('Không cập nhật được trạng thái ghim')
    }
  }

  const handleToggleArchive = async (item: ConversationSummary): Promise<void> => {
    try {
      await toggleArchive(item.id)
      toast.success(item.archived ? 'Đã khôi phục cuộc trò chuyện' : 'Đã lưu trữ cuộc trò chuyện')
    } catch {
      toast.error('Không lưu trữ được cuộc trò chuyện')
    }
  }

  const handleDelete = async (): Promise<void> => {
    const target = pendingDelete
    if (target === undefined) return
    try {
      await remove(target.id)
      toast.success('Đã xoá cuộc trò chuyện')
    } catch {
      toast.error('Không xoá được cuộc trò chuyện')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="conversation-list">
      <div className="flex flex-col gap-[var(--space-2)] px-[var(--space-3)] pb-[var(--space-2)] pt-[var(--space-3)]">
        <h2 className="text-[length:var(--font-size-lg)] font-semibold text-[var(--text-primary)]">
          Cuộc trò chuyện
        </h2>

        <Button
          variant="default"
          size="sm"
          className="w-full"
          onClick={() => {
            void handleCreate()
          }}
          data-testid="conversation-new"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
          Chat mới
        </Button>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]"
            aria-hidden="true"
          />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Tìm cuộc trò chuyện…"
            aria-label="Tìm cuộc trò chuyện theo tên"
            className="pl-7"
            data-testid="conversation-search"
          />
        </div>

        <div className="flex gap-1" role="tablist" aria-label="Nhóm cuộc trò chuyện">
          <button
            type="button"
            role="tab"
            aria-selected={!archivedView}
            onClick={() => setArchivedView(false)}
            className={[
              'rounded-[var(--radius-sm)] px-2 py-1 text-[length:var(--font-size-xs)]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
              archivedView
                ? 'text-[var(--text-secondary)]'
                : 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-hover)] font-semibold',
            ].join(' ')}
            data-testid="conversation-tab-active"
          >
            Đang dùng
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={archivedView}
            onClick={() => setArchivedView(true)}
            className={[
              'rounded-[var(--radius-sm)] px-2 py-1 text-[length:var(--font-size-xs)]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
              archivedView
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-hover)] font-semibold'
                : 'text-[var(--text-secondary)]',
            ].join(' ')}
            data-testid="conversation-tab-archived"
          >
            Đã lưu trữ
          </button>
        </div>
      </div>

      {error !== undefined ? (
        <p
          className="px-[var(--space-3)] pb-[var(--space-2)] text-[length:var(--font-size-xs)] text-[var(--danger)]"
          role="alert"
          data-testid="conversation-error"
        >
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-[var(--space-2)] pb-[var(--space-3)]">
        {archivedView ? (
          <ConversationGroup
            title="Đã lưu trữ"
            items={items}
            activeConversationId={activeConversationId}
            editingId={editingId}
            editingTitle={editingTitle}
            editingInputRef={editingInputRef}
            onEditingTitleChange={setEditingTitle}
            onCommitRename={commitRename}
            onCancelRename={() => setEditingId(undefined)}
            onSelect={onSelect}
            onStartRename={startRename}
            onTogglePin={handleTogglePin}
            onToggleArchive={handleToggleArchive}
            onRequestDelete={setPendingDelete}
          />
        ) : (
          <>
            <ConversationGroup
              title="Đã ghim"
              items={pinned}
              activeConversationId={activeConversationId}
              editingId={editingId}
              editingTitle={editingTitle}
              editingInputRef={editingInputRef}
              onEditingTitleChange={setEditingTitle}
              onCommitRename={commitRename}
              onCancelRename={() => setEditingId(undefined)}
              onSelect={onSelect}
              onStartRename={startRename}
              onTogglePin={handleTogglePin}
              onToggleArchive={handleToggleArchive}
              onRequestDelete={setPendingDelete}
            />
            <ConversationGroup
              title="Gần đây"
              items={recent}
              activeConversationId={activeConversationId}
              editingId={editingId}
              editingTitle={editingTitle}
              editingInputRef={editingInputRef}
              onEditingTitleChange={setEditingTitle}
              onCommitRename={commitRename}
              onCancelRename={() => setEditingId(undefined)}
              onSelect={onSelect}
              onStartRename={startRename}
              onTogglePin={handleTogglePin}
              onToggleArchive={handleToggleArchive}
              onRequestDelete={setPendingDelete}
            />
          </>
        )}

        {!isLoading && items.length === 0 ? (
          <p
            className="px-[var(--space-2)] py-[var(--space-3)] text-[length:var(--font-size-sm)] text-[var(--text-tertiary)]"
            data-testid="conversation-empty"
          >
            {query.length > 0
              ? 'Không tìm thấy cuộc trò chuyện nào.'
              : 'Chưa có cuộc trò chuyện nào.'}
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingDelete !== undefined}
        title="Xoá cuộc trò chuyện?"
        {...(pendingDelete !== undefined
          ? { description: `“${pendingDelete.title}” và toàn bộ tin nhắn trong đó sẽ bị xoá vĩnh viễn.` }
          : {})}
        confirmLabel="Xoá"
        destructive
        onOpenChange={(open) => {
          if (!open) setPendingDelete(undefined)
        }}
        onConfirm={handleDelete}
      />
    </div>
  )
}

/** Props cua 1 nhom conversation. */
interface ConversationGroupProps {
  title: string
  items: ConversationSummary[]
  activeConversationId: string | undefined
  editingId: string | undefined
  editingTitle: string
  editingInputRef: React.RefObject<HTMLInputElement>
  onEditingTitleChange: (value: string) => void
  onCommitRename: (id: string) => void | Promise<void>
  onCancelRename: () => void
  onSelect: (id: string) => void
  onStartRename: (item: ConversationSummary) => void
  onTogglePin: (item: ConversationSummary) => void
  onToggleArchive: (item: ConversationSummary) => void
  onRequestDelete: (item: ConversationSummary) => void
}

/**
 * Mot nhom conversation (da ghim / gan day / da luu tru).
 */
function ConversationGroup({
  title,
  items,
  activeConversationId,
  editingId,
  editingTitle,
  editingInputRef,
  onEditingTitleChange,
  onCommitRename,
  onCancelRename,
  onSelect,
  onStartRename,
  onTogglePin,
  onToggleArchive,
  onRequestDelete,
}: ConversationGroupProps) {
  if (items.length === 0) return null

  return (
    <section className="mb-[var(--space-3)]" aria-label={title}>
      <h3 className="px-[var(--space-2)] pb-[var(--space-1)] text-[length:var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
        {title}
      </h3>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {editingId === item.id ? (
              <div className="flex items-center gap-1 px-[var(--space-1)] py-1">
                <Input
                  ref={editingInputRef}
                  value={editingTitle}
                  onChange={(event) => onEditingTitleChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void onCommitRename(item.id)
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      onCancelRename()
                    }
                  }}
                  aria-label="Đổi tên cuộc trò chuyện"
                  className="h-7 text-[length:var(--font-size-sm)]"
                  data-testid="conversation-rename-input"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    void onCommitRename(item.id)
                  }}
                  aria-label="Lưu tên"
                  data-testid="conversation-rename-save"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <div
                className={[
                  'group flex items-center gap-1 rounded-[var(--radius-sm)] px-[var(--space-1)] py-1',
                  item.id === activeConversationId
                    ? 'bg-[var(--color-accent-subtle)]'
                    : 'hover:bg-[var(--surface-sunken)]',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="min-w-0 flex-1 truncate rounded-[var(--radius-sm)] py-1 text-left text-[length:var(--font-size-sm)] text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                  aria-current={item.id === activeConversationId ? 'true' : undefined}
                  data-testid="conversation-item"
                >
                  {item.title}
                </button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onTogglePin(item)}
                  aria-label={item.pinned ? 'Bỏ ghim cuộc trò chuyện' : 'Ghim cuộc trò chuyện'}
                  data-testid="conversation-pin"
                >
                  {item.pinned ? (
                    <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onToggleArchive(item)}
                  aria-label={
                    item.archived
                      ? 'Khôi phục cuộc trò chuyện'
                      : 'Lưu trữ cuộc trò chuyện'
                  }
                  data-testid="conversation-archive"
                >
                  {item.archived ? (
                    <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onStartRename(item)}
                  aria-label="Đổi tên cuộc trò chuyện"
                  data-testid="conversation-rename"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRequestDelete(item)}
                  aria-label="Xoá cuộc trò chuyện"
                  data-testid="conversation-delete"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
