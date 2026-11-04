import { useEffect, useRef, useState } from 'react'
import { MessageBubble } from './components/MessageBubble'
import { Composer } from './components/Composer'
import { PanelHeader } from './components/PanelHeader'
import { ContextNotice } from './components/context/ContextNotice'
import { ContextChips } from './components/context/ContextChips'
import { ContextBudget } from './components/context/ContextBudget'
import { useChat } from './hooks/useChat'

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
    removeItem,
    setContextEnabled,
    send,
    stop,
    clear,
  } = useChat()
  const [input, setInput] = useState('')
  const [isAttaching, setIsAttaching] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

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
              trang dang xem, hay bam &quot;Them trang nay&quot;.
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
      />
    </div>
  )
}
