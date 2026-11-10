# Context chuyển sang chat mới — Sidekick AI

> **Cách dùng:** mở chat mới ở Cursor → dán **toàn bộ nội dung file này** vào ô chat.
> File này là **bản tổng hợp tự chứa** — chat mới **không** cần đọc lại transcript cũ.
>
> Cập nhật: **2026-11-10** (giờ VN) · HEAD = `000ddcc`
>
> ⚠️ **Đã refresh 2026-11-10** — tên file giữ nguyên theo lần tạo 2026-11-09, nhưng nội dung đã đồng bộ với trạng thái M2 mới nhất (2/23 task M2 xong). Đọc `docs/HANDOFF.md` §2 nếu cần số liệu mới hơn.

---

## 0. TL;DR cho agent mới

1. Đọc `AGENTS.md` (file gốc ở root) — chứa 90% context của dự án.
2. Đọc `docs/HANDOFF.md` §2 — trạng thái hiện tại + quyết định đã chốt.
3. Kiểm tra bằng chứng bằng `git log --oneline -10` + `git status`.
4. M1 đã đóng **23/25 task** (tag `v0.2`). **M2 đang làm — 2/23 task xong** (T-M2-02 ✅ · T-M2-03 ✅). Việc tiếp theo: **T-M2-12** (điền dataset eval thật — contract đã sẵn sàng ở `packages/shared/src/schemas/eval.ts`).
5. **Bắt buộc** theo `.cursor/rules/docs-sync.mdc`: code → cập nhật `docs/` tương ứng + `docs/CHANGELOG.md` → 1 commit/task.

---

## 1. Dự án là gì

**Sidekick AI** — Chrome Extension (Manifest V3) chat-bot sidebar cho **đồ án môn học**.

- **Mục tiêu:** feature **parity** với **Edge Copilot Sidebar** + **Chrome Gemini in Chrome**, cộng tính năng độc quyền (BYOK, multi-provider, MCP, RAG, log có cấu trúc, self-host, scheduler).
- **Deliverable bắt buộc:** `docs/EVAL_REPORT.md` so sánh với Edge Copilot & Chrome Gemini (thuộc M2).

### Stack (đã chốt, KHÔNG đổi)

| Hạng mục | Chọn |
|---|---|
| Extension | Chrome **MV3**, Side Panel API, Chrome **≥ 114** |
| UI | **React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui** (Radix, copy trong repo) |
| Client state | **Zustand** |
| Backend | **BFF**: Node 20 + Express + TS, local qua **Docker Compose** |
| DB | **PostgreSQL 16 + Drizzle ORM + pgvector** |
| Repo | **pnpm workspace**: `apps/extension` · `apps/server` · `apps/eval` · `packages/shared` |
| Shared | `packages/shared` — TS types + Zod + SSE event union + error codes |
| Test | **Vitest** (unit/integration) · **Playwright** + Chrome for Testing (E2E) |
| LLM | Multi-provider: Gemini (mặc định), OpenAI, Anthropic, OpenRouter, Groq, Ollama |

### Ràng buộc MV3 — ĐỪNG PHÁ

- **Streaming trực tiếp** Side Panel → BFF. **KHÔNG** proxy qua service worker (SW bị kill ~30s).
- **`activeTab` không dùng được** trong side panel → cần `tabs` + `scripting` + `sidePanel` + `storage` + `<all_urls>`.
- `chrome.sidePanel.open()` chỉ chạy được trong **user gesture** (click icon / context menu / phím tắt).
- Chỉ **1** side panel mỗi cửa sổ browser.
- Content script **không** chạy trên `chrome://` → phải xử lý lỗi gracefully.

---

## 2. Trạng thái hiện tại (đã verify)

| Hạng mục | Trạng thái |
|---|---|
| **M0 — Foundation** | ✅ Xong (tag `v0.1`) — 15/15 task |
| **M1 — Parity** | ✅ Xong (tag `v0.2`) — 23/25 task · gate đạt: checklist §E **32/35 = 91.4%** · dòng "Must" §A/§B **21/23 = 91.3%** |
| **M2 — Advanced & Eval** | 🟡 **Đang làm — 2/23 task** · T-M2-02 ✅ · T-M2-03 ✅ · T-M2-01 ⏸ đẩy |
| **M3 — Polish & Deliverable** | ⬜ Chưa bắt đầu |
| **M4 — Workflow** | ⬜ Ngoài đường găng (chỉ sau M3 + đã có eval report) |

### 2 task M1 treo

| Task | Nội dung | Trạng thái |
|---|---|---|
| **T-M1-15** | K3 direct mode (BYOK không cần BFF) | ⏸ **Tạm dừng** (BYOK — quyết định user 2026-11-08) |
| **T-M1-16** | K2 BYOK qua BFF: UI quản lý key | ⏸ **Tạm dừng** (BYOK — quyết định user 2026-11-08) |

> **T-M1-13 đã xong** 2026-11-09 (commit `0a8d9d6`) — export conversation Markdown/JSON. M1 còn 2 task treo (BYOK) như **gate parity đã đạt** → M1 đóng.
>
> **BYOK tạm dừng:** ô nhập API key đã **gỡ khỏi onboarding** (bước 2) → provider cần key mà chưa có **K1** chỉ hiện thông báo hướng dẫn (`data-testid="onboarding-key-required"`). **Server giữ nguyên** `POST /api/providers/keys` · `GET/DELETE /api/providers/keys/:id` · `POST /api/providers/keys/:id/test` + bảng `provider_keys` (AES-256-GCM) → mở lại được bằng cách thêm lại UI, **không** migration. Ở M1 nguồn key duy nhất là **K1** (team key trong `.env` BFF) + Ollama local.

### M2 — 23 task (2/23 xong)

| Nhóm | Task |
|---|---|
| **Provider** | T-M2-01 multi-provider (OpenAI, Anthropic, OpenRouter, Groq, Ollama) — ⏸ **đẩy lại** (quyết định user 2026-11-10: **không** thêm provider mới) · T-M2-02 model picker + fallback chain — ✅ **xong** · T-M2-03 token & cost UI — ✅ **xong** (trừ budget cap) · T-M2-03b budget cap — ⬜ |
| **Skills** | T-M2-04 CRUD + menu `/` · T-M2-05 import/export JSON · T-M2-06 library browser · T-M2-21 built-in library (≥8 skill) + skill gắn điều kiện |
| **Tools** | T-M2-07 tool registry (web search, calculator) · T-M2-08 MCP client (stdio) · T-M2-09 tool call UI + approval gate · T-M2-18 agentic action (cắt được) · T-M2-20 web search tool |
| **RAG** | T-M2-10 embedding + `rag_documents` + search · T-M2-11 RAG UI + citation mở rộng |
| **Eval** | T-M2-12 dataset 48 task + snapshot trang · T-M2-13 harness runner · T-M2-14 judge prompt + blind mapping · T-M2-15 thu thập tay Edge + Gemini (n=3) · T-M2-16 chấm tay Tầng B + độ tin cậy · T-M2-17 **`docs/EVAL_REPORT.md`** + radar chart |
| **Khác** | T-M2-19 chính sách context theo domain + lịch sử duyệt opt-in + mode "chỉ dùng trang" · T-M2-22 vision mở rộng (chụp vùng, OCR, alt text) |

**T-M2-02 (FR-PROVIDER-03/04) — model picker động + fallback chain runtime:**
- **Server** — `GET /api/providers/:id/models` → `ProviderAdapter.discoverModels?(apiKey)` → `{ providerId, models, source: 'live' | 'fallback' }` (`openaiCompatible.ts` gửi `Authorization` · `gemini.ts` gửi `x-goog-api-key`).
- **Fallback chain** trong `apps/server/src/services/chatService.ts`: fallback **chỉ** khi lỗi `retryable` **và** `streamedToken === false` · 401/403 → **không** fallback · chuyển provider → **tính lại** context budget + prompt.
- **SSE event mới `provider_switch`** `{ from, to, reason, model }` → extension đổi chip provider + toast "Đã chuyển sang provider X".
- **Migration `0002_certain_vector.sql`** — cột mới `request_logs.fallback_from`.
- **UI** — `ModelPicker` (Radix Popover) ở header · lựa chọn lưu `chrome.storage.local` key `sidekick.modelSelection` → persist qua reload.

**T-M2-03 (FR-PROVIDER-05) — token & chi phí:**
- `UsageBadge` dưới bubble assistant (token vào/ra + `~ $0.0123`) · provider local → chỉ hiện token.
- Section **"Chi phí & sử dụng"** trong Settings: `GET /api/usage` → tổng + bảng theo ngày · khoảng `today/7d/30d/all`.
- **Budget cap (FR-PROVIDER-06, priority C) chưa làm** → `TODO(T-M2-03b)`.

**Ảnh hưởng lên gate parity:** checklist §E **32/35 = 91.4%** → **33/35 = 94.3%** (đóng dòng "Token/cost hiển thị").

> **Hiện trạng `apps/eval/`:** chỉ có **scaffold** — `src/{cli,dataset,logs,types}.ts` + `dataset/tasks.json` (**đang rỗng `[]`**). `pnpm eval:run` hiện chỉ in thống kê dataset; `pnpm eval:run logs` đọc `request_logs` từ BFF (thêm ở T-M1-14). Chưa có `runners/` hay `judge/` → đó là phần lớn T-M2-13/14.

---

## 3. Lịch sử commit (gần đây nhất trước)

```
000ddcc fix(scripts): giat ca cay tien trinh BFF phu de khong ro ri port 8791
14d8057 docs(m2): ghi nhan flake E2E do quota provider (413 TPM) khong phai hoi quy code
2b0c8e1 docs(m2): ghi nhan kiem chung live Chrome 15/15 muc + them lenh pnpm manual:checklist
2a75376 feat(scripts): them script chay checklist test tay tren Chrome that (load unpacked)
599b617 test(model-picker): them test doi provider xoa model, tim kiem > 12 model, persist qua reload
b02c806 feat(usage): bo chon khoang thoi gian cho section chi phi (T-M2-03)
57865b8 feat(ui): model picker + hien thi token/chi phi (T-M2-02, T-M2-03)
217328c feat(chat): fallback chain runtime trong chatService + test (FR-PROVIDER-04)
1ea95cc feat(provider): endpoint danh sach model dong + fallback chain runtime (T-M2-02)
a05b654 docs(m1): audit checklist parity va dong M1 (tag v0.2)
```

> Working tree **sạch** tại `000ddcc` (trừ 3 file chỉ lệch line-ending CRLF do `core.autocrlf=true` — không có thay đổi nội dung).

---

## 4. Việc vừa hoàn thành (chi tiết để không làm lại)

### 4.1 Fix bundle content script (`0144201` + `58f5b1f`)

**Vấn đề:** `dist/content.js` phình **13.87 kB → 151 kB** (T-M1-17) → **~46 kB** (T-M1-20) → nay **17.27 kB** (gzip 6.65 kB).

**2 nguyên nhân:**
1. T-M1-17: `lib/i18n.ts` → `lib/settings.ts` → `@sidekick/shared` (barrel `index`) → toàn bộ bundle **Zod** (~100 kB).
2. T-M1-20: `lib/i18n.ts` → `i18n/index.ts` → `i18n/vi.ts` + `i18n/en.ts` (dictionary **đầy đủ** ~34 kB).

**Cách sửa — tách 2 tầng dictionary:**

| Module | Vai trò |
|---|---|
| `i18n/format.ts` | `formatMessage()` + `resolveLanguage()` — **không** import dictionary |
| `i18n/outsidePanel.vi.ts` | **NGUỒN SỰ THẬT** của 4 khoá ngoài panel (`content.selectionButton` · `content.selectionButtonLabel` · `background.menu.open` · `background.menu.askSelection`) |
| `i18n/outsidePanel.en.ts` | Bản EN (kiểu ràng buộc key) |
| `i18n/outsidePanel.ts` | `createOutsidePanelTranslator(language)` |
| `i18n/surface.ts` | Union kiểu `OutsidePanelKey` |
| `lib/i18nSurface.ts` | `getSurfaceTranslator()` — cho content script + service worker |
| `lib/storageKeys.ts` | Khoá storage + `readStoredUiLanguage()` — đọc **thuộc tính** trực tiếp, **không** validate bằng Zod |

`i18n/vi.ts` + `en.ts` **spread** dictionary rút gọn vào → 1 nguồn sự thật. `lib/settings.ts` re-export hằng khoá từ `storageKeys.ts`.

**Guard hồi quy** — `apps/extension/tests/contentBundleGuard.test.ts` (10 test):
- Duyệt **đệ quy đồ thị phụ thuộc** từ `src/content/contentScript.ts` → chặn `@sidekick/shared` (barrel) · dictionary đầy đủ · `react` · `zod`.
- Assert `dist/content.js` **≤ 40 kB** + không chứa marker Zod (`invalid_type`).
- > **Bài học:** bản grep từng file **lọt lưới** (đổi `contentScript.ts` sang import `../lib/i18n.js` vẫn xanh). Phải **duyệt đệ quy**. `import type` bị xoá khi build → không được báo động giả. Resolver phải bỏ đuôi `.js` (quy ước import nội bộ).

### 4.2 T-M1-18 — Phím tắt cấu hình được (`906b35d`)

**2 lớp** (vì Chrome MV3 **không** có `chrome.commands.update()` / `reset()` — đó là API riêng của **Firefox**; đã probe: `chrome.commands` chỉ có `['onCommand', 'getAll']`):

| Lớp | Nguồn lưu | Cách đổi | Phạm vi |
|---|---|---|---|
| **Native Chrome** | Chrome tự quản lý | `chrome://extensions/shortcuts` | Toàn trình duyệt (khi panel đóng) |
| **Nhanh Sidekick** | `chrome.storage.local` key `sidekick.shortcuts` | Ngay trong Settings | Khi side panel focus |

**Module:** `lib/shortcuts.ts` (thuần — `normalizeShortcut` · `isReservedShortcut` · `parseShortcut` · `shortcutFromKeyboardEvent` · `matchesShortcut` · `formatShortcutLabel` · `RESERVED_CHROME_SHORTCUTS` **28** tổ hợp · `DEFAULT_SHORTCUTS` · `SHORTCUT_COMMANDS`) · `lib/shortcutStorage.ts` · `lib/shortcutProtocol.ts` (thuần, **không** Zod) · `lib/shortcutBridge.ts` (SW → `chrome.sidePanel.open()`) · `content/shortcutListener.ts` · `sidepanel/components/settings/ShortcutsSettings.tsx`.

### 4.3 T-M1-20 — Responsive + a11y (`d4e450e`)

- **Responsive:** `#root` → `min-width: min(var(--panel-min-width), 100%)` · drawer Settings `w-[min(360px,92vw)] max-w-full` · chip nguồn `max-w-[min(180px,100%)]` · `min-w-0` cho bubble/textarea · `overflow-x-hidden` cho thread.
- **Focus ring:** 12 chỗ → chuẩn hoá `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]` (1 token `--border-focus`; **không** dùng `--focus-ring` vì là shadow 2 vòng → phải `outline: none`).
- **Live region (NFR-A11Y-05):** `role="article"` + `aria-live="polite"` + `aria-atomic="false"` + `aria-relevant="additions text"` **chỉ** trên `MessageContent` khi đang stream; thread `role="log"` **không** đặt `aria-live` → screen reader không đọc lại lịch sử cũ.
- **Skip-link:** `<SkipLink />` ở `App.tsx` → `#sidekick-composer-input` (`id` trên `<Textarea>`).
- **Tap target ≥ 24px** (WCAG 2.2 §2.5.8): icon-button `p-[2px]` → `h-6 w-6`.
- **`role="tab"`/`tabpanel`** cho tab nhóm conversation (roving `tabIndex`).
- **i18n:** `composer.hint` · `chat.oldVersions` · `chat.threadLabel` + nhãn đóng Dialog → `t()`. `useI18n` **chuyển** từ `sidepanel/hooks/` → `src/i18n/useI18n.ts` (file cũ re-export) để `components/ui/dialog.tsx` dịch được mà không import ngược tầng.

### 4.4 Hướng dẫn test tay cho user (`3211d9c`)

`docs/MANUAL_TEST_GUIDE.md` (15 mục) — cài extension + chạy hạ tầng + test tay từng tính năng M1 + xử lý sự cố + checklist 18 mục. Đã đối chiếu với source thật (`data-testid` · `i18n/vi.ts` · `manifest.json`).

---

## 5. Bản đồ source (để agent mới không phải dò)

### `apps/extension/src/`

```
sidepanel/
  App.tsx                    # SkipLink + I18nProvider + SettingsDrawer + ChatWorkspace
  ChatWorkspace.tsx          # orchestrator chat (streaming, actions, summarize)
  PanelHeader.tsx            # logo, provider chip, ConnectionBadge, 4 nút
  Composer.tsx               # textarea (Enter/Shift+Enter/Esc), paste/drop ảnh
  MessageBubble.tsx          # bubble + meta (requestId 6 ký tự) + MessageActions
  components/
    chat/                    # ConversationList · MessageActions · MessageContent ·
                              # MessageEditBox · CodeBlock · MarkdownTable ·
                              # CitationChip · CitationPopover · CitationList ·
                              # PromptGallery · SummarizeButton · ConfirmDialog ·
                              # ScrollToBottomButton · citationPlugin.ts
    context/                 # ContextChips · ContextBudget · ContextNotice · MentionPopover
    composer/                # AttachmentTray
    settings/                # SettingsDrawer (7 section) · Theme · Appearance ·
                              # Privacy · Data · Endpoint · Language · Shortcuts
    states/                  # LoadingState · EmptyState · ErrorState · ConnectionBadge
    onboarding/              # Onboarding · StepPermissions · StepProvider · StepTry
  hooks/                     # useChat · useSettings · useI18n (re-export) · useTabs ·
                              # useMention · useOnboarding · useSelection · useImageAttachments
  store/                     # Zustand: chatStore
  lib/  (27 module)          # xem bảng dưới
  i18n/                      # vi.ts · en.ts · index.ts · context.ts · format.ts ·
                              # outsidePanel.{vi,en}.ts · outsidePanel.ts · surface.ts · useI18n.ts
content/                     # contentScript.ts · extractor.ts · selection.ts ·
                              # selectionButton.ts · selectionWatcher.ts · shortcutListener.ts
background/                  # serviceWorker.ts · panelController.ts · contextMenus.ts · commands.ts
components/ui/               # shadcn copy (button, dialog, textarea, input, ...)
```

### `apps/extension/src/lib/` — 27 module

```
activePage · apiClient · chatTurns · connectionStatus · contextAttach · contextCache
conversationClient · extractClient · i18n · i18nSurface · imageUpload · onboarding
pageContext · providerClient · selectionBridge · selectionProtocol · settings
shortcutBridge · shortcutProtocol · shortcuts · shortcutStorage · sseClient · storage
storageKeys · tabList · theme · utils
```

### `apps/server/src/`

```
routes/       # attachments · chat · conversations · extract · health · logs · providers
providers/    # gemini · groq · openaiCompatible · openrouter · ollama · mock ·
              # registry · keyResolver · sse · types
services/     # chatService · requestLogService · providerService · attachmentService · …
middleware/   # requestId · requestLogger · origin · error …
config/env.ts # Zod schema — .env ở apps/server/.env
db/schema.ts  # Drizzle
```

### `apps/eval/` — scaffold M0

```
src/cli.ts      # subcommand `logs` (đọc request_logs) + in thống kê dataset
src/dataset.ts  # loadDataset + validateTask + filterTasks
src/logs.ts     # fetchLogs · fetchUsage · summarizeLogs
src/types.ts    # EvalTask · EvalRunResult · EVAL_GROUPS · EVAL_RUNS_PER_TASK = 3
dataset/tasks.json   # ⚠️ ĐANG RỖNG [] — cần điền ở T-M2-12
```

### `packages/shared/src/`

```
index.ts (barrel) · chatErrors · citation · constants · contextBudget · contextHash
errors · events · pageKind · pageProfile · pricing
types/entities · schemas/{chat,conversation,extract,logs,provider,settings,vision}
```

> ⚠️ **`@sidekick/shared` barrel kéo theo Zod.** Content script **KHÔNG** được import barrel — chỉ subpath `@sidekick/shared/constants`. Guard `contentBundleGuard.test.ts` chặn việc này.

---

## 6. Verify (đã chạy thành công)

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ |
| `pnpm test` | ✅ **1394 unit** (shared 245 · server 387 · extension 751 · eval 11) |
| `pnpm build` | ✅ `dist/content.js` 17.27 kB (gzip 6.65 kB) · `sidepanel.js` 780.53 kB |
| `pnpm db:migrate` | ✅ (migration `0002_certain_vector.sql` — cột `request_logs.fallback_from`) |
| `pnpm test:e2e` | ✅ **91/91** (24 file — Docker + BFF thật) |
| `pnpm manual:checklist` | ✅ **15/15 mục** (load unpacked vào Chrome thật — model động 428 model · fallback `ollama → groq` · `fallback_from` trong DB) |

### Lệnh

```bash
pnpm install && docker compose up -d && pnpm db:migrate
pnpm dev            # shared + extension + server
pnpm dev:ext       # chỉ extension (vite HMR)
pnpm dev:server    # chỉ BFF
pnpm build         # build tất cả
pnpm typecheck && pnpm lint && pnpm test
pnpm test:e2e      # Playwright (cần Docker + BFF)
pnpm eval:run      # eval harness (hiện chỉ scaffold)
pnpm eval:run logs # đọc request_logs
```

> `pnpm test` / `typecheck` / `build` / `dev` tự build `packages/shared` trước (pre-hook) → fresh clone chạy được ngay. Test resolve `@sidekick/shared` từ **source**, không phải `dist`.

### Load extension vào Chrome

```
pnpm build
→ chrome://extensions → Developer mode → Load unpacked → apps/extension/dist
```

Sau mỗi lần build → bấm **↻ reload** trên thẻ extension.

---

## 7. Quy tắc bắt buộc (từ `.cursor/rules/` + `AGENTS.md`)

1. **Sau mỗi phần code → cập nhật docs tương ứng** + `docs/CHANGELOG.md` → commit. *Task chưa cập nhật docs = chưa Done.*
   - Hành vi sản phẩm → `REQUIREMENTS.md` · API/schema/kiến trúc → `SYSTEM_DESIGN.md` · UI/token → `DESIGN_SYSTEM_BRIEF.md` · Task → `IMPLEMENTATION_PLAN.md` · Parity → `COMPARISON_MATRIX.md` · Eval → `EVAL_PLAN.md` · Repo → `README.md` · **luôn** `CHANGELOG.md` · Task dở → `HANDOFF.md`.
2. **Ưu tiên:** `M1 parity > M2 advanced > M3 polish > M4 workflow`.
3. **Không phá parity** — checklist §E trong `COMPARISON_MATRIX.md`.
4. **M4 implement cuối cùng**, chỉ khi thỏa `REQUIREMENTS.md` §9.4.
5. **Không hardcode màu/giá trị UI** — dùng design token (`var(--...)` hoặc class map).
6. **Không dùng `any`** trong TS. Không `eval`, không remote code.
7. **Không commit** `.env`, key, transcript thô (`apps/eval/results/raw/` bị ignore; `docs/EVAL_REPORT.md` thì **giữ**).
8. **Comment tiếng Việt** — giải thích *tại sao*, không mô tả *cái gì*. Tên identifier **tiếng Anh**.
9. **1 task = 1 commit** — `feat(scope):` · `fix(scope):` · `docs:` · `chore:`.
10. TS strict: `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. Không `!` trừ khi đã kiểm tra null bằng `if`.
11. Kiểu dùng chung giữa extension/server/eval **phải** ở `packages/shared`.
12. Validate input bằng **Zod** ở biên (route handler, SSE event, message từ client).
13. 1 file = 1 trách nhiệm. File **> 300 dòng** → tách.
14. Import: dùng **type-only import** khi chỉ là type. Không wildcard import.
15. UI: dùng shadcn/ui có sẵn trong `apps/extension/src/components/ui/` — **không** thêm thư viện UI mới. Icon: `lucide-react`. Icon-button bắt buộc có `aria-label` tiếng Việt. Mọi interactive element có focus ring rõ. Tôn trọng `prefers-reduced-motion`.
16. Backend: route handler mỏng (validate → service → response). **Không** log API key hay nội dung nhạy cảm. Query DB parameterized. Lỗi ra ngoài map về error code trong `packages/shared/src/errors.ts`.
17. TODO phải có mã task: `// TODO(T-M2-10): hỗ trợ truy vấn theo ngày`.

---

## 8. Gợi ý bước tiếp theo

### Ưu tiên 1 — T-M2-12 (Điền dataset eval thật) · L · ~3–5 ngày

- File: `apps/eval/dataset/tasks.json` + `apps/eval/dataset/snapshots/*`.
- **Contract đã có sẵn** → [`packages/shared/src/schemas/eval.ts`](../packages/shared/src/schemas/eval.ts) (`evalTaskSchema` + `EVAL_GROUPS` **8 nhóm** theo [`EVAL_PLAN.md`](EVAL_PLAN.md) §3.2) → `apps/eval` validate dataset bằng đúng schema đó.
- AC (từ plan): ≥ 44 task · ≥ 80% có `must_include_facts` · ≥ 40% tiếng Việt · có nhóm `doc_extract` (PDF) + `video_transcript` (YouTube).
- Field **snake_case**: `page.snapshot_path` · `page.content_hash` · `reference.key_points` / `must_include_facts` / `must_not_contain` · `expected_citations`.
- Cần update: `REQUIREMENTS.md` §9 (deliverable) · `SYSTEM_DESIGN.md` §4.5 · `EVAL_PLAN.md` §3 · `IMPLEMENTATION_PLAN.md` (§4.1) · `CHANGELOG.md`.

### Ưu tiên 2 — M2, đề xuất thứ tự

| Bước | Task | Lý do |
|---|---|---|
| 1 | **T-M2-12** dataset eval | **Ràng buộc báo cáo** — `EVAL_REPORT.md` là deliverable bắt buộc. Contract đã sẵn sàng. |
| 2 | **T-M2-13 → 14** harness → judge | 1 lệnh chạy được + judge temperature 0 + blind mapping. |
| 3 | **T-M2-15 → 16 → 17** thu thập tay → chấm tay → báo cáo | **Cần người** (thu thập Edge/Gemini, 2 người chấm) → nên **bắt đầu sớm**, tốn thời gian chờ. |
| 4 | **T-M2-03b** budget cap | Priority C · FR-PROVIDER-06 — cảnh báo + tuỳ chọn chặn khi vượt ngưỡng chi phí. |
| 5 | Skills / Tools / MCP / RAG | Tính năng độc quyền — ưu tiên sau eval vì cần thêm thời gian. |

> ✅ **Đã xong:** T-M2-02 (model picker + fallback chain) · T-M2-03 (token & cost UI).
> ⏸ **Tạm dừng:** T-M2-01 (multi-provider — quyết định user 2026-11-10: không thêm provider mới).

> ⚠️ **Cảnh báo về timeline:** T-M2-15/16 cần **người thật** (mở Edge Copilot + Chrome Gemini, ghi transcript; 2 người chấm rubric) → nếu không làm sớm thì **phần eval bắt buộc sẽ không đủ dữ liệu**. Đây là **task có lead-time dài nhất** trong M2.

---

## 9. File cần đọc khi bắt đầu

| Tình huống | Đọc file |
|---|---|
| Bắt đầu chat mới | `AGENTS.md` (root) → `docs/HANDOFF.md` |
| Làm UI | `docs/DESIGN_SYSTEM_BRIEF.md` |
| Viết API / DB | `docs/SYSTEM_DESIGN.md` |
| Biết task tiếp theo | `docs/IMPLEMENTATION_PLAN.md` |
| Biết FR nào ứng với ý tưởng | `docs/REQUIREMENTS.md` |
| So sánh Edge/Gemini | `docs/COMPARISON_MATRIX.md` |
| Làm phần eval | `docs/EVAL_PLAN.md` |
| Thêm entry changelog | `docs/CHANGELOG.md` (xem format) |
| **User muốn tự dùng thử** | `docs/MANUAL_TEST_GUIDE.md` |

---

## 10. Ghi chú cuối

- **Working tree sạch** tại `3211d9c` — không có thay đổi chưa commit.
- **Docker + BFF** đang chạy tại thời điểm tổng hợp (Postgres healthy · `/api/health` → `{"status":"ok","db":"up"}`). Nếu chat mới cần test → khởi động lại: `docker compose up -d` + `pnpm db:migrate` + `pnpm dev:server`.
- Tag `v0.1` đánh dấu M0.
- `apps/eval/dataset/tasks.json` **rỗng** → `pnpm eval:run` in "Dataset rong" — đây là **bình thường**, chưa phải bug.
