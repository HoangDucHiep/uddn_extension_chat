import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { WifiOff } from 'lucide-react'
import {
  filterSkills,
  SKILL_DEFAULT_INPUT,
  type ConversationMessage,
  type Settings,
  type Skill,
} from '@sidekick/shared'
import {
  classifyPage,
  detectPageKind,
  generalSuggestions,
  rotateSuggestions,
  suggestionsForPage,
  SUMMARY_PROMPT,
  type PageProfile,
} from '@sidekick/shared'
import { MessageBubble } from './components/MessageBubble'
import { Composer } from './components/Composer'
import { PanelHeader } from './components/PanelHeader'
import { ContextNotice } from './components/context/ContextNotice'
import { ContextChips } from './components/context/ContextChips'
import { ContextBudget } from './components/context/ContextBudget'
import { MentionPopover } from './components/context/MentionPopover'
import { SkillMenu } from './components/skills/SkillMenu'
import { SkillManager } from './components/skills/SkillManager'
import { SkillFormDialog } from './components/skills/SkillFormDialog'
import { AttachmentTray } from './components/composer/AttachmentTray'
import { ConversationList } from './components/chat/ConversationList'
import { SettingsDrawer } from './components/settings/SettingsDrawer'
import { ScrollToBottomButton } from './components/chat/ScrollToBottomButton'
import { ExportMenu } from './components/chat/ExportMenu'
import { ModelPicker } from './components/ModelPicker'
import { BudgetBanner } from './components/BudgetBanner'
import { EmptyState } from './components/states/EmptyState'
import { LoadingState } from './components/states/LoadingState'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useChat } from './hooks/useChat'
import { useConnectionStatus } from './hooks/useConnectionStatus'
import { useBudgetStatus } from './hooks/useBudgetStatus'
import { useI18n } from './hooks/useI18n'
import { useMention } from './hooks/useMention'
import { useSkillCommand } from './hooks/useSkillCommand'
import { useSelection } from './hooks/useSelection'
import { useTabs } from './hooks/useTabs'
import { useActivePage } from './hooks/useActivePage'
import { useImageAttachments } from './hooks/useImageAttachments'
import { useChatStore, type ChatMessage } from './store/chatStore'
import { useConversationStore } from './store/conversationStore'
import { useSkillStore } from './store/skillStore'
import { useBudgetStore } from './store/budgetStore'
import {
  activateVariant as activateVariantRequest,
  getConversationMessages,
} from '@/lib/conversationClient'
import {
  clearDraft,
  DRAFT_SCOPE_NEW,
  readActiveDraftScope,
  readDraft,
  writeActiveDraftScope,
  writeDraft,
} from '@/lib/storage'
import { activePathMessages, groupTurns, offPathTurns } from '@/lib/chatTurns'
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
  /** Cai dat hien tai (nguon su that cho ca panel — T-M1-17). */
  settings: Settings
  /** Cap nhat mot phan cai dat → luu ngay + ap dung ngay. */
  onSettingsChange: (patch: Partial<Settings>) => Promise<void>
}

/**
 * Ngan cach tuyet doi de auto-scroll (px).
 *
 * Thread duoi `SCROLL_BOTTOM_THRESHOLD` px → coi nhu dang o day → auto-scroll.
 */
const SCROLL_BOTTOM_THRESHOLD = 80

export function ChatWorkspace({
  onOpenOnboarding,
  settings,
  onSettingsChange,
}: ChatWorkspaceProps) {
  const { t } = useI18n()
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
    path,
    attachCurrentTab,
    attachTab,
    attachSelection,
    attachActiveSelection,
    removeItem,
    setContextEnabled,
    send,
    stop,
    clear,
    regenerate,
    editAndResend,
    continueAnswer,
    retryMessage,
    setConversationPath,
    activateVariant,
  } = useChat()
  const [input, setInput] = useState('')
  const [isAttaching, setIsAttaching] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSkillsOpen, setIsSkillsOpen] = useState(false)
  /** Skill dang duoc chon trong menu `/` (FR-SKILL-01 — T-M2-04). */
  const [selectedSkillId, setSelectedSkillId] = useState<string | undefined>(undefined)
  /** Skill dang sua trong form (`undefined` → dang tao moi). */
  const [editingSkill, setEditingSkill] = useState<Skill | undefined>(undefined)
  /** Prefill prompt khi tao skill tu tin nhan user (FR-SKILL-02). */
  const [skillPrefillPrompt, setSkillPrefillPrompt] = useState<string | undefined>(undefined)
  /** Form skill co mo hay khong. */
  const [isSkillFormOpen, setIsSkillFormOpen] = useState(false)
  /** Chi so dong dang active trong menu `/`. */
  const [skillActiveIndex, setSkillActiveIndex] = useState(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const mention = useMention()
  const skillCommand = useSkillCommand()
  const { tabs, isLoading: isLoadingTabs } = useTabs(mention.state.open)
  const imageAttachments = useImageAttachments()

  // --- FR-SKILL-01: danh sach skill cho menu `/` + drawer (T-M2-04) ---
  const skills = useSkillStore((state) => state.items)
  const refreshSkills = useSkillStore((state) => state.refresh)
  const createSkill = useSkillStore((state) => state.create)
  const updateSkill = useSkillStore((state) => state.update)

  // Nap danh sach skill 1 lan khi mo panel.
  useEffect(() => {
    void refreshSkills()
  }, [refreshSkills])

  // --- NFR-REL-04: trang thai ket noi toi BFF (T-M1-19) ---
  const connection = useConnectionStatus()
  // --- FR-PROVIDER-06: trang thai budget cap (T-M2-03b) ---
  useBudgetStatus()
  const budgetStatus = useBudgetStore((state) => state.status)
  /** Panel dang tai lich su hoi thoai → hien skeleton thay empty state. */
  const [isHydrating, setIsHydrating] = useState(false)

  // --- FR-UX-03/04: goi y theo trang + tom tat 1-click (T-M1-11) ---
  const { page: activePage } = useActivePage()

  /** Trang hien tai co doc duoc noi dung khong (http/https). */
  const canAttachPage =
    activePage !== undefined && detectPageKind(activePage.url) !== 'unknown'

  /** Loai trang → dung de chon bo goi y. */
  const profile: PageProfile = useMemo(
    () => classifyPage(activePage?.url ?? '', activePage?.title ?? ''),
    [activePage?.url, activePage?.title],
  )

  // Bo goi y goc cua profile hien tai.
  const baseSuggestions = useMemo(
    () =>
      canAttachPage
        ? suggestionsForPage(profile, activePage?.title ?? '')
        : generalSuggestions(),
    [canAttachPage, profile, activePage?.title],
  )

  // Buoc xoay vong (nut "lam moi") — reset khi doi profile.
  const [rotation, setRotation] = useState(0)
  useEffect(() => {
    setRotation(0)
  }, [profile, canAttachPage])

  const suggestions = useMemo(
    () => rotateSuggestions(baseSuggestions, rotation),
    [baseSuggestions, rotation],
  )

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

  // --- FR-UX-05: chi auto-scroll khi user dang o day ---
  const handleScroll = useCallback(() => {
    const node = threadRef.current
    if (node === null) return
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    setIsAtBottom(distance <= SCROLL_BOTTOM_THRESHOLD)
  }, [])

  useEffect(() => {
    const node = threadRef.current
    if (node === null) return
    // User dang doc phan tren → khong cuon ep.
    if (!isAtBottom) return
    node.scrollTop = node.scrollHeight
  }, [messages, isAtBottom])

  const scrollToBottom = useCallback(() => {
    const node = threadRef.current
    if (node === null) return
    node.scrollTop = node.scrollHeight
    setIsAtBottom(true)
  }, [])

  // --- FR-CHAT-13: tu luu ban nhap theo conversation ---
  const conversationId = useChatStore((state) => state.conversationId)
  const draft = useChatStore((state) => state.draft)
  const setDraft = useChatStore((state) => state.setDraft)

  /**
   * Khoa luu draft theo conversation.
   *
   * Chua co conversation (panel moi, user chua chat) → dung khoa `'new'`.
   * Khi user tao conversation that, ban nhap do van con tren textarea.
   */
  const [draftScope, setDraftScope] = useState(DRAFT_SCOPE_NEW)

  // Doc scope dang active (conversation dang mo) — khoi phuc sau reload.
  useEffect(() => {
    let cancelled = false
    void readActiveDraftScope().then((scope) => {
      if (cancelled) return
      setDraftScope(scope)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Khi server xac nhan conversation → luu scope de reload van dung draft.
  useEffect(() => {
    if (conversationId === undefined) return
    setDraftScope(conversationId)
    void writeActiveDraftScope(conversationId)
  }, [conversationId])

  // Khoi phuc draft khi doi conversation.
  useEffect(() => {
    let cancelled = false
    void readDraft(draftScope).then((stored) => {
      if (cancelled) return
      setDraft(stored ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [draftScope, setDraft])

  // Luu draft (debounce 300ms) khi noi dung thay doi.
  useEffect(() => {
    const timer = setTimeout(() => {
      void writeDraft(draftScope, draft)
    }, 300)
    return () => {
      clearTimeout(timer)
    }
  }, [draftScope, draft])

  // Dong bo `input` <-> draft khi draft thay doi tu ben ngoai (khoi phuc).
  useEffect(() => {
    setInput(draft)
  }, [draft])

  const handleSend = (): void => {
    if (input.trim().length === 0) return

    // Skill duoc chon → goi `/ten-skill` ra khoi cau hoi (token khong phai
    // noi dung that cua user). Server resolve skill tu `skillId`.
    const selectedSkill = skills.find((skill) => skill.id === selectedSkillId)
    const stripped =
      selectedSkill === undefined
        ? input.trim()
        : skillCommand.strip(input, selectedSkill.name)
    // User chi goi `/ten-skill` ma khong viet them → gui cau mac dinh
    // (server validate `content` toi thieu 1 ky tu).
    const content = stripped.length > 0 ? stripped : SKILL_DEFAULT_INPUT

    void send(content, selectedSkillId)
    setInput('')
    setDraft('')
    setSelectedSkillId(undefined)
    // Xoa ban nhap cua ca conversation hien tai va cua scope `'new'`
    // (truong hop chua tao conversation).
    void clearDraft(draftScope)
    if (draftScope !== DRAFT_SCOPE_NEW) {
      void clearDraft(DRAFT_SCOPE_NEW)
    }
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

  /**
   * Chay 1 goi y (FR-UX-03 — T-M1-11).
   *
   * Bam goi y = user **chu dong** muon dung context trang hien tai → tu dinh
   * kem trang truoc khi gui (tuong thich FR-CONTEXT-13).
   *
   * @param prompt - Prompt se gui len BFF.
   */
  const runSuggestion = useCallback(
    async (prompt: string): Promise<void> => {
      setIsAttaching(true)
      try {
        if (canAttachPage) {
          // Loi attach → van gui (ContextNotice hien thi loi cho user).
          await attachCurrentTab()
        }
        await send(prompt)
      } finally {
        setIsAttaching(false)
      }
    },
    [attachCurrentTab, canAttachPage, send],
  )

  /**
   * Tom tat trang hien tai 1-click (FR-UX-04 — T-M1-11).
   *
   * Tu dinh kem trang roi gui `SUMMARY_PROMPT` — dung wording chung voi
   * dataset eval (docs/EVAL_PLAN.md §3).
   */
  const handleSummarize = useCallback(async (): Promise<void> => {
    await runSuggestion(SUMMARY_PROMPT)
  }, [runSuggestion])

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

  // --- FR-SKILL-01: menu `/` (T-M2-04) ---
  const filteredSkills = useMemo(
    () => filterSkills(skills, skillCommand.state.query),
    [skills, skillCommand.state.query],
  )

  /**
   * Chon skill tu menu `/` → chen token `/ten-skill` vao textarea.
   *
   * @param skill - Skill duoc chon.
   */
  const handleSelectSkill = (skill: Skill): void => {
    const cursor = inputRef.current?.selectionStart ?? input.length
    const next = skillCommand.apply(input, cursor, skill)
    setInput(next.value)
    setDraft(next.value)
    setSelectedSkillId(skill.id)
    skillCommand.close()

    // Dua con tro ve sau chuoi vua chen.
    requestAnimationFrame(() => {
      const node = inputRef.current
      if (node === null) return
      node.focus()
      node.setSelectionRange(next.cursor, next.cursor)
    })
  }

  /**
   * Handler phim cho menu `/` — tra ve `true` neu menu lo phim do.
   *
   * @param event - Su kien phim cua textarea.
   */
  const handleSkillKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!skillCommand.state.open) return false
    if (filteredSkills.length === 0) return false

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSkillActiveIndex((index) => (index + 1) % filteredSkills.length)
      return true
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSkillActiveIndex((index) =>
        index <= 0 ? filteredSkills.length - 1 : index - 1,
      )
      return true
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const skill = filteredSkills[skillActiveIndex]
      if (skill !== undefined) handleSelectSkill(skill)
      return true
    }
    if (event.key === 'Tab') {
      // Autocomplete → chen ten day du (khong chon skill).
      event.preventDefault()
      const skill = filteredSkills[skillActiveIndex]
      if (skill === undefined) return false
      const cursor = inputRef.current?.selectionStart ?? input.length
      const next = skillCommand.apply(input, cursor, skill)
      setInput(next.value)
      setDraft(next.value)
      setSelectedSkillId(skill.id)
      requestAnimationFrame(() => {
        const node = inputRef.current
        if (node === null) return
        node.focus()
        node.setSelectionRange(next.cursor, next.cursor)
      })
      return true
    }
    return false
  }

  const skillPopover = skillCommand.state.open ? (
    <SkillMenu
      skills={skills}
      query={skillCommand.state.query}
      activeIndex={skillActiveIndex}
      onSelect={handleSelectSkill}
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
    // Hien skeleton trong luc tai → tranh flash empty state (T-M1-19).
    setIsHydrating(true)
    try {
      const response = await getConversationMessages(id)
      hydrateConversation(id, response.messages.map(toChatMessage))
      // Nap duong di active + bien the (T-M1-10).
      setConversationPath(response.path ?? [])
    } catch {
      toast.error(t('toast.historyLoadFailed'))
    } finally {
      setIsHydrating(false)
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
    setConversationPath([])
    setIsDrawerOpen(false)
  }

  /**
   * Chuyen bien the active cua 1 turn (FR-CHAT-05 — T-M1-10).
   *
   * Update local ngay (responsive) → dong bo server sau.
   *
   * @param turnId - Id turn.
   * @param variantIndex - Chi so bien the moi.
   */
  const handleSelectVariant = (turnId: string, variantIndex: number): void => {
    activateVariant(turnId, variantIndex)
    if (conversationId === undefined) return
    void activateVariantRequest(conversationId, turnId, variantIndex).catch(() => {
      toast.error(t('toast.variantSwitchFailed'))
    })
  }

  // --- Render theo duong di active (T-M1-10) ---
  const visibleMessages = useMemo(
    () => activePathMessages(messages, path),
    [messages, path],
  )

  const turnGroups = useMemo(() => groupTurns(messages), [messages])
  const turnById = useMemo(() => {
    const map = new Map<string, (typeof turnGroups)[number]>()
    for (const group of turnGroups) {
      map.set(group.turnId, group)
    }
    return map
  }, [turnGroups])

  const offPath = useMemo(() => offPathTurns(messages, path), [messages, path])

  // Du lieu xuat cuoc tro chuyen (FR-CHAT-10 — T-M1-13).
  // Chi xuat **duong di active** — dung nhung gi user nhin thay tren man hinh.
  const exportMessages = useMemo(
    () =>
      visibleMessages.map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        ...(message.provider !== undefined ? { provider: message.provider } : {}),
        ...(message.model !== undefined ? { model: message.model } : {}),
        ...(message.tokensIn !== undefined ? { tokensIn: message.tokensIn } : {}),
        ...(message.tokensOut !== undefined ? { tokensOut: message.tokensOut } : {}),
        ...(message.requestId !== undefined ? { requestId: message.requestId } : {}),
        ...(message.citations !== undefined && message.citations.length > 0
          ? {
              citations: message.citations.map((citation) => ({
                index: citation.index,
                url: citation.url,
                title: citation.title,
                snippet: citation.snippet,
              })),
            }
          : {}),
      })),
    [visibleMessages],
  )

  /**
   * Lay nhom bien the cua 1 turn (dung cho switcher bien the).
   *
   * @param turnId - Id turn.
   */
  const variantsOf = (turnId: string | undefined): readonly ChatMessage[] => {
    if (turnId === undefined) return []
    const group = turnById.get(turnId)
    return group?.variants ?? []
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface-panel)]">
      <PanelHeader
        provider={activeProvider}
        model={activeModel}
        keySource={keySource}
        conversationTitle={conversationTitle}
        connectionStatus={connection.status}
        onClear={clear}
        onOpenOnboarding={onOpenOnboarding}
        onOpenConversations={() => {
          setIsDrawerOpen(true)
        }}
        onOpenSkills={() => {
          setIsSkillsOpen(true)
        }}
        onOpenSettings={() => {
          setIsSettingsOpen(true)
        }}
        exportMenu={
          <ExportMenu
            conversationId={conversationId}
            title={conversationTitle ?? t('chat.exportDefaultTitle')}
            messages={exportMessages}
          />
        }
        modelPicker={
          <ModelPicker activeProvider={activeProvider} activeModel={activeModel} />
        }
      />

      {/* Banner offline (NFR-REL-04 — T-M1-19). */}
      {connection.status === 'offline' ? (
        <div
          className="flex items-center gap-2 border-b border-[var(--danger)] bg-[var(--surface-raised)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--font-size-sm)] text-[var(--danger)]"
          role="status"
          data-testid="offline-banner"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">{t('state.offline.banner')}</span>
          <button
            type="button"
            onClick={connection.retry}
            className="rounded-[var(--radius-sm)] px-2 py-0.5 text-[length:var(--font-size-xs)] underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
            data-testid="offline-banner-retry"
          >
            {t('state.offline.retry')}
          </button>
        </div>
      ) : null}

      {/* Banner budget cap (FR-PROVIDER-06 — T-M2-03b). */}
      <BudgetBanner
        status={budgetStatus}
        onOpenSettings={() => {
          setIsSettingsOpen(true)
        }}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={threadRef}
          onScroll={handleScroll}
          className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-[var(--space-3)] py-[var(--space-3)]"
          data-testid="message-list"
          // `role="log"` — semantic container cho lịch sử hội thoại.
          //
          // KHÔNG đặt `aria-live` ở đây: container chứa cả token stream →
          // screen reader đọc lại toàn bộ lịch sử cũ (spam). Live region
          // chỉ nằm ở phần **vừa stream** (`MessageContent` — T-M1-20).
          role="log"
          aria-label={t('chat.threadLabel')}
        >
          {isHydrating ? (
            <LoadingState />
          ) : visibleMessages.length === 0 ? (
            <EmptyState
              profile={profile}
              pageTitle={activePage?.title ?? ''}
              suggestions={suggestions}
              onSelect={(prompt) => {
                void runSuggestion(prompt)
              }}
              onSummarize={() => {
                void handleSummarize()
              }}
              onRefresh={() => {
                setRotation((current) => current + 1)
              }}
              isSending={isStreaming || isAttaching}
              canAttachPage={canAttachPage}
            />
          ) : (
            visibleMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                variants={variantsOf(message.turnId)}
                activeVariant={
                  message.turnId !== undefined
                    ? turnById.get(message.turnId)?.activeVariant
                    : undefined
                }
                isStreaming={isStreaming}
                onRegenerate={(messageId) => {
                  void regenerate(messageId)
                }}
                onEdit={() => {
                  // Chi can mo hop sua — noi dung submit xu ly trong bubble.
                }}
                onEditSubmit={(messageId, content) => {
                  void editAndResend(messageId, content)
                }}
                onContinue={(messageId) => {
                  void continueAnswer(messageId)
                }}
                onRetry={(messageId) => {
                  void retryMessage(messageId)
                }}
                onOpenSettings={() => {
                  setIsSettingsOpen(true)
                }}
                onSelectVariant={handleSelectVariant}
                onSaveAsSkill={(content) => {
                  // FR-SKILL-02: tao skill tu prompt da dung → prefill form.
                  setEditingSkill(undefined)
                  setSkillPrefillPrompt(content)
                  setIsSkillFormOpen(true)
                }}
              />
            ))
          )}

          {/* Nhanh cu (turn da bi cat khoi duong di) — chi doc (T-M1-10). */}
          {offPath.length > 0 ? (
            <details
              className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-[var(--space-2)]"
              data-testid="off-path-turns"
            >
              <summary className="cursor-pointer text-[length:var(--font-size-sm)] text-[var(--text-secondary)]">
                {t('chat.oldVersions', { count: offPath.length })}
              </summary>
              <ul className="mt-2 space-y-2">
                {offPath.map((group) => (
                  <li
                    key={group.turnId}
                    className="text-[length:var(--font-size-sm)] text-[var(--text-tertiary)]"
                  >
                    {group.userContent}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        {/* FR-UX-05: nut "Cuon xuong" khi thread khong o day. */}
        {!isAtBottom ? <ScrollToBottomButton onScrollToBottom={scrollToBottom} /> : null}
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
        onChange={(value) => {
          setInput(value)
          setDraft(value)
        }}
        onSend={handleSend}
        onStop={stop}
        isStreaming={isStreaming}
        mentionPopover={mentionPopover}
        skillPopover={skillPopover}
        onSkillKeyDown={handleSkillKeyDown}
        onCursorChange={(value, cursor) => {
          mention.sync(value, cursor)
          skillCommand.sync(value, cursor)
          // Chi 1 popover dung luc (mention `@` va skill `/`).
          if (mention.state.open) {
            skillCommand.close()
          } else if (skillCommand.state.open) {
            mention.close()
          }
        }}
        onEscape={() => {
          // FR-CHAT-12: Esc dung stream truoc, dong popover `@` sau.
          if (isStreaming) {
            stop()
            return
          }
          mention.close()
          skillCommand.close()
        }}
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
            {t('conversation.drawerTitle')}
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

      {/* Drawer quan ly skill (FR-SKILL-02/03 — T-M2-04). */}
      <Dialog open={isSkillsOpen} onOpenChange={setIsSkillsOpen}>
        <DialogContent aria-labelledby="skill-drawer-title">
          <DialogTitle id="skill-drawer-title" className="sr-only">
            {t('skill.manager.title')}
          </DialogTitle>
          <SkillManager
            onUse={(skill) => {
              // Dung nhanh → chen `/ten-skill` vao composer.
              const cursor = inputRef.current?.selectionStart ?? input.length
              const next = skillCommand.apply(input, cursor, skill)
              setInput(next.value)
              setDraft(next.value)
              setSelectedSkillId(skill.id)
              setIsSkillsOpen(false)
              requestAnimationFrame(() => {
                const node = inputRef.current
                if (node === null) return
                node.focus()
                node.setSelectionRange(next.cursor, next.cursor)
              })
            }}
            onCreate={() => {
              setEditingSkill(undefined)
              setSkillPrefillPrompt(undefined)
              setIsSkillFormOpen(true)
            }}
            onEdit={(skill) => {
              setEditingSkill(skill)
              setSkillPrefillPrompt(undefined)
              setIsSkillFormOpen(true)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Form tao / sua skill (FR-SKILL-02/03 — T-M2-04). */}
      <SkillFormDialog
        open={isSkillFormOpen}
        skill={editingSkill}
        initialPrompt={skillPrefillPrompt}
        onOpenChange={(open) => {
          setIsSkillFormOpen(open)
        }}
        onSubmit={async (values) => {
          try {
            if (editingSkill !== undefined) {
              await updateSkill(editingSkill.id, {
                name: values.name,
                description: values.description,
                promptTemplate: values.promptTemplate,
                tags: values.tags,
                ...(values.model !== undefined ? { model: values.model } : {}),
              })
              toast.success(t('toast.skillUpdated'))
            } else {
              await createSkill({
                name: values.name,
                description: values.description,
                promptTemplate: values.promptTemplate,
                tags: values.tags,
                ...(values.model !== undefined ? { model: values.model } : {}),
              })
              toast.success(t('toast.skillCreated'))
            }
          } catch {
            toast.error(
              editingSkill !== undefined ? t('toast.skillUpdateFailed') : t('toast.skillCreateFailed'),
            )
            throw new Error('skill save failed')
          }
        }}
      />

      {/* Drawer cai dat (FR-SETTINGS-01..07 — T-M1-12). */}
      <SettingsDrawer
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        onSettingsChange={onSettingsChange}
        onHistoryDeleted={() => {
          void useConversationStore.getState().refresh()
        }}
      />
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
    ...(message.turnId !== undefined ? { turnId: message.turnId } : {}),
    ...(message.variantIndex !== undefined ? { variantIndex: message.variantIndex } : {}),
    ...(message.active !== undefined ? { active: message.active } : {}),
    ...(message.parentTurnId !== undefined ? { parentTurnId: message.parentTurnId } : {}),
    ...(message.aborted !== undefined ? { aborted: message.aborted } : {}),
    // Id tu server = uuid trong DB → dung cho `regenerate` / `continue`
    // (client gui `assistantMessageId` la uuid — T-M1-19).
    serverId: message.id,
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
