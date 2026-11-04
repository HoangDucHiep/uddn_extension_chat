import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageBubble } from './components/MessageBubble'
import { Composer } from './components/Composer'
import { PanelHeader } from './components/PanelHeader'
import { ContextNotice } from './components/context/ContextNotice'
import { ContextChips } from './components/context/ContextChips'
import { ContextBudget } from './components/context/ContextBudget'
import { MentionPopover } from './components/context/MentionPopover'
import { useChat } from './hooks/useChat'
import { useMention } from './hooks/useMention'
import { useSelection } from './hooks/useSelection'
import { useTabs } from './hooks/useTabs'
import type { OpenTab } from '@/lib/tabList'

/**
 * App shell cua side panel.
 * Layout: header / thread / composer (DP-2 — thread chiem >= 90% khong gian).
 */
export function App() {
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
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const mention = useMention()
  const { tabs, isLoading: isLoadingTabs } = useTabs(mention.state.open)

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

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface-panel)]">
      <PanelHeader
        provider={activeProvider}
        model={activeModel}
        keySource={keySource}
        onClear={clear}
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
      />
    </div>
  )
}
