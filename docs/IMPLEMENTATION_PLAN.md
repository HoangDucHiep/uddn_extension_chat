# Implementation Plan — Sidekick AI

**Version:** v1.0 · **Ngày:** 2026-11-03
**Tổng thời gian ước tính:** 11 tuần (M0–M3 bắt buộc) + 2 tuần tuỳ chọn (M4)

> Đây là kế hoạch **task-level** để làm được ngay. Mỗi task có mã, FR liên quan, output files, acceptance criteria và estimate.
> Chi tiết kỹ thuật: [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md). Yêu cầu: [`REQUIREMENTS.md`](REQUIREMENTS.md).

---

## 1. Nguyên tắc thực thi

1. **Mỗi task = 1 commit** (hoặc 1 PR nhỏ). Không trộn task.
2. **Sau mỗi task xong** → cập nhật `docs/` liên quan + `docs/CHANGELOG.md` + commit. Đây là rule bắt buộc (xem `AGENTS.md`).
3. **Sau mỗi milestone** → chạy gate (acceptance criteria của milestone) trước khi sang milestone sau.
4. **Ưu tiên:** luôn giữ parity (M1) làm đủ trước; M2 làm sau; M4 chỉ khi đủ điều kiện §6.
5. Task nào làm dở → ghi trạng thái vào `docs/HANDOFF.md` trước khi ngừng.

### 1.1 Quy ước mã task

```
T-M<milestone>-<số>   ví dụ: T-M1-07
```

Estimate: **S** = ≤ 0.5 ngày · **M** = 1–2 ngày · **L** = 3–5 ngày

---

## 2. Milestone M0 — Foundation (2 tuần)

**Mục tiêu:** một extension load được, chat được với 1 provider, streaming hoạt động, DB chạy.
**Gate:** load unpacked OK · `/health` trả `db: up` · gửi prompt nhận stream token · commit tag `v0.1`.

| ID | Task | FR | Output files | AC | Est | Status |
|---|---|---|---|---|---|---|
| T-M0-01 | Init monorepo pnpm workspace + tooling | — | `pnpm-workspace.yaml`, `package.json` (root), `.npmrc`, `.nvmrc`, `.editorconfig`, `.gitignore` | `pnpm install` chạy ở root, không lỗi | S | ✅ |
| T-M0-02 | ESLint + Prettier + TS config dùng chung | NFR-MAINT-01, NFR-SEC-08 | `tsconfig.base.json`, `eslint.config.js`, `.prettierrc` | `pnpm typecheck` pass trên toàn repo | S | ✅ |
| T-M0-03 | `packages/shared`: types + Zod + event union + errors | — | `packages/shared/src/{index.ts,types/,schemas/,events.ts,errors.ts,constants.ts}` | `pnpm build` xong; import được từ app khác | M | ✅ |
| T-M0-04 | Docker Compose: Postgres 16 + pgvector | §6 | `docker-compose.yml`, `apps/server/Dockerfile` | `docker compose up -d` → `SELECT extversion FROM pg_extension WHERE extname='vector'` OK | S | ✅ |
| T-M0-05 | Drizzle schema + migration đầu | §7.2 | `apps/server/src/db/schema.ts`, `drizzle.config.ts`, `apps/server/drizzle/0000_adorable_sister_grimm.sql` | `pnpm db:migrate` xong không lỗi | M | ✅ |
| T-M0-06 | BFF skeleton: express app, `/health`, error middleware, CORS allowlist | NFR-SEC-05 | `apps/server/src/{index.ts,app.ts,config/env.ts,middleware/*}` | `/health` → `{status:'ok',db:'up'}`; request sai origin bị 403 | M | ✅ |
| T-M0-07 | Provider adapter interface + registry + MockProvider | FR-PROVIDER-01, NFR-MAINT-03 | `apps/server/src/providers/{types.ts,registry.ts,mock.ts}` | Unit test: registry trả provider theo id; mock stream trả token | M | ✅ |
| T-M0-08 | Provider adapter Gemini/Groq/OpenRouter (chat + streaming) | FR-PROVIDER-01/03 | `apps/server/src/providers/{gemini.ts,groq.ts,openrouter.ts}` | Gọi API thật với `TEAM_API_KEY` → nhận text | M | ✅ |
| T-M0-09 | Key resolver K1/K2/K3 + crypto AES-256-GCM | FR-PROVIDER-02/08/09, §4.6.1 | `apps/server/src/lib/crypto.ts`, `providers/keyResolver.ts` | Round-trip encrypt/decrypt đúng; sai MASTER_KEY → `PROVIDER_KEY_INVALID` | M | ✅ |
| T-M0-10 | `POST /chat` (SSE) + `packages/shared` event union khớp | FR-CHAT-01 | `apps/server/src/routes/chat.ts`, `src/services/chatService.ts` | Test đủ 8 event type; format `event:`/`data:` đúng | L | ✅ |
| T-M0-11 | Extension scaffold: Vite + React + TS + Tailwind + shadcn | FR-UX-*, NFR-PERF-06 | `apps/extension/{vite.config.ts,vitest.config.ts,src/sidepanel/App.tsx,src/components/ui/*}` | `pnpm dev:ext` mở panel trống, không lỗi console; bundle unpacked ≤ 3MB | M | ✅ |
| T-M0-12 | Manifest V3 + icons + load unpacked | FR-UX-01, NFR-SEC-03 | `apps/extension/public/manifest.json`, `public/icons/*` | Load unpacked OK; mở/toggle side panel bằng toolbar icon | M | ✅ |
| T-M0-13 | `sseClient` phía extension + `useChat` hook tối giản | FR-CHAT-01 | `apps/extension/src/lib/{sseClient.ts,apiClient.ts}`, `hooks/useChat.ts` | Gõ prompt → token hiện dần trong panel | M | ✅ |
| T-M0-14 | Design tokens: `tokens.json` → `tokens.css` | FR-UX-06, FR-SETTINGS-01/02 | `design/tokens.json`, `design/tokens.css`, `apps/extension/src/sidepanel/index.css` | Token có trong `design/tokens.json` được dùng; light+dark theme switch | M | ✅ |
| T-M0-15 | `AGENTS.md` + `.cursor/rules` + `docs/HANDOFF.md` | — | `AGENTS.md`, `.cursor/rules/*.mdc`, `docs/HANDOFF.md` | Chat mới đọc `AGENTS.md` là nắm context | S | ✅ |

**Định mức M0:** 2 tuần · 15 task · ~18 ngày công (3 người → ~2 tuần)

### 2.1 Kết quả verify M0 (2026-11-04)

| Gate | Kết quả |
|---|---|
| `pnpm install` | ✅ pass |
| `pnpm typecheck` | ✅ pass (4 workspace: shared, server, extension, eval) |
| `pnpm lint` | ✅ pass (0 error, 0 warning) |
| `pnpm test` | ✅ pass — shared 15 · server 49 · extension 27 test |
| `pnpm build` | ✅ pass — `apps/extension/dist/` có `manifest.json` + `sidepanel.html` |
| `docker compose up -d` | ✅ `sidekick-db` healthy · pgvector 0.8.7 · 6 bảng |
| `pnpm db:migrate` | ✅ pass |
| `GET /api/health` | ✅ `{status:'ok', db:'up'}` |
| Verify 3 provider | ✅ 3/3 stream thật — Groq `openai/gpt-oss-120b` · OpenRouter `google/gemini-2.5-flash` · Gemini `gemini-3.5-flash` |
| E2E side panel | ✅ 2/2 — load unpacked, render header/composer, gõ prompt nhận token thật + provider chip + design token apply |
| Git clean + tag | ✅ tag `v0.1` |

---

## 3. Milestone M1 — Parity (3 tuần)

**Mục tiêu:** đạt feature parity với Edge Copilot + Chrome Gemini ở các dòng Must.
**Gate:** checklist §E của [`COMPARISON_MATRIX.md`](COMPARISON_MATRIX.md) pass ≥ 90% · demo được trước giảng viên.

| ID | Task | FR | Output files | AC | Est | Status |
|---|---|---|---|---|---|---|
| T-M1-01 | Content script: extractor Readability-lite | FR-CONTEXT-01, NFR-PERF-04 | `apps/extension/src/content/extractor.ts` | Trích được title + nội dung chính trên bài blog/docs; ≤ 800ms cho DOM ≤ 2MB | L | ✅ |
| T-M1-02 | Content script: selection context | FR-CONTEXT-04 | `content/selection.ts` | Bôi đen → panel nhận đúng đoạn text | M | ⬜ |
| T-M1-03 | Service worker: mở/toggle panel, context menu, shortcut | FR-UX-01 | `apps/extension/src/background/*` | Toolbar click toggle; `Ctrl+Shift+K` mở; context menu "Ask Sidekick" | M | ⬜ |
| T-M1-04 | Context chips + toggle bật/tắt context trang | FR-CONTEXT-02, NFR-SEC-02 | `sidepanel/components/context/ContextChips.tsx` | Chip hiển thị domain đang share; bỏ chip được; tắt → không gửi content | M | ✅ *(hấp thụ bởi T-M1-23)* |
| T-M1-05 | `@` mention multi-tab | FR-CONTEXT-03 | `context/MentionPopover.tsx`, `hooks/useTabs.ts` | Gõ `@` → list tab (title+favicon), chọn nhiều được | L | ⬜ |
| T-M1-06 | Truyền context sang BFF (tab list + content) | FR-CONTEXT-01/02/03, FR-CONTEXT-07 | `apps/server/src/lib/contextBuilder.ts` | Log `request_logs.context_hash` khớp với context đã gửi | M | ⬜ |
| T-M1-07 | Markdown render + code block + copy + highlight | FR-CHAT-02/03/04, NFR-SEC-04, NFR-PERF-02 | `sidepanel/components/chat/MessageContent.tsx`, `CodeBlock.tsx`, `MarkdownTable.tsx` | Render table/code; copy → "Đã sao chép"; highlight đúng ngôn ngữ; sanitize HTML (chặn XSS) | L | ⬜ |
| T-M1-08 | Citation chip + popover (đoạn nguồn) | FR-CONTEXT-10 | `context/CitationChip.tsx`, `CitationPopover.tsx` | Click chip → popover hiện đoạn nguồn + mở tab gốc | M | ⬜ |
| T-M1-09 | Chat CRUD: tạo/đổi tên/xoá/ghim/archives | FR-CHAT-08/09/11 | `sidepanel/components/chat/ConversationList.tsx`, store | Thao tác CRUD phản ánh trong UI ngay | L | ⬜ |
| T-M1-10 | Regenerate / Edit-resend / Stop / Continue | FR-CHAT-05/06/07/12/13, FR-UX-05 | `hooks/useChat.ts`, `chat/MessageActions.tsx` | 4 hành vi đúng AC trong §3.1; Esc dừng; Enter gửi / Shift+Enter xuống dòng | L | ⬜ |
| T-M1-11 | Prompt gợi ý theo trang + Summarize 1-click | FR-UX-03/04 | `sidepanel/components/chat/PromptGallery.tsx` | Gợi ý đổi theo loại trang (docs/bài báo/forum) | M | ⬜ |
| T-M1-12 | Settings: theme, cỡ chữ, chiều rộng, quản lý dữ liệu, endpoint BFF | FR-SETTINGS-01/02/03/04/05/06/07, FR-UX-06, NFR-SEC-07 | `sidepanel/components/settings/*` | Áp dụng ngay, persist qua reload; xoá dữ liệu có confirm; telemetry/history mặc định OFF | M | ⬜ |
| T-M1-13 | Export conversation (Markdown / JSON) | FR-CHAT-10 | `lib/export.ts` | Xuất đúng nội dung, mở được bằng Notepad/Markdown viewer | S | ⬜ |
| T-M1-14 | Request logging đầy đủ vào `request_logs` | NFR-MAINT-04, FR-CONTEXT-12, NFR-REL-01, §7.2 | `apps/server/src/lib/requestLogger.ts` | Mỗi lượt chat có 1 dòng log: provider, model, token, cost, ttft, latency; snapshot context hash để tái lập | M | ⬜ |
| T-M1-15 | K3 direct mode (BYOK không cần BFF) | FR-PROVIDER-08/09, NFR-REL-03, NFR-SEC-01 | `lib/crypto.ts`, `lib/directProvider.ts`, `state/keyStore.ts` | Tắt Docker → vẫn chat được với key nhập tay; key mã hoá local | L | ⬜ |
| T-M1-16 | K2 BYOK qua BFF: UI quản lý key | FR-PROVIDER-02, NFR-SEC-01 | `settings/ProviderSettings.tsx`, `POST /providers/keys` | Thêm key → test thành công; list key chỉ hiện 4 ký tự cuối | M | ⬜ |
| T-M1-17 | i18n VI/EN | FR-SETTINGS-06 | `apps/extension/src/i18n/{vi.ts,en.ts,index.ts}` | Đổi ngôn ngữ → toàn bộ UI đổi | M | ⬜ |
| T-M1-18 | Keyboard shortcuts cấu hình được | FR-UX-01 | `settings/ShortcutsSettings.tsx`, `background/commands.ts` | Đổi được phím tắt; tránh xung đột với Chrome mặc định | M | ⬜ |
| T-M1-19 | Empty / loading / error states | FR-UX-03/04/08, FR-CHAT-14, NFR-REL-02/04 | `sidepanel/components/states/*` | 4 trạng thái có UI riêng, không màn hình trắng; retry 1 lần khi lỗi mạng | M | ⬜ |
| T-M1-20 | Responsive 320–640px + a11y pass cơ bản | FR-UX-06/07/09/10, NFR-A11Y-01..05, NFR-PERF-03 | style fixes | Không tràn ngang ở 320px; focus ring đủ; icon có aria-label; streaming OK với screen reader | M | ⬜ |
| T-M1-21 | Trích xuất PDF (text-based) | FR-CONTEXT-05 | `apps/server/src/routes/extract.ts`, `apps/server/src/lib/pdfExtractor.ts`, `apps/server/src/lib/safeFetch.ts`, `apps/extension/src/lib/pageContext.ts` | Detect URL PDF → BFF fetch bytes + parse → `context.text`; PDF scan → báo "không đọc được, hãy upload ảnh"; `file://`/PDF nội bộ → báo rõ | L | ✅ |
| T-M1-22 | Transcript YouTube | FR-CONTEXT-06 | `apps/server/src/routes/extract.ts`, `apps/server/src/lib/youtubeExtractor.ts` | Lấy `captionTracks` → `timedtext` → `context.text`; không có caption / geo-block / consent → báo rõ; không crash chat | M | ✅ |
| T-M1-23 | Ngân sách context & cắt bớt thông minh | FR-CONTEXT-07, FR-CONTEXT-13 | `packages/shared/src/contextBudget.ts`, `apps/extension/src/lib/contextAttach.ts`, `sidepanel/components/context/{ContextChips,ContextBudget}.tsx` | Cắt theo thứ tự selection > tab đính kèm > tab hiện tại > lịch sử chat; UI hiện "đã dùng X/Y token"; không đính kèm gì → chat thuần LLM | M | ✅ |
| T-M1-24 | Upload ảnh (paste / drag-drop / file picker) | FR-VISION-01 | `sidepanel/components/composer/ImageAttachment.tsx`, `lib/imageUpload.ts` | Preview trước khi gửi; xoá được; gửi kèm văn bản; giới hạn kích thước | M | ⬜ |
| T-M1-25 | Onboarding lần đầu (3 bước) | FR-UX-02 | `sidepanel/components/onboarding/*` | Quyền → chọn provider → thử câu hỏi; skippable; cần nhập key hoặc bật Ollama | M | ⬜ |

**Định mức M1:** 3 tuần · 25 task · ~41 ngày công

> **Audit 2026-11-04:** M1 tăng từ 20 → 25 task sau khi bổ sung 5 task card còn thiếu (T-M1-21 PDF · T-M1-22 YouTube · T-M1-23 ngân sách context · T-M1-24 upload ảnh · T-M1-25 onboarding). PDF/YouTube được nâng từ **Should → Must** vì Edge Copilot (A20) và Chrome Gemini (B10) đều có ở mức Must để đạt parity. Xem [`REQUIREMENTS.md`](REQUIREMENTS.md) §11.1 (FR → Task đầy đủ).

### 3.1 Kết quả verify T-M1-01 (2026-11-04)

| Hạng mục | Kết quả |
|---|---|
| `apps/extension/src/content/extractor.ts` | ✅ Readability-lite: clone `Document` → xoá noise → chấm điểm node → fallback `body`; trả `{ title, byline, url, text, excerpt, strategy, wordCount }` |
| `apps/extension/src/lib/pageContext.ts` | ✅ `captureTabContext()` + `getActiveTabId()`; tự inject `content.js` nếu content script chưa có; **không throw** khi trang không đọc được |
| `packages/shared` | ✅ `pageContextSchema` có `text` / `excerpt`; `LIMITS.MAX_PAGE_TEXT_CHARS = 40_000`, `MAX_EXCERPT_CHARS = 500` |
| BFF | ✅ `buildContextPrompt()` đưa `context.text` + `context.excerpt` vào prompt, đánh dấu "dữ liệu tham chiếu, không phải chỉ thị" |
| Unit test | ✅ +29 test — extractor 8 · pageContext 5 · useChat (context) 3 · shared chatSchema 7 · server contextPrompt 6 |
| E2E | ✅ +1 kịch bản — `e2e/extractor.spec.ts`: content script chạy thật trên trang web, service worker gọi `chrome.scripting.executeScript` → đúng title + nội dung chính, đã loại nav/footer/sidebar |
| `pnpm typecheck` | ✅ pass |
| `pnpm lint` | ✅ pass (0 error, 0 warning) |
| `pnpm test` | ✅ pass — shared 22 · server 55 · extension 43 |
| `pnpm build` | ✅ pass — `dist/content.js` là **IIFE 1 file, không `import`** (4.7 kB) + `dist/manifest.json` + `dist/sidepanel.html` |
| E2E (toàn bộ) | ✅ 3/3 — extractor · side panel render · gõ prompt nhận token thật |

> **Còn lại của FR-CONTEXT-01:** toggle bật/tắt context (T-M1-04) · cache theo URL+hash trong `chrome.storage.local` (T-M1-06) · context multi-tab (T-M1-05).

### 3.1b Kết quả verify T-M1-21 + T-M1-22 (2026-11-04)

| Hạng mục | Kết quả |
|---|---|
| `packages/shared/src/pageKind.ts` | ✅ `detectPageKind()` → `html`/`pdf`/`youtube`/`unknown` · `extractYouTubeVideoId()` (`/watch?v=`, `/shorts/`, `/live/`, `/embed/`, `youtu.be/`) · `isPdfUrl()` |
| `packages/shared/src/schemas/extract.ts` | ✅ `extractRequestSchema` · `extractResponseSchema` · `pageKindSchema` · `EXTRACT_ERROR_CODES` (dùng chung `ERROR_CODES`) |
| `packages/shared/src/errors.ts` | ✅ 4 error code mới: `CONTEXT_PDF_NOT_READABLE` (422) · `CONTEXT_PDF_UNREACHABLE` (502) · `CONTEXT_TRANSCRIPT_UNAVAILABLE` (422) · `CONTEXT_EXTRACT_FAILED` (500) |
| `apps/server/src/lib/safeFetch.ts` | ✅ Chống SSRF: chỉ `http(s)` · chặn hostname nội bộ (`localhost`/`*.local`/`*.internal`) · chặn loopback/private/link-local/CGNAT/IPv6 nội bộ/IPv4-mapped · redirect ≤ 3 hop (kiểm tra lại từng hop) · timeout 15s · size cap khi đọc stream |
| `apps/server/src/lib/pdfExtractor.ts` | ✅ `pdfjs-dist@^4.10.38` (legacy build) · gom text item theo toa độ Y giữ newline · `standardFontDataUrl` cho font chuẩn non-embedded · PDF scan → `CONTEXT_PDF_NOT_READABLE` |
| `apps/server/src/lib/youtubeExtractor.ts` | ✅ watch page → InnerTube client `ANDROID` → `captionTracks` → `timedtext` XML → `[mm:ss] text`; ưu tiên `vi` → `en`; track thủ công trước `asr`; **2 tầng**: InnerTube → dự phòng `ytInitialPlayerResponse` trong HTML |
| `apps/server/src/routes/extract.ts` | ✅ `POST /api/extract/pdf` · `POST /api/extract/youtube`; **lỗi nghiệp vụ trả HTTP 200** kèm `error` trong body (chỉ 400 khi body sai schema) |
| `apps/extension/src/lib/extractClient.ts` | ✅ Gọi 2 endpoint qua `fetchJson`; **không bao giờ throw** — lỗi thành `{ error, errorMessage }` |
| `apps/extension/src/lib/pageContext.ts` | ✅ Phân nhánh theo `detectPageKind(url)`: `html` → content script (giữ nguyên T-M1-01) · `pdf`/`youtube` → BFF · `unknown` → context tối thiểu; `sourceKind` + `contextError` |
| `apps/extension/src/sidepanel/components/context/ContextNotice.tsx` | ✅ Banner lỗi trích xuất trên Composer; token `--warning-subtle`/`--warning`/`--text-secondary`; `role="status"` + `aria-live="polite"`; nút đóng có `aria-label` |
| Unit test | ✅ +67 test — shared 16 (`extractSchema.test.ts`) · server 36 (`safeFetch` 12 · `pdfExtractor` 5 · `youtubeExtractor` 14 · `extractRoute` 5) · extension 15 (`extractClient` 4 · `extractContext` 6 · `pageKind` 4 · `pageContext` +1) |
| E2E | ✅ +2 kịch bản — `e2e/extract.spec.ts`: stub BFF → panel hiện `ContextNotice` đúng `data-error-code` cho PDF scan & video không caption |
| `pnpm typecheck` | ✅ pass (shared · server · extension) |
| `pnpm lint` | ✅ pass (0 error, 0 warning) |
| `pnpm test` | ✅ pass — shared 38 · server 91 · extension 58 (tổng **187**) |
| `pnpm build` | ✅ pass — `dist/content.js` vẫn là **IIFE 1 file, không `import`** (4.81 kB) · `pdfjs-dist` chỉ nằm ở `apps/server` |
| `pnpm test:e2e` | ✅ pass — 5/5 (2 kịch bản `extract.spec.ts` + 3 kịch bản cũ) |

> **Rủi ro còn lại:** InnerTube là API không chính thức của YouTube → có thể đổi. Khi hỏng → `CONTEXT_TRANSCRIPT_UNAVAILABLE` → UI báo rõ, chat vẫn chạy. Xem rủi ro đầy đủ ở [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.3.1.

### 3.1c Kết quả verify T-M1-23 (2026-11-04)

> **Quyết định sản phẩm:** đổi mô hình context từ "tự share tab active mỗi lượt" sang "**chỉ những gì user chủ động đính kèm**" (FR-CONTEXT-13 / US-16). Đã chốt với user — phản ánh trung thực trong `REQUIREMENTS.md` §4.2 · `COMPARISON_MATRIX.md` §E · `EVAL_PLAN.md` §7 (FC-9).

| Hạng mục | Kết quả |
|---|---|
| `packages/shared/src/contextBudget.ts` | ✅ `estimateTokens()` (`ceil(chars/4)`) · `applyContextBudget()` (cấp phát theo tier `selection` → `attachment` → `currentTab`, cắt đầu + `truncated` + `droppedChars`, trả `historyBudget`) · `trimHistory()` (giữ lượt mới nhất, luôn giữ lượt user cuối) |
| `packages/shared/src/schemas/chat.ts` | ✅ `contextItemSchema` · `contextBundleSchema` (max 20 item) · `normalizeContext()` — `z.preprocess` nhận **cả** shape mới `{ items }` và shape cũ phẳng `{ url, title, text }` → backward compatible |
| `packages/shared/src/constants.ts` | ✅ `CONTEXT_WINDOWS` (gemini 1M · groq/openrouter 128k · ollama 32k · mock 8k) · `CONTEXT_SAFETY_MARGIN_TOKENS = 2_000` · `MAX_CONTEXT_ITEMS = 20` |
| `apps/server/src/services/chatService.ts` | ✅ `buildContextPrompt()` render item theo tier + nhãn nguồn (`[Đã bôi đen]` · `[Tab đính kèm]` · `[File đính kèm]` · `[Trang hiện tại]`) · `buildProviderMessages()` áp `applyContextBudget()` + `trimHistory()` → **server cắt lại lần nữa (nguồn chân lý)** |
| `apps/extension/src/lib/contextAttach.ts` | ✅ `attachCurrentTab()` bọc `captureTabContext()` (giữ nguyên 3 nhánh html/pdf/youtube của T-M1-01/21/22) → `ContextItem` tier `attachment`; không throw; tab đã đính kèm → không capture lại |
| `apps/extension/src/lib/storage.ts` | ✅ `readContextEnabled()` / `writeContextEnabled()` — persist key `sidekick.contextEnabled` trong `chrome.storage.local`, mọi lỗi bị nuốt |
| `apps/extension/src/sidepanel/store/chatStore.ts` | ✅ `attachedItems` · `contextEnabled` (mặc định `false`) · `budget` · actions `attachItem` / `removeItem` / `clearAttachedItems` / `setContextEnabled` / `hydrateContextEnabled` / `recomputeBudget`; `reset()` giữ nguyên context đã đính kèm |
| `apps/extension/src/sidepanel/hooks/useChat.ts` | ✅ **Bỏ** `captureActiveContext()` → `buildRequestContext()`: `contextEnabled === false` hoặc không có item → **không gửi payload `context`**; ngược lại → `applyContextBudget()` rồi gửi `context.items` |
| `apps/extension/src/sidepanel/components/context/ContextChips.tsx` | ✅ Chip mỗi item (icon theo `kind`: `MousePointer`/`Globe`/`FileText` + title + nút xoá `aria-label` tiếng Việt) · chip toggle `role="switch"` · nút "Thêm trang này" |
| `apps/extension/src/sidepanel/components/context/ContextBudget.tsx` | ✅ Meter "Đã dùng X / Y token" · màu theo ngưỡng `<70%` `--success` · `70–90%` `--warning` · `>90%` `--danger` · dòng phụ "N nguồn bị cắt khỏi context" · `role="status"` + `aria-live="polite"` |
| `apps/extension/src/sidepanel/App.tsx` | ✅ Mount `ContextChips` + `ContextBudget` phía trên `Composer`; `ContextNotice` giữ nguyên |
| Unit test | ✅ **229** test toàn repo — shared 59 (`contextBudget` 25 · `chatSchema` +12) · server 96 (`contextPrompt` mở rộng) · extension 74 (`contextAttach` 6 · `chatStore` +8 · `useChat` context 3) |
| E2E | ✅ `e2e/context.spec.ts` — 4 kịch bản: (1) không đính kèm → request **không** có `context`; (2) bấm "Thêm trang này" → chip hiện + `context.items[0].tier === 'attachment'`; (3) meter hiện "… / … token"; (4) tắt toggle → request không còn `context`. `e2e/extract.spec.ts` cập nhật: phải bấm "Thêm trang này" trước khi trích xuất |
| `pnpm typecheck` | ✅ pass (shared · server · extension) |
| `pnpm lint` | ✅ pass (0 error, 0 warning) |
| `pnpm test` | ✅ pass — shared 59 · server 96 · extension 74 (tổng **229**) |
| `pnpm build` | ✅ pass — `dist/content.js` vẫn là **IIFE 1 file, không `import`** (4.81 kB) |
| `pnpm test:e2e` | ✅ pass — **9/9** (4 kịch bản `context.spec.ts` + 2 `extract.spec.ts` + 3 kịch bản cũ) |

> **Ảnh hưởng parity (cần nói rõ khi trình bày):** Edge Copilot / Chrome Gemini mặc định share tab. Sidekick AI chọn mô hình **đính kèm chủ động** (toggle mặc định TẮT) → đánh đổi 1 điểm "tiện" lấy 1 điểm "minh bạch + riêng tư". Đã ghi trong `COMPARISON_MATRIX.md` §E và `EVAL_PLAN.md` §7 (FC-9) để so sánh công bằng.
>
> **Còn lại:** `@` multi-tab (T-M1-05) → selection (T-M1-02) → upload file (T-M1-24) — 3 nguồn này đều là `ContextItem` mới, chỉ cần tạo item với `tier` đúng; `applyContextBudget()` đã xử lý sẵn.

### 3.2 Traceability FR → Task

> Bảng đầy đủ FR → Task (kèm milestone) nằm ở [`REQUIREMENTS.md`](REQUIREMENTS.md) §11.1 — nơi duy nhất cần cập nhật khi thêm/bớt task.
> Bảng ở đây là **bản rút gọn theo nhóm FR**, dùng để audit nhanh khi sửa plan.

| Nhóm | FR trong nhóm | Task phụ trách | Ghi chú |
|---|---|---|---|
| FR-CHAT-01..14 | 14 FR | T-M0-10 · T-M0-13 · T-M1-07/09/10/11/13/19 | FR-CHAT-04 (bảng Markdown) đã nằm trong T-M1-07 |
| FR-CONTEXT-01..13 | 13 FR | T-M1-01/02/04/05/06/08/14 · **T-M1-21/22/23** · **T-M2-19** | FR-CONTEXT-05/06 nâng lên Must (2026-11-04) · FR-CONTEXT-13 (chat không cần context) do T-M1-23 |
| FR-VISION-01..05 | 5 FR | **T-M1-24** (upload) · **T-M2-22** (mở rộng) | FR-VISION-01 nâng lên M |
| FR-TOOLS-01..06 | 6 FR | T-M2-07/08/09/10/11/18 · **T-M2-20** | FR-TOOLS-03 (web search) tách riêng khỏi tool registry |
| FR-SKILL-01..07 | 7 FR | T-M2-04/05/06 · **T-M2-21** | FR-SKILL-04 (skill mẫu) + FR-SKILL-06 (điều kiện) tách task |
| FR-PROVIDER-01..09 | 9 FR | T-M0-07/08 · T-M1-15/16 · T-M2-01/02/03 | FR-PROVIDER-04 (fallback) nằm trong T-M2-02 |
| FR-WORKFLOW-01..13 | 13 FR | T-M4-01..08 · `FR-WORKFLOW-04` → **M5** | FR-WORKFLOW-04 deferred (rủi ro MV3 `tabs.onUpdated`) |
| FR-SETTINGS-01..07 | 7 FR | T-M0-14 · T-M1-12/17 · **T-M2-19** (FR-SETTINGS-04) | FR-SETTINGS-03/04/05/07 trước đó không có task → gộp vào T-M1-12 |
| FR-UX-01..10 | 10 FR | T-M1-03/10/11/12/18/19/20 · **T-M1-25** | FR-UX-02 (onboarding) tách task riêng T-M1-25 |
| NFR-PERF-01..06 | 6 NFR | T-M0-11 · T-M1-01/07/14/20 · T-M2-13 · T-M3-02/04/09 | NFR là yêu cầu xuyên suốt |
| NFR-SEC-01..08 | 8 NFR | T-M0-02/06/09/12 · T-M1-04/07/15/16 · **T-M2-19** | NFR-SEC-06 (domain nhạy cảm) → T-M2-19 |
| NFR-REL-01..05 | 5 NFR | T-M1-10/14/15/19 · **T-M3-10** | NFR-REL-05 (backup DB) tách task M3 |
| NFR-A11Y-01..05 | 5 NFR | T-M1-20 · T-M3-03 | A11Y pass cơ bản ở M1, audit WCAG đầy đủ ở M3 |
| NFR-MAINT-01..05 | 5 NFR | T-M0-02/07/10 · T-M1-14 · T-M2-04/07/12..17 · **T-M3-11** | NFR-MAINT-05 (ADR) tách task M3 |

**Kết quả audit 2026-11-04:** trước đó **31 FR + 27 NFR (58 yêu cầu)** chưa được map tới task nào trong cột FR của plan, và 2 nhãn FR sai (T-M1-04, T-M1-06). Sau khi bổ sung task card (T-M1-21..25, T-M2-19..22, T-M3-10..11) và ghi bổ sung FR/NFR vào các task card cũ, **mọi FR/NFR đều có ít nhất 1 task** — trừ `FR-WORKFLOW-04` (chủ động defer sang M5).

---

## 4. Milestone M2 — Advanced & Eval (3 tuần)

**Mục tiêu:** các tính năng độc quyền (BYOK, multi-provider, MCP, RAG, skills, log) + **báo cáo eval đầy đủ**.
**Gate:** `docs/EVAL_REPORT.md` hoàn chỉnh (bảng + phân tích + radar + kết luận) · dataset ≥ 40 task × 3 hệ thống · judge đã kiểm chứng.

| ID | Task | FR | Output files | AC | Est |
|---|---|---|---|---|---|
| T-M2-01 | Multi-provider: OpenAI, Anthropic, OpenRouter, Groq, Ollama | FR-PROVIDER-01/03/07 | `apps/server/src/providers/{openai,anthropic,openrouter,groq,ollama}.ts` | Mỗi provider stream được; model list lấy động; phát hiện được Ollama local khả dụng | L |
| T-M2-02 | Model picker + fallback chain | FR-PROVIDER-03/04 | `settings/ModelPicker.tsx`, `providers/fallback.ts` | Provider chính lỗi → tự chuyển provider dự phòng, ghi log | M |
| T-M2-03 | Token & cost calculator + usage UI + budget cap | FR-PROVIDER-05/06 | `lib/cost.ts`, `settings/DataSettings.tsx`, `chat/UsageBadge.tsx` | Hiện token/cost từng lượt; cảnh báo khi vượt budget | M |
| T-M2-04 | Skills: menu `/`, CRUD, builtin library | FR-SKILL-01/02/03, NFR-MAINT-03 | `sidepanel/components/skills/*`, `POST /skills` | `/` → list skill; tạo skill từ message; CRUD đủ | L |
| T-M2-05 | Skill import/export JSON | FR-SKILL-05 | `sidepanel/lib/skillIO.ts` | Export/import round-trip không mất dữ liệu | S |
| T-M2-06 | Skill library browser nội bộ | FR-SKILL-07 | `sidepanel/components/skills/SkillLibrary.tsx` | Xem/lọc skill theo tag | M |
| T-M2-07 | Tool registry (builtin: web search, calculator) | FR-TOOLS-01/02, NFR-MAINT-03 | `apps/server/src/tools/{registry.ts,builtin/*}` | Tool được liệt kê; invoke trả kết quả | L |
| T-M2-08 | MCP client (stdio transport) + server manager | FR-TOOLS-01/02 | `apps/server/src/tools/mcp/{client.ts,manager.ts}` | Kết nối MCP server, liệt kê tool, gọi tool | L |
| T-M2-09 | Tool call UI (collapsible block + approval) | FR-TOOLS-02/06, FR-TOOLS-04 | `sidepanel/components/tools/ToolCallBlock.tsx` | Hiện args/result/kết quả lỗi; approval gate chặn hành động | M |
| T-M2-10 | RAG: embedding + `rag_documents` + search | FR-TOOLS-05 | `apps/server/src/rag/{embedder.ts,retriever.ts,indexer.ts}` | Index lịch sử chat; search trả đoạn liên quan kèm score | L |
| T-M2-11 | RAG UI: toggle + hiện nguồn trong câu trả lời | FR-TOOLS-05 | `settings/ToolsSettings.tsx`, `CitationChip` (mở rộng) | Bật RAG → câu trả lời có citation tới đoạn đã index | M |
| T-M2-12 | Eval: dataset 48 task + snapshot trang | NFR-MAINT-04 | `apps/eval/dataset/tasks.json`, `dataset/snapshots/*` | ≥ 44 task, ≥ 80% có `must_include_facts`, ≥ 40% tiếng Việt; có nhóm `doc_extract` (PDF) + `video_transcript` (YouTube) | L |
| T-M2-13 | Eval: harness runner cho hệ thống ta | NFR-MAINT-04, NFR-MAINT-02 | `apps/eval/runners/{ours.ts,aggregate.ts}` | 1 lệnh chạy được; log TTFT/latency/token/cost; coverage ≥ 70% core logic | L |
| T-M2-14 | Eval: judge prompt + runner + blind mapping | NFR-MAINT-04 | `apps/eval/judge/{prompt.ts,run_judge.ts}` | Judge temperature 0; nhãn ngẫu nhiên; `blind_map.json` | M |
| T-M2-15 | Eval: thu thập thủ công Edge + Gemini (n=3) | NFR-MAINT-04 | `apps/eval/results/manual/**` | Transcript đúng template; ghi rõ điều kiện phụ thuộc gói | L |
| T-M2-16 | Eval: chấm tay Tầng B (2 người) + độ tin cậy | NFR-MAINT-04 | `apps/eval/results/human_rubric.csv` | Tính ρ (judge vs human) và κ (human vs human) | M |
| T-M2-17 | Eval: báo cáo `EVAL_REPORT.md` + radar chart | NFR-MAINT-04 | `docs/EVAL_REPORT.md`, `apps/eval/reports/*` | Có bảng 3 hệ thống, phân tích, kết luận, mục "chỗ ta thua" | L |
| T-M2-18 | Agentic action (nếu kịp — cắt được) | FR-TOOLS-04 | `apps/server/src/tools/agentic/*` | Diff preview + bước xác nhận trước khi ghi | L |
| T-M2-19 | Chính sách context theo domain + lịch sử duyệt opt-in + mode "chỉ dùng trang" | FR-CONTEXT-08/09/11, FR-SETTINGS-04, NFR-SEC-02/06 | `sidepanel/components/settings/ContextPolicy.tsx`, `lib/contextPolicy.ts` | Domain bị chặn → không đọc content, hiện badge; lịch sử duyệt **mặc định TẮT**, bật thì cảnh báo rõ + xoá được; toggle "chỉ dùng trang" per-request | M |
| T-M2-20 | Web search tool (bật/tắt được) | FR-TOOLS-03 | `apps/server/src/tools/builtin/webSearch.ts` | Kết quả có nguồn + ngày; tắt thì model không được gọi tool này | M |
| T-M2-21 | Skill library built-in + skill gắn điều kiện (tab hiện tại / tab kèm theo) | FR-SKILL-04/06 | `sidepanel/components/skills/builtinLibrary.ts`, `apps/server/src/skills/builtin.ts` | ≥ 8 skill mẫu (tóm tắt, giải thích đơn giản, dịch, so sánh, trích xuất dữ liệu, viết email, sinh quiz, kiểm tra hiểu); skill gắn điều kiện chạy được trên tab chỉ định | M |
| T-M2-22 | Vision mở rộng: chụp vùng, OCR, image-capable provider, alt text | FR-VISION-02/03/04/05 | `sidepanel/components/composer/RegionCapture.tsx`, `apps/server/src/lib/ocr.ts` | Chọn vùng bằng overlay; OCR trả text; provider không hỗ trợ image → ẩn tính năng không lỗi; alt text lưu lại để tiết kiệm token | L |

**Định mức M2:** 3 tuần · 22 task · ~39 ngày công
> Nếu trễ: **cắt T-M2-18 (agentic)** → không ảnh hưởng tiêu chí bắt buộc. Cắt T-M2-10/11 (RAG) nếu cần — theo §10. Cắt T-M2-22 (vision mở rộng) trước — chỉ ảnh hưởng tính năng Could.

---

## 5. Milestone M3 — Polish & Deliverable (1 tuần)

**Mục tiêu:** sản phẩm có thể nộp.
**Gate:** Lighthouse a11y ≥ 95 · không lỗi console · README + slide + demo video xong.

| ID | Task | FR / NFR | Output files | AC | Est |
|---|---|---|---|---|---|
| T-M3-01 | Design system hoàn thiện: `components.md`, `patterns.md` | FR-UX-06 | `design/components.md`, `design/patterns.md` | Mọi component đã dùng có spec | M |
| T-M3-02 | States hoàn chỉnh: quota, offline, BFF down, long content | NFR-PERF-05 | `sidepanel/components/states/*` | Mọi state trong `DESIGN_SYSTEM_BRIEF.md` §4 có UI; không rò rỉ > 50MB sau 50 lượt | M |
| T-M3-03 | Accessibility audit WCAG 2.2 AA | NFR-A11Y-01/02/03/04, NFR-MAINT-02 | `design/a11y-audit.md` | Lighthouse ≥ 95; không vi phạm nghiêm trọng | M |
| T-M3-04 | Animation & motion polish + `prefers-reduced-motion` | FR-UX-10, NFR-PERF-02 | `apps/extension/src/styles/*` | Không animation khi reduced-motion | S |
| T-M3-05 | i18n hoàn chỉnh + rà lại text tiếng Việt | FR-SETTINGS-06 | `apps/extension/src/i18n/*` | Không còn chuỗi hardcode | S |
| T-M3-06 | README repo + hướng dẫn cài đặt | NFR-MAINT-01 | `README.md` | Người mới clone → chạy được trong 15 phút | M |
| T-M3-07 | Demo video (3–5 phút) | NFR-MAINT-04 | `docs/demo/*` | Quay được luồng chính + so sánh 3 hệ thống | L |
| T-M3-08 | Slide trình bày (10–12 trang) | FR-UX-06 | `docs/slides/*` | Nêu rõ parity + điểm khác biệt + kết quả eval | L |
| T-M3-09 | Đóng gói extension & chuẩn bị nộp | NFR-PERF-06 | `dist/`, `docs/SUBMISSION.md` | Load unpacked từ zip OK; manifest hợp lệ; bundle unpacked ≤ 3MB | S |
| T-M3-10 | Backup DB tự động (`pg_dump` cron) | NFR-REL-05 | `apps/server/scripts/backup.sh`, `docker-compose.yml` | Cron trong container chạy hằng ngày; file backup có trong volume; restore được | S |
| T-M3-11 | ADR — quyết định kiến trúc lớn | NFR-MAINT-05 | `docs/adr/{0001-streaming-via-bff.md,0002-postgres-pgvector.md,0003-rag-strategy.md,0004-mv3-constraints.md}` | ≥ 4 ADR có context · quyết định · hệ quả · trạng thái (accepted) | S |
**Định mức M3:** 1 tuần · 11 task · ~14 ngày công

---

## 6. Milestone M4 — Workflow (TUỲ CHỌN, 2 tuần)

> ⚠️ **Chỉ bắt đầu khi thỏa cả 3 điều kiện** (xem [`REQUIREMENTS.md`](REQUIREMENTS.md) §9.4):
> 1. M0–M3 xong và demo được
> 2. `EVAL_REPORT.md` đã có bảng + phân tích + kết luận
> 3. Còn ≥ 2 tuần trước deadline

**Gate:** ≥ 3 workflow mẫu chạy thật · 1 workflow theo lịch tự fire đúng giờ khi panel đóng · notification hoạt động.

| ID | Task | FR | Output files | AC | Est |
|---|---|---|---|---|---|
| T-M4-01 | Scheduler (node-cron) trong BFF | FR-WORKFLOW-03 | `apps/server/src/scheduler/{index.ts,cron.ts}` | Job fire đúng lịch, chạy trong container | L |
| T-M4-02 | Workflow CRUD + template mẫu | FR-WORKFLOW-01/02/08 | `apps/server/src/routes/workflows.ts`, `sidepanel/components/workflow/*` | CRUD đủ (tạo/sửa/xoá/bật-tắt/nhân bản); có ≥ 3 template | L |
| T-M4-03 | Multi-step, truyền dữ liệu giữa bước + điều kiện phân nhánh | FR-WORKFLOW-05/06 | `apps/server/src/workflow/engine.ts` | Bước sau nhận output bước trước; nhánh if/then do model đánh giá, hiển thị rõ nhánh đã chọn | L |
| T-M4-04 | Run log chi tiết từng bước | FR-WORKFLOW-09 | `workflow_runs`, `workflow_step_runs`, UI log | Xem được từng bước, token, chi phí, lỗi | M |
| T-M4-05 | Import/export workflow JSON | FR-WORKFLOW-10 | `sidepanel/lib/workflowIO.ts` | Round-trip giữ nguyên | S |
| T-M4-06 | Notification khi run xong | FR-WORKFLOW-11 | `apps/extension/src/background/notifications.ts` | Notification hiện khi workflow xong (panel đóng); tắt được | M |
| T-M4-07 | Approval gate (phê duyệt trước hành động) | FR-WORKFLOW-07 | `sidepanel/components/workflow/ApprovalCard.tsx` | Workflow dừng, hiện diff, chờ Phê duyệt/Từ chối | M |
| T-M4-08 | An toàn: giới hạn bước, quota/ngày, dry-run | FR-WORKFLOW-12/13 | `workflow/engine.ts`, settings | ≤ 10 bước; quota chạy/ngày; dry-run không side-effect | M |
| T-M4-09 | Eval nhóm task `workflow` | NFR-MAINT-04 | `apps/eval/dataset/tasks.workflow.json` | Có số liệu so sánh cho nhóm workflow (nếu kịp) | M |

**Định mức M4:** 2 tuần · 9 task · ~16 ngày công

> **Deferred khỏi M4:** `FR-WORKFLOW-04` (trigger theo sự kiện — tab mới mở / trang chứa từ khoá) → đẩy sang **M5**. Lý do: `chrome.tabs.onUpdated` không đáng tin trong MV3 (SW bị kill ~30s) → phải dùng `chrome.alarms` ≥ 30s hoặc polling danh sách tab; đây là hạng mục rủi ro cao, không nằm trên đường găng. Xem [`REQUIREMENTS.md`](REQUIREMENTS.md) §9.4.

---

## 7. Definition of Done

### 7.1 DoD cho một task
- [ ] Code chạy đúng AC trong bảng task
- [ ] Không còn lỗi TypeScript, ESLint
- [ ] Có test (unit hoặc integration) cho logic không trivial
- [ ] **Docs liên quan đã cập nhật** (REQUIREMENTS nếu đổi hành vi / SYSTEM_DESIGN nếu đổi API hoặc schema / DESIGN_SYSTEM nếu đổi UI)
- [ ] `docs/CHANGELOG.md` có 1 dòng mô tả thay đổi
- [ ] `docs/HANDOFF.md` cập nhật trạng thái nếu task dang dở
- [ ] Commit message theo convention: `feat(<scope>):`, `fix(<scope>):`, `docs:`, `chore:`

### 7.2 DoD cho một milestone
- [ ] Tất cả task trong milestone đã done hoặc bị cắt có lý do ghi rõ
- [ ] Acceptance gate của milestone pass
- [ ] Docs cập nhật đầy đủ, không còn mâu thuẫn giữa các file
- [ ] `docs/CHANGELOG.md` có entry cho milestone
- [ ] Tag git: `v0.1` (M0) · `v0.2` (M1) · `v0.3` (M2) · `v1.0` (M3) · `v1.1` (M4)

---

## 8. Timeline gợi ý theo tuần

| Tuần | Milestone | Nội dung chính | Song song |
|---|---|---|---|
| W1 | M0 | T-M0-01 → T-M0-07 | A: tooling+DB · B: shared types · C: extension scaffold |
| W2 | M0 | T-M0-08 → T-M0-15 | A: provider+chat SSE · B: extension UI shell · C: tokens+manifest |
| W3 | M1 | T-M1-01 → T-M1-05 | A: content script · B: chat UI · C: settings + i18n |
| W4 | M1 | T-M1-06 → T-M1-12 | A: context+citations · B: chat actions · C: settings/logging |
| W5 | M1 | T-M1-13 → T-M1-20 + gate | A: K3/K2 key · B: states/a11y · C: export + shortcuts |
| W5.5 | M1 | T-M1-21 → T-M1-25 | A: PDF + YouTube extractor · B: upload ảnh · C: context budget + onboarding |
| W6 | M2 | T-M2-01 → T-M2-06 | A: providers · B: skills · C: tools |
| W7 | M2 | T-M2-07 → T-M2-11 | A: MCP · B: RAG · C: usage UI |
| W8 | M2 | T-M2-12 → T-M2-17 (eval) | A: dataset · B: harness+judge · C: thu thập thủ công |
| W9 | M2 | T-M2-18 → T-M2-22 + **EVAL_REPORT** | Cả 3 → viết báo cáo eval + task bổ sung M2 |
| W10 | M3 | T-M3-01 → T-M3-11 | A: DS + a11y · B: README+slide · C: demo video + backup + ADR |
| W11 | buffer | Sửa lỗi, nộp bài | Cả 3 |
| W12–13 | M4 (tuỳ chọn) | T-M4-01 → T-M4-09 | Nếu đủ điều kiện §6 |

---

## 9. Phân công gợi ý cho 3 thành viên

| Vai trò | Trách nhiệm chính | Task chủ yếu |
|---|---|---|
| **A — Backend / AI** | BFF, provider adapters, extractors (PDF/YouTube), tools, MCP, RAG, scheduler, eval harness | T-M0-03..10, T-M1-06/14/15/16/**21/22/23**, T-M2-01/02/07/08/10/13/14/19/20/21/22, T-M3-10, T-M4-* |
| **B — Frontend / UX** | Side panel React, design system, states, a11y, i18n, demo assets | T-M0-11..14, T-M1-01/02/04/05/07/08/09/10/11/19/20/**23/24/25**, T-M3-01..05/07/08/11 |
| **C — Integration / Data / Docs** | Manifest, background, settings, logging, eval dataset + thu thập, docs | T-M0-01/02/04/12/15, T-M1-03/12/13/16/17/18/**21**, T-M2-03..06/09/11/12/15/16/17, T-M3-06/09 |

**Cách phối hợp:** đầu mỗi tuần họp 30 phút chia task. Task giao diện (contract API) chỉ bắt đầu **sau khi** `packages/shared` đã có type tương ứng.

---

## 10. Kịch bản thiếu thời gian

Tuần theo [`REQUIREMENTS.md`](REQUIREMENTS.md) §9.3 — thứ tự cắt an toàn:

| Thứ tự cắt | Cắt gì | Task liên quan | Ảnh hưởng |
|---|---|---|---|
| 1 | **M4 toàn bộ** | T-M4-* | Không ảnh hưởng tiêu chí bắt buộc |
| 2 | Agentic action | T-M2-18 | Không ảnh hưởng eval bắt buộc |
| 3 | RAG | T-M2-10, T-M2-11 | Đã có log + export transcript thay thế một phần |
| 4 | Vision mở rộng (chụp vùng, OCR, alt text) | T-M2-22 | Chỉ ảnh hưởng tính năng Could |
| 5 | Web search tool | T-M2-20 | Model vẫn trả lời được, chỉ thiếu tool search |
| 6 | Skill library built-in + điều kiện | T-M2-21 | Vẫn có CRUD skill cơ bản (T-M2-04) |
| 7 | Chính sách context theo domain | T-M2-19 | Chỉ ảnh hưởng nhóm tính năng riêng tư — đánh dấu N/A trong eval |
| 8 | Voice | (chưa có task riêng) | Đánh dấu N/A trong eval |
| 9 | Skill library browser | T-M2-06 | Vẫn có CRUD skill cơ bản |
| 10 | Budget cap / usage chart | T-M2-03 (giảm scope) | Vẫn hiện token/cost từng lượt |

**Không được cắt:** streaming chat · đọc nội dung trang (HTML) · **trích xuất PDF** (T-M1-21) · **transcript YouTube** (T-M1-22) · **ngân sách context** (T-M1-23) · **upload ảnh** (T-M1-24) · **onboarding** (T-M1-25) · multi-tab `@` · selection context · citations · lịch sử conversation · settings · logging đầy đủ · toàn bộ phần eval.

> **Lưu ý 2026-11-04:** T-M1-21 (PDF) và T-M1-22 (YouTube) được nâng từ **Should → Must** trong [`REQUIREMENTS.md`](REQUIREMENTS.md) §4.2 → **không được cắt** nếu muốn đạt parity với Edge Copilot (A20) và Chrome Gemini (B10). Nếu deadline siết nghiêm trọng, phương án thay thế an toàn: giữ mức Must nhưng dời T-M1-21/22 xuống **đầu M2** (ngay sau gate M1) — phải ghi rõ trong `docs/HANDOFF.md` và báo cáo eval.

---

## 11. Liên kết

- [`REQUIREMENTS.md`](REQUIREMENTS.md) — nguồn FR/NFR
- [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) — kiến trúc, API, schema, test
- [`DESIGN_SYSTEM_BRIEF.md`](DESIGN_SYSTEM_BRIEF.md) — token & component
- [`COMPARISON_MATRIX.md`](COMPARISON_MATRIX.md) — parity checklist
- [`EVAL_PLAN.md`](EVAL_PLAN.md) — kế hoạch eval
- [`HANDOFF.md`](HANDOFF.md) — bắt đầu chat mới
