import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ConversationMessage } from '@sidekick/shared'
import { MessageBubble } from './components/MessageBubble'
import { Composer } from './components/Composer'
import { PanelHeader } from './components/PanelHeader'
import { ContextNotice } from './components/context/ContextNotice'
import { ContextChips } from './components/context/ContextChips'
import { ContextBudget } from './components/context/ContextBudget'
import { MentionPopover } from './components/context/MentionPopover'
import { AttachmentTray } from './components/composer/AttachmentTray'
import { ConversationList } from './components/chat/ConversationList'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useChat } from './hooks/useChat'
import { useMention } from './hooks/useMention'
import { useSelection } from './hooks/useSelection'
import { useTabs } from './hooks/useTabs'
import { useImageAttachments } from './hooks/useImageAttachments'
import { useChatStore, type ChatMessage } from './store/chatStore'
import { useConversationStore } from './store/conversationStore'
import { getConversationMessages } from '@/lib/conversationClient'
import type { OpenTab } from '@/lib/tabList'

/**
 * Noi dung chat cua side panel (thread + composer).
 *
 * Tach khoi `App.tsx` khi them onboarding (T-M1-25) — `App.tsx` chi quyet
 * dinh hien thi onboarding hay khong.
 *
 * Layout: header / thread / composer (DP-2 — thread chiem >= 90% khong gian).
 */
export interface ChatWorkspaceProps {
  /** Mo lai onboarding tu nut "Huong dan" trong header. */
  onOpenOnboarding: () => void
}

export function ChatWorkspace({ onOpenOnboarding }: ChatWorkspaceProps) {
  const {
    messages,
    isStreaming,
    activeProvider,
    activeModel,
    keySource,
    contextError,
    contextErrorMessage,
    attachedItems,
    contextEnabled,
    budget,
    attachCurrentTab,
    attachTab,
    attachSelection,
    attachActiveSelection,
    removeItem,
    setContextEnabled,
    send,
    stop,
    clear,
  } = useChat()
  const [input, setInput] = useState('')
  const [isAttaching, setIsAttaching] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const mention = useMention()
  const { tabs, isLoading: isLoadingTabs } = useTabs(mention.state.open)
  const imageAttachments = useImageAttachments()

  // Tieu de conversation hien tai → hien thi trong header.
  const hydrateConversation = useChatStore((state) => state.hydrateConversation)
  const conversationTitle = useConversationStore((state) => state.activeTitle)
  const setActiveConversationId = useConversationStore(
    (state) => state.setActiveConversationId,
  )

  // Doan text user boi den tren trang → tu dinh kem (duong A — T-M1-02).
  useSelection({
    onAttach: (selection) => {
      void attachSelection(selection)
    },
  })

  // Tu cuon xuong khi co tin nhan moi.
  useEffect(() => {
    const node = threadRef.current
    if (node) {
      node.scrollTop = node.scrollHeight
    }
  }, [messages])

  const handleSend = (): void => {
    if (input.trim().length === 0) return
    void send(input)
    setInput('')
  }

  const handleAddCurrentTab = (): void => {
    setIsAttaching(true)
    void attachCurrentTab().finally(() => {
      setIsAttaching(false)
    })
  }

  // Duong B — dinh doan text user dang boi tren tab active.
  const handleAttachSelection = (): void => {
    setIsAttaching(true)
    void attachActiveSelection().finally(() => {
      setIsAttaching(false)
    })
  }

  // Id cac tab da dinh kem → hien thi dau check trong popover.
  const attachedTabIds = useMemo(
    () =>
      attachedItems
        .filter((item) => item.tabId !== undefined)
        .map((item) => item.tabId as number),
    [attachedItems],
  )

  // Tab dang active trong cua so hien tai → gach chan phat sang.
  const activeTabId = useMemo(() => tabs.find((tab) => tab.active)?.id, [tabs])

  // Loc danh sach tab theo chuoi da go sau `@`.
  const filteredTabs = useMemo(() => {
    const query = mention.state.query.toLowerCase()
    if (query.length === 0) return tabs
    return tabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(query) ||
        tab.domain.toLowerCase().includes(query) ||
        tab.url.toLowerCase().includes(query),
    )
  }, [tabs, mention.state.query])

  const handleSelectTab = (tab: OpenTab): void => {
    // Chen ten tab vao textarea truoc khi dinh kem → user thay ro nguon.
    const cursor = inputRef.current?.selectionStart ?? input.length
    const next = mention.apply(input, cursor, tab.title)
    setInput(next.value)
    mention.close()

    setIsAttaching(true)
    void attachTab(tab.id).finally(() => {
      setIsAttaching(false)
    })

    // Dua con tro ve sau chuoi vua chen.
    requestAnimationFrame(() => {
      const node = inputRef.current
      if (node === null) return
      node.focus()
      node.setSelectionRange(next.cursor, next.cursor)
    })
  }

  const mentionPopover = mention.state.open ? (
    <MentionPopover
      tabs={filteredTabs}
      activeTabId={activeTabId}
      attachedTabIds={attachedTabIds}
      isLoading={isLoadingTabs}
      onSelect={handleSelectTab}
    />
  ) : undefined

  /**
   * Chon 1 conversation → tai lai lich su hoi thoai vao thread.
   *
   * @param id - Id conversation can mo.
   * @param title - Tieu de conversation (hien thi header).
   */
  const handleSelectConversation = async (id: string, title: string): Promise<void> => {
    setActiveConversationId(id, title)
    try {
      const response = await getConversationMessages(id)
      hydrateConversation(id, response.messages.map(toChatMessage))
    } catch {
      toast.error('Không tải được lịch sử cuộc trò chuyện')
    }
  }

  /**
   * Tao chat moi → xoa thread hien tai, gan conversation vua tao.
   *
   * Conversation **da** duoc tao tren server (POST `/api/conversations`) →
   * gan `conversationId` ngay de luot chat sau ghi vao dung conversation do
   * (khong tao rac conversation rong).
   *
   * @param id - Id conversation vua tao.
   */
  const handleCreateConversation = (id: string): void => {
    hydrateConversation(id, [])
    setActiveConversationId(id, 'Cuộc trò chuyện mới')
    setIsDrawerOpen(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface-panel)]">
      <PanelHeader
        provider={activeProvider}
        model={activeModel}
        keySource={keySource}
        conversationTitle={conversationTitle}
        onClear={clear}
        onOpenOnboarding={onOpenOnboarding}
        onOpenConversations={() => {
          setIsDrawerOpen(true)
        }}
      />

      <div
        ref={threadRef}
        className="flex-1 space-y-3 overflow-y-auto px-[var(--space-3)] py-[var(--space-3)]"
        data-testid="message-list"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-[length:var(--font-size-lg)] font-medium text-[var(--text-primary)]">
              Chao ban!
            </p>
            <p className="max-w-[280px] text-[length:var(--font-size-sm)] text-[var(--text-secondary)]">
              Ban co the hoi bat ky cau hoi nao. Neu muon Sidekick AI dung noi dung
              trang dang xem, hay bam &quot;Them trang nay&quot; hoac go &quot;@&quot; de
              dinh kem tab khac.
            </p>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
      </div>

      {contextError !== undefined && (
        <ContextNotice errorCode={contextError} message={contextErrorMessage} />
      )}

      <ContextChips
        items={attachedItems}
        enabled={contextEnabled}
        onToggle={setContextEnabled}
        onAddCurrentTab={handleAddCurrentTab}
        onAttachSelection={handleAttachSelection}
        onRemove={removeItem}
        isAttaching={isAttaching}
      />

      <ContextBudget budget={budget} />

      <AttachmentTray
        images={imageAttachments.images}
        onRemove={imageAttachments.removeImage}
        errorMessage={imageAttachments.error?.message}
      />

      <Composer
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={stop}
        isStreaming={isStreaming}
        mentionPopover={mentionPopover}
        onCursorChange={mention.sync}
        onEscape={mention.close}
        inputRef={inputRef}
        onImagesSelected={(files) => {
          void imageAttachments.addFiles(files)
        }}
        isReadingImages={imageAttachments.isReading}
      />

      {/* Drawer danh sach cuoc tro chuyen (FR-CHAT-09 — T-M1-09). */}
      <Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DialogContent aria-labelledby="conversation-drawer-title">
          <DialogTitle id="conversation-drawer-title" className="sr-only">
            Danh sách cuộc trò chuyện
          </DialogTitle>
          <ConversationList
            onSelect={(id) => {
              const title =
                useConversationStore.getState().items.find((item) => item.id === id)?.title ?? ''
              setIsDrawerOpen(false)
              void handleSelectConversation(id, title)
            }}
            onCreate={handleCreateConversation}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Chuyen message tu BFF (contract) sang `ChatMessage` (state UI).
 *
 * @param message - Message tu `GET /api/conversations/:id/messages`.
 */
function toChatMessage(message: ConversationMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: new Date(message.createdAt).getTime(),
    status: 'done',
    ...(message.provider !== undefined ? { provider: message.provider } : {}),
    ...(message.model !== undefined ? { model: message.model } : {}),
    ...(message.tokensIn !== undefined ? { tokensIn: message.tokensIn } : {}),
    ...(message.tokensOut !== undefined ? { tokensOut: message.tokensOut } : {}),
    ...(message.citations.length > 0
      ? {
          citations: message.citations.map((citation) => ({
            index: citation.index,
            url: citation.url,
            title: citation.title,
            snippet: citation.snippet,
            ...(citation.tabId !== undefined ? { tabId: citation.tabId } : {}),
          })),
        }
      : {}),
  }
}
