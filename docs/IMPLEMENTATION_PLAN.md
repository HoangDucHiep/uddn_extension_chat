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
| T-M1-02 | Content script: selection context | FR-CONTEXT-04 | `content/selection.ts` | Bôi đen → panel nhận đúng đoạn text | M | ✅ |
| T-M1-03 | Service worker: mở/toggle panel, context menu, shortcut | FR-UX-01 | `apps/extension/src/background/*` | Toolbar click toggle; `Ctrl+Shift+K` mở; context menu "Ask Sidekick" | M | ⬜ |
| T-M1-04 | Context chips + toggle bật/tắt context trang | FR-CONTEXT-02, NFR-SEC-02 | `sidepanel/components/context/ContextChips.tsx` | Chip hiển thị domain đang share; bỏ chip được; tắt → không gửi content | M | ✅ *(hấp thụ bởi T-M1-23)* |
| T-M1-05 | `@` mention multi-tab | FR-CONTEXT-03 | `context/MentionPopover.tsx`, `hooks/useTabs.ts`, `hooks/useMention.ts`, `lib/tabList.ts` | Gõ `@` → list tab (title+favicon), chọn nhiều được | L | ✅ |
| T-M1-06 | Truyền context sang BFF (tab list + content) | FR-CONTEXT-01/02/03, FR-CONTEXT-07, FR-CONTEXT-12 | `packages/shared/src/contextHash.ts`, `apps/server/src/services/chatService.ts`, `apps/extension/src/lib/contextCache.ts` | Log `request_logs.context_hash` khớp với context đã gửi | M | ✅ |
| T-M1-07 | Markdown render + code block + copy + highlight | FR-CHAT-02/03/04, NFR-SEC-04, NFR-PERF-02 | `sidepanel/components/chat/MessageContent.tsx`, `CodeBlock.tsx`, `MarkdownTable.tsx` | Render table/code; copy → "Đã sao chép"; highlight đúng ngôn ngữ; sanitize HTML (chặn XSS) | L | ✅ *(2026-11-06)* |
| T-M1-08 | Citation chip + popover (đoạn nguồn) | FR-CONTEXT-10 | `sidepanel/components/chat/CitationChip.tsx`, `CitationPopover.tsx`, `CitationList.tsx`, `chat/citationPlugin.ts` | Click chip → popover hiện đoạn nguồn + mở tab gốc | M | ✅ *(2026-11-06)* |
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
| T-M1-24 | Upload ảnh (paste / drag-drop / file picker) | FR-VISION-01 | `packages/shared/src/schemas/vision.ts`, `apps/extension/src/lib/imageUpload.ts`, `sidepanel/components/composer/AttachmentTray.tsx`, `sidepanel/hooks/useImageAttachments.ts`, `apps/server/src/services/attachmentService.ts`, `apps/server/src/routes/attachments.ts` | Preview trước khi gửi; xoá được; gửi kèm văn bản; giới hạn kích thước (5 MB/ảnh, 4 ảnh/lượt); lưu Postgres (`message_attachments`) + multi-turn; provider vision (`inline_data` / `image_url`) + fallback chain | M | ✅ *(2026-11-05)* |
| T-M1-25 | Onboarding lần đầu (3 bước) | FR-UX-02 | `sidepanel/components/onboarding/*`, `sidepanel/hooks/useOnboarding.ts`, `sidepanel/lib/onboarding.ts`, `apps/server/src/routes/providers.ts`, `apps/server/src/services/providerService.ts`, `apps/server/src/providers/ollama.ts` | Quyền → chọn provider → thử câu hỏi; skippable; cần nhập key hoặc bật Ollama | M | ✅ *(2026-11-05)* |

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

> **Còn lại của FR-CONTEXT-01:** toggle bật/tắt context (T-M1-04 ✅) · cache theo URL+hash trong `chrome.storage.local` (**T-M1-06 ✅**) · context multi-tab (T-M1-05 ✅).

### 3.1i Kết quả verify T-M1-06 (2026-11-05)

> Chi tiết kiến trúc: [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.3.5.

| Hạng mục | Kết quả |
|---|---|
| `packages/shared/src/contextHash.ts` | ✅ `hashString()` (FNV-1a 32-bit → hex) · `hashContextItems()` (deterministic: sort theo `CONTEXT_TIER_ORDER` rồi `id`, nối `id\|kind\|tier\|url\|title\|sourceKind\|text` bằng `\u0000`) · `contextHashKey()` (bỏ fragment/query, lowercase host) |
| `packages/shared/src/constants.ts` | ✅ `CONTEXT_CACHE_TTL_MS = 30 phút` · `CONTEXT_CACHE_MAX_ENTRIES = 20` |
| `apps/server/src/services/chatService.ts` | ✅ `resolveContextItems()` — chạy `applyContextBudget()` **một lần**, là nguồn sự thật duy nhất cho cả prompt builder lẫn log · `context_hash` = hash context **đã cắt** (không còn là hash toàn bộ prompt) · `context_snapshot` jsonb ghi **theo setting** |
| `apps/server/src/config/env.ts` | ✅ `LOG_CONTEXT_SNAPSHOT` (mặc định `false`) → `ChatServiceDeps.logContextSnapshot` — cờ **riêng**, không gộp `logFullContent` |
| `apps/extension/src/lib/contextCache.ts` | ✅ `readCachedContext()` · `writeCachedContext()` (+ prune) · `clearContextCache()` · `toCacheEntry()` · `hasContentChanged()` — lưu `chrome.storage.local` key `sidekick.contextCache`, lỗi storage **không throw** |
| `apps/extension/src/lib/contextAttach.ts` | ✅ `attachTab()` ghi cache khi trích xuất thành công · **fallback** về bản cache khi trang đang lỗi · nội dung không đổi → không reset TTL |
| Unit test | ✅ +30 test — shared `contextHash` 17 · server `requestLogContext` 10 · extension `contextCache` 15 (+2 bổ sung trong `contextAttach`) |
| E2E | ✅ +3 kịch bản — `e2e/contextCache.spec.ts`: đính kèm 2 lần → 1 chip · cache vào `chrome.storage.local` · trang lỗi → fallback cache |
| `pnpm typecheck` | ✅ pass (0 error) |
| `pnpm lint` | ✅ pass (0 error, 0 warning) |
| `pnpm test` | ✅ pass — shared 140 · server 224 · extension 332 = **696** unit test |
| `pnpm build` | ✅ pass — không thêm dependency, `dist/content.js` vẫn IIFE 1 file |
| `pnpm db:migrate` | ✅ pass — **không** có migration mới (`context_hash` + `context_snapshot` đã có sẵn trong `0000`) |
| E2E (toàn bộ) | ✅ 32/32 pass |
| Mutation spot-check | ✅ 5/5 bị bắt (bỏ sort · hash prompt · bỏ snapshot · bỏ check `contentHash` · bỏ prune) — chi tiết [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.2.2 |

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

### 3.1d Kết quả audit chất lượng test + sửa hạ tầng test (2026-11-04)

> **Động lực:** user yêu cầu rà soát xem test có thực tế / có bị thiên lệch không. Đã thực hiện **mutation audit** (scratch script, không commit) + probe trực tiếp fixture.

| Hạng mục | Kết quả |
|---|---|
| Mutation audit (~78 mutation trên logic cốt lõi) | ✅ Phần lớn bị test bắt → **không có bằng chứng test bị "tình cho đúng"** |
| Blind spot tìm được | ⚠️ **8** (3 test extractor đi nhánh khác tên · thiếu fixture biên · chỉ assert độ dài chứ không assert phần giữ lại · chưa test validate `role` · **chưa có test nào cho `lib/storage.ts`** · `chatService.ts` coverage 25% · provider thật chưa test) — chi tiết [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.2.2 |
| **Lỗi hạ tầng nghiêm trọng** | 🔴 Test extension/server resolve `@sidekick/shared` từ **`dist` (bản build)** → sửa `packages/shared/src` mà quên build là test **vẫn xanh** (chứng minh: inject `throw` → test vẫn PASS 16/16) |
| Đã sửa | ✅ Alias vitest → `packages/shared/src` (extension · server · eval) · `pre` hooks build shared (root) · `dev:shared` watch trong `pnpm dev` · guard test `sharedAlias.test.ts` |
| Fresh clone (`dist` bị `.gitignore`) | ✅ `pnpm test` · `pnpm typecheck` · `pnpm build` · `pnpm dev` đều chạy được (trước đây fail `Cannot find module "@sidekick/shared"`) |
| `pnpm typecheck` | ✅ pass (shared · server · extension · eval) |
| `pnpm lint` | ✅ pass (0 error) — đã sửa 3 lỗi ESLint tồn đọng |
| `pnpm test` | ✅ pass — shared 59 · server 99 · extension 77 (tổng **235**) |
| `pnpm test:e2e` | ✅ pass — **9/9** |

> **Backlog M1 (thứ tự ưu tiên):** (1) test `lib/storage.ts` — persist toggle context chưa được kiểm chứng, ảnh hưởng UX thật · (2) assert **phần giữ lại** sau khi cắt context (đầu vs cuối) · (3) test validate `role` ở biên API · (4) sửa 3 fixture extractor đi sai nhánh + thêm fixture biên (chỉ `<title>` · chỉ `<h1>` · link-density cao) · (5) test `chatService.ts` + provider adapter thật (mock `fetch` SSE).
>
> **Ghi chú:** chưa có CI trong repo → xem `SYSTEM_DESIGN.md` §7.2.2. Đề xuất thêm GitHub Actions (typecheck + lint + test + build + e2e) ở milestone M3.

### 3.1e Kết quả T-M1-05 (`@` multi-tab) + đóng 8 blind spot test (2026-11-04)

> **Động lực:** 2 task trong 1 phiên — (a) implement FR-CONTEXT-03 (`@` mention multi-tab), (b) đóng **toàn bộ 8 blind spot** test đã ghi ở [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.2.2 (backlog từ 3.1d).

#### Phần A — T-M1-05 `@` multi-tab

| Hạng mục | Kết quả |
|---|---|
| `apps/extension/src/lib/tabList.ts` | ✅ `listOpenTabs(limit)` — `chrome.tabs.query({ currentWindow: true })` + lọc `detectPageKind() === 'unknown'` (`chrome://`/`file://`) + `domainOf()` (bỏ `www.`) · **không throw** (lỗi → `[]`) |
| `apps/extension/src/sidepanel/hooks/useTabs.ts` | ✅ `useTabs(enabled)` — nạp **lazy** (chỉ khi popover mở) + `reload()` |
| `apps/extension/src/sidepanel/hooks/useMention.ts` | ✅ `findMention()` (thuần) — `@` phải ở đầu/sau khoảng trắng (email `a@b.com` không bật) · `useMention()` — state mở/đóng + `apply()` chèn `@tên tab ` + cơ chế "đóng token" sau `Escape` |
| `apps/extension/src/sidepanel/components/context/MentionPopover.tsx` | ✅ favicon · title · domain · ✓ (đã đính kèm) · gạch (tab active) · trạng thái loading/rỗng · `role="listbox"` + `role="option"` + `aria-selected` |
| `apps/extension/src/lib/contextAttach.ts` | ✅ `attachTab(tabId)` — bọc `captureTabContext()` thành `ContextItem { id: 'tab-N', tier: 'attachment' }` · **không** capture lại tab đã đính kèm |
| `apps/extension/src/sidepanel/hooks/useChat.ts` | ✅ `attachTab(tabId)` — cầu nối store ↔ `contextAttach` |
| `apps/extension/src/sidepanel/components/Composer.tsx` | ✅ `onCursorChange` + `onEscape` + `inputRef` (cần cho phát hiện token `@` + đưa con trỏ về đúng chỗ) |
| `apps/extension/src/sidepanel/App.tsx` | ✅ Lọc tab theo query · chèn `@tên tab` vào textarea · đính kèm tab đã chọn · highlight tab active |

#### Phần B — Đóng 8 blind spot test

| Blind spot | Fix | File test |
|---|---|---|
| #1 fallback extractor đi nhánh khác | Fixture mọi block < `MIN_BLOCK_LENGTH` → mọi node điểm 0 | `apps/extension/tests/extractor.test.ts` |
| #2 dedup lồng nhau không kích hoạt | Fixture `<blockquote><p>` (`blockquote` ∈ `BLOCK_SELECTOR`) | cùng file |
| #3 `NEGATIVE_PATTERN` trong candidate | Fixture `.ad-banner` / `.comment` lồng trong `<article>` | cùng file |
| #4 thiếu fixture biên | 3 test: chỉ `<title>` · chỉ `<h1>` · link-density cao | cùng file |
| #5 chỉ assert độ dài | Assert **phần đầu được giữ** + đúng số ký tự | `packages/shared/tests/contextBudget.test.ts` |
| #6 chưa validate `role`/`id`/history | 4 test role/history + `describe('contextItemSchema')` | `packages/shared/tests/chatSchema.test.ts` |
| #7 chưa test `lib/storage.ts` | 10 test (đọc/ghi, giá trị không phải boolean, storage lỗi → không throw) | `apps/extension/tests/storage.test.ts` **(mới)** |
| #8 `chatService` + provider chưa test | 14 test `chatService` + 13 test `openaiCompatible` (mock `fetch` SSE) | `apps/server/tests/chatService.test.ts` **(mới)** · `apps/server/tests/openaiCompatible.test.ts` **(mới)** |

#### Verify

| Hạng mục | Kết quả |
|---|---|
| `pnpm typecheck` | ✅ pass (shared · server · extension · eval) |
| `pnpm lint` | ✅ pass (0 error) |
| `pnpm test` | ✅ pass — shared **75** · server **126** · extension **131** (tổng **332**, trước 235 → **+97**) |
| `pnpm build` | ✅ pass — `dist/content.js` vẫn là **IIFE 1 file, không `import`** (4.81 kB) |
| `pnpm test:e2e` | ✅ pass — **13/13** (+4 kịch bản `mention.spec.ts`) |
| Mutation re-check | ✅ **5/5 mutation bị bắt** (cắt cuối thay cắt đầu · bỏ guard `@` trong email · bỏ filter `chrome://` · bỏ `404` khỏi retryable · bỏ context khỏi prompt) — chi tiết [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.2.2 |

> **Đã sửa thêm:** `apps/server/vitest.config.ts` thêm `testTimeout: 30_000` — `pdfExtractor.test.ts` timeout giả khi 12 worker chạy song song (không phải lỗi logic).

### 3.1f Kết quả T-M1-02 — selection context (FR-CONTEXT-04) (2026-11-04)

> **Động lực:** implement FR-CONTEXT-04 — bôi đen vùng text trên trang web → đoạn đó trở thành `ContextItem { kind: 'selection', tier: 'selection' }` (tier **cao nhất** theo `CONTEXT_TIER_ORDER`).

#### Phần A — Lõi thuần (test được, không phụ thuộc Chrome API)

| Hạng mục | Kết quả |
|---|---|
| `packages/shared/src/constants.ts` | ✅ `LIMITS.MAX_SELECTION_CHARS` (10 000) · `LIMITS.MIN_SELECTION_CHARS` (10) · `SELECTION_PENDING_TTL_MS` (300 000) |
| `apps/extension/src/content/selection.ts` | ✅ **Thuần**: `readSelectionFromDocument()` · `normalizeSelectionText()` (gộp whitespace, bỏ ký tự điều khiển, cắt tại ranh giới từ, **không** cắt giữa surrogate pair) · `isMeaningfulSelection()` · `selectionAnchorRect()` (neo dưới vùng chọn, chuyển lên trên khi tràn, clamp viewport) |
| `apps/extension/src/lib/contextAttach.ts` | ✅ `attachSelection()` → `ContextItem` (id = hash nội dung `selection-<hash>` → bôi đen lại cùng đoạn **thay** item cũ) · `captureActiveSelection()` → `chrome.scripting.executeScript` (lỗi/trang nội bộ → `undefined`, không throw) |

#### Phần B — Content script: bắt selection + nút nổi

| Hạng mục | Kết quả |
|---|---|
| `apps/extension/src/content/selectionWatcher.ts` | ✅ Nghe `mouseup` + `keyup` (Shift/⌘A) → debounce 120 ms → hiện nút · `selectionchange` rỗng / `scroll` → ẩn nút · không hiện khi selection < 10 ký tự |
| `apps/extension/src/content/selectionButton.ts` | ✅ Nút "Hỏi Sidekick" trong `attachShadow({ mode: 'open' })` · `position: fixed` · `z-index: 2147483647` · `data-testid="selection-affordance"` · icon SVG viết tay (không kéo `lucide-react` vào content script) |
| `apps/extension/src/content/selectionStyles.ts` | ✅ CSS shadow root **sinh từ `design/tokens.json`** + biến thể `prefers-color-scheme: dark` — không hardcode màu |
| `apps/extension/src/content/contentScript.ts` | ✅ Khởi động watcher · click nút nổi → `chrome.runtime.sendMessage({ action: 'sidekick:selection' })` · expose `window.__sidekickGetSelection()` cho đường B · **giữ nguyên** `EXTRACT_CONTENT_ACTION` + `__sidekickExtractContent` (không regression T-M1-01) |
| `apps/extension/src/types/globals.d.ts` | ✅ Khai báo `__sidekickGetSelection` |

#### Phần C — Service worker relay (open-with-fallback)

| Hạng mục | Kết quả |
|---|---|
| `apps/extension/src/lib/selectionProtocol.ts` | ✅ `SELECTION_ACTION` · `PendingSelection` · `isSelectionMessage()` (type guard thuần — **không** kéo `zod` vào content script) · `selectionItemId()` (hash FNV-1a) · `SELECTION_EMPTY_ERROR_CODE` |
| `apps/extension/src/lib/storage.ts` | ✅ `PENDING_SELECTION_STORAGE_KEY` = `sidekick.pendingSelection` · `writePendingSelection()` · `readPendingSelection()` (bỏ qua + xoá nếu quá TTL) · `consumePendingSelection()` · `clearPendingSelection()` |
| `apps/extension/src/lib/selectionBridge.ts` | ✅ `handleSelectionMessage()` — ghi storage **trước**, rồi **thử** `chrome.sidePanel.open({ windowId })` bọc `try/catch` (Chrome từ chối vì mất user gesture → im lặng, panel mở sau tự nhận) |
| `apps/extension/src/background/serviceWorker.ts` | ✅ `chrome.runtime.onMessage` → `handleRuntimeMessage()` — không giữ state lâu dài, không proxy streaming |

#### Phần D — Side panel nhận & đính kèm

| Hạng mục | Kết quả |
|---|---|
| `apps/extension/src/sidepanel/hooks/useSelection.ts` | ✅ Consume khi **mount** + khi `chrome.storage.onChanged` bắn · bỏ qua payload quá TTL · `onAttach` giữ trong `ref` (không chạy lại effect mỗi render) |
| `apps/extension/src/sidepanel/hooks/useChat.ts` | ✅ `attachSelection()` (đường A) + `attachActiveSelection()` (đường B) → `attachItem()` + `setContextError()` khi rỗng |
| `apps/extension/src/sidepanel/components/context/ContextChips.tsx` | ✅ Nút "Dính đoạn đã chọn" (icon `MousePointer2`, `data-testid="context-add-selection"`), disabled khi `isAttaching` |
| `apps/extension/src/sidepanel/App.tsx` | ✅ `useSelection()` + truyền `onAttachSelection` xuống `ContextChips` |
| `apps/extension/src/sidepanel/components/context/ContextNotice.tsx` | ✅ Case `CONTEXT_SELECTION_EMPTY` → "Chưa có đoạn văn bản nào được bôi đen — hãy bôi đen một đoạn trên trang trước." |

#### Verify

| Hạng mục | Kết quả |
|---|---|
| `pnpm typecheck` | ✅ pass (shared · server · extension · eval) |
| `pnpm lint` | ✅ pass (0 error, 0 warning) |
| `pnpm test` | ✅ pass — shared **75** · server **126** · extension **218** (tổng **419**, trước 332 → **+87**) |
| `pnpm build` | ✅ pass — `dist/content.js` vẫn là **IIFE 1 file, không `import`** (13.9 kB, trước 4.81 kB — tăng do thêm watcher + nút nổi) |
| `pnpm test:e2e` | ✅ pass — **18/18** (+5 kịch bản `selection.spec.ts`, 13 test cũ **không regression**) |
| Mutation re-check | ✅ **5/5 mutation bị bắt** — bỏ guard `MIN_SELECTION_CHARS` (7 test fail) · bỏ lọc TTL (2 test fail) · đổi `tier: 'selection'` → `'attachment'` (2 test fail) · bỏ guard độ dài trong `captureActiveSelection` (1 test fail) · đảo thuật toán neo nút nổi (1 test fail) |

> **Ghi chú về bundle:** `dist/content.js` tăng 4.81 kB → 13.9 kB do thêm watcher + nút nổi + CSS shadow root. Vẫn là IIFE 1 file, **không** có `import` → Chrome load được (đã kiểm tra sau build).

### 3.1g Kết quả T-M1-24 — upload ảnh & vision input (FR-VISION-01) (2026-11-05)

> **Quyết định kiến trúc (chốt với user):** (a) **lưu ảnh trong Postgres** (bảng `message_attachments`) để reload panel / lịch sử conversation vẫn có ảnh và multi-turn vision hoạt động; (b) **vision đầy đủ** trên Gemini (`inline_data`) + Groq/OpenRouter (`image_url`).
>
> **Quyết định quan trọng:** ảnh **KHÔNG phải** `ContextItem` — nó là **đầu vào trực tiếp** của câu hỏi. Vì vậy không phụ thuộc toggle `contextEnabled` và không bị `applyContextBudget()` cắt theo số ký tự.

#### Phần A — Contract shared

| Hạng mục | Kết quả |
|---|---|
| `packages/shared/src/schemas/vision.ts` | ✅ `IMAGE_MIME_TYPES` (png/jpeg/webp/gif) · `imageAttachmentSchema` (id uuid, mimeType, base64 thuần, bytes, width/height/fileName tuỳ chọn) · `imageAttachmentListSchema` (max 4 ảnh + tổng byte ≤ 12 MB) · `MAX_IMAGE_BASE64_CHARS` · `providerImageSchema` |
| `packages/shared/src/constants.ts` | ✅ Hằng `VISION` (`MAX_IMAGE_BYTES` 5 MB · `MAX_IMAGES_PER_MESSAGE` 4 · `MAX_TOTAL_IMAGE_BYTES` 12 MB · `TOKEN_ESTIMATE_PER_IMAGE` 258) · `API_ROUTES.attachment` |
| `packages/shared/src/schemas/chat.ts` | ✅ `chatTurnSchema.attachments` (optional) |
| `packages/shared/src/schemas/provider.ts` | ✅ `providerStreamRequestSchema.messages[].attachments` (`ProviderImage[]`) |
| `packages/shared/src/errors.ts` | ✅ 5 error code: `VISION_IMAGE_TOO_LARGE` · `VISION_UNSUPPORTED_TYPE` · `VISION_TOO_MANY_IMAGES` · `VISION_TOTAL_TOO_LARGE` · `PROVIDER_VISION_UNSUPPORTED` |

#### Phần B — Server

| Hạng mục | Kết quả |
|---|---|
| `apps/server/src/db/schema.ts` | ✅ Bảng `message_attachments` (id uuid do client sinh · message_id fk · conversation_id fk · mime_type · byte_size · **ord** · width/height · file_name · **data bytea** · created_at) + unique `(message_id, ord)` · `bytea` dùng `customType` (drizzle 0.45 **không** export helper `bytea`) |
| `apps/server/drizzle/0001_puzzling_mathemanic.sql` | ✅ Migration tạo bảng + 2 index + unique index + 2 FK (cascade) |
| `apps/server/src/services/attachmentService.ts` | ✅ `persistAttachments()` (giải mã base64 → `bytea`, `ON CONFLICT DO NOTHING`, **không tin** `bytes` của client — lưu kích thước thực) · `loadRecentAttachments()` (ảnh gần nhất của conversation → multi-turn) · `getAttachment()` · `countAttachments()` |
| `apps/server/src/routes/attachments.ts` | ✅ `GET /api/attachments/:id` → **binary** (`Content-Type` = mime, `Cache-Control: private, max-age=3600`) · 404 `NOT_FOUND` · 500 `INTERNAL_ERROR` |
| `apps/server/src/providers/types.ts` | ✅ `ProviderAdapter.supportsVision(model: string): boolean` (bắt buộc mọi adapter) |
| `apps/server/src/providers/gemini.ts` | ✅ `supportsVision() → true` · payload `parts: [{ text }, { inline_data: { mime_type, data } }]` |
| `apps/server/src/providers/openaiCompatible.ts` | ✅ `buildOpenAiContent()` → `content: [{ type:'text' }, { type:'image_url', image_url: { url: 'data:<mime>;base64,<data>' } }]` · `supportsVision()` theo `visionModelPrefixes` |
| `apps/server/src/providers/groq.ts` | ✅ `GROQ_VISION_MODEL_PREFIXES` (`llama-4-scout`, `llama-4-maverick`, `llama-3.2-11b/90b-vision`) — model mặc định `openai/gpt-oss-120b` **không** hỗ trợ |
| `apps/server/src/providers/openrouter.ts` | ✅ `OPENROUTER_VISION_MODEL_PREFIXES` (`google/gemini`, `openai/gpt-4o`, `anthropic/claude-3/4`, `meta-llama/llama-3.2`, `qwen/qwen2-vl`, `google/gemma`) |
| `apps/server/src/providers/mock.ts` | ✅ `supportsVision() → true` · echo số ảnh: `[mock] Nhan duoc 1 anh (image/png)` → E2E assert được |
| `apps/server/src/services/chatService.ts` | ✅ `persistUserMessage()` trả về id · `persistAttachments()` · `loadRecentAttachments()` · `mergeImages()` (dedup theo base64, ưu tiên ảnh lượt này) · fallback chain **bỏ qua** provider không hỗ trợ vision · hết chain → `PROVIDER_VISION_UNSUPPORTED` · `buildProviderMessages({ images })` gắn ảnh vào **user turn cuối** + trừ `TOKEN_ESTIMATE_PER_IMAGE` khỏi `historyBudget` |
| `apps/server/src/app.ts` | ✅ `express.json({ limit: '16mb' })` (payload base64 12 MB vượt mặc định 2 MB) · đăng ký `attachmentsRouter` |

#### Phần C — Extension

| Hạng mục | Kết quả |
|---|---|
| `apps/extension/src/lib/imageUpload.ts` | ✅ **Thuần**: `validateImageFile()` (mime allowlist + giới hạn 5 MB + file rỗng) · `readImageFile()` (FileReader → base64 thuần) · `measureImage()` (đo pixel: `createImageBitmap` → fallback `Image` → `undefined`, **không throw**) · `stripDataUrlPrefix()` · `extractImagesFromDataTransfer()` + wrapper `extractImagesFromClipboard()` / `extractImagesFromDrop()` · `createAttachmentId()` (uuid, fallback UUID v4 tự sinh) · `formatBytes()` |
| `apps/extension/src/sidepanel/hooks/useImageAttachments.ts` | ✅ Thêm/xoá/xoá hết ảnh · chặn vượt số ảnh & tổng byte · **báo lỗi tiếng Việt** |
| `apps/extension/src/sidepanel/components/composer/AttachmentTray.tsx` | ✅ Thumbnail + nút ✕ (`aria-label` tiếng Việt) · dòng "N ảnh · ~M token" · `role="alert"` cho lỗi · dùng design token |
| `apps/extension/src/sidepanel/components/Composer.tsx` | ✅ Nút 📎 (`ImagePlus`) + `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple>` ẩn · `onPaste` (chỉ ảnh) · `onDragOver`/`onDrop` với `preventDefault()` (tránh Chrome điều hướng panel rời trang) |
| `apps/extension/src/sidepanel/store/chatStore.ts` | ✅ `pendingImages` + `addPendingImages` (thay ảnh cùng id) · `removePendingImage` · `clearPendingImages` · `reset()` xoá ảnh chờ gửi |
| `apps/extension/src/sidepanel/hooks/useChat.ts` | ✅ `send()` gắn `attachments` vào turn cuối · **snapshot lịch sử trước** khi thêm user message (tránh gửi trùng) · xoá `pendingImages` sau khi gửi · cho phép gửi **chỉ ảnh** (content = "(ảnh đính kèm)") |
| `apps/extension/src/sidepanel/components/MessageBubble.tsx` | ✅ Render ảnh của user message · bấm → mở tab mới (data URL) |
| `apps/extension/src/sidepanel/App.tsx` | ✅ Mount `AttachmentTray` + truyền `onImagesSelected` xuống `Composer` |

#### Verify

| Hạng mục | Kết quả |
|---|---|
| `pnpm typecheck` | ✅ pass (shared · server · extension · eval) |
| `pnpm lint` | ✅ pass (0 error, 0 warning) |
| `pnpm test` | ✅ pass — shared **103** · server **166** · extension **278** (tổng **547**, trước 419 → **+128**) |
| `pnpm build` | ✅ pass — `dist/content.js` vẫn là **IIFE 1 file, không `import`** (13.87 kB — ảnh không liên quan content script) |
| `pnpm db:migrate` | ✅ pass — tạo bảng `message_attachments` + index + FK |
| `pnpm test:e2e` | ✅ pass — **23/23** (+5 kịch bản `vision.spec.ts`, 18 test cũ **không regression**) |
| Mutation re-check | ✅ **5/5 mutation bị bắt** — bỏ `inline_data` trong Gemini (1 test fail) · bỏ kiểm tra `supportsVision` trong fallback chain (2 test fail) · đổi dedup `mergeImages` (1 test fail) · bỏ `measureImage()` trả kích thước (1 test fail) · **thêm `image/bmp` vào allowlist mime (1 test fail — sau khi bổ sung test khoá allowlist)** |

> **Ghi chú về ảnh:** `dist/content.js` **không** đổi (13.87 kB) — ảnh chỉ tồn tại ở side panel, không kéo `FileReader`/`lucide-react` vào content script.

### 3.1h Kết quả T-M1-25 — onboarding 3 bước lần đầu (FR-UX-02) (2026-11-05)

> **Quyết định scope (chốt với user):** (a) **BYOK đầy đủ** — onboarding có ô nhập API key, lưu **K2** qua BFF → cần `POST /api/providers/keys` + `GET /api/providers`; (b) **quyền = chỉ giải thích** — không đổi `manifest.json`, không dùng `optional_permissions`; (c) **có Ollama** trong onboarding → cần adapter Ollama + probe tự động (giao T-M2-01, đẩy lên M1).
>
> **Không phá parity:** onboarding chỉ là lớp UI mới; luồng chat giữ nguyên. Panel vẫn là 1 màn hình chính (DP-2) — onboarding hiển thị **thay** chat khi chưa hoàn tất, mở lại được từ header.

#### Phần A — Contract shared

| Hạng mục | Kết quả |
|---|---|
| `packages/shared/src/types/entities.ts` | ✅ `providerInfoSchema`: `keySource` thêm `'none'` (provider không cần key) · thêm `note?: string` (vd "Ollama chưa chạy") |
| `packages/shared/src/schemas/provider.ts` | ✅ `providerKeyRecordSchema` (id, providerId, label, masked, createdAt) · `providerKeyTestResultSchema` (ok, latencyMs, error?) · `providersResponseSchema` (ProviderInfo[]) · `providerKeyListResponseSchema` · `saveProviderKeyResponseSchema` |
| `packages/shared/src/constants.ts` | ✅ `ONBOARDING_STEPS = ['permissions','provider','try']` · `API_ROUTES.providerKeys = '/api/providers/keys'` |
| `packages/shared/src/errors.ts` | ✅ `PROVIDER_KEY_INVALID` (400) · `MASTER_KEY_NOT_CONFIGURED` (500) — dùng `PROVIDER_UNAVAILABLE` (503) cho Ollama chưa chạy |

#### Phần B — Server

| Hạng mục | Kết quả |
|---|---|
| `apps/server/src/providers/ollama.ts` | ✅ **Mới** `createOllamaProvider()` (OpenAI-compatible `http://127.0.0.1:11434/v1`, `requiresKey = false`) · `detectOllama()` probe `GET /api/tags` timeout 1.5 s → `{ available, models, error }` · `OLLAMA_VISION_MODEL_PREFIXES` (`llama3.2-vision`, `llava`, `bakllava`, `qwen2-vl`, `qwen2.5-vl`, `minicpm-v`, `moondream`, `gemma3`) |
| `apps/server/src/providers/openaiCompatible.ts` | ✅ Thêm option `requiresKey?: boolean` (mặc định `true`) · `testKey(apiKey)` → `{ ok, error? }` (provider không cần key → `ok: true`) |
| `apps/server/src/providers/registry.ts` | ✅ Đăng ký `ollama` · lưu `defaultModel` từng provider → `GET /api/providers` **không gọi network** (trừ probe Ollama) |
| `apps/server/src/providers/types.ts` | ✅ `ProviderAdapter.testKey(apiKey): Promise<ProviderKeyCheck>` (bắt buộc mọi adapter) — implement ở `gemini.ts` · `mock.ts` · `openaiCompatible.ts` |
| `apps/server/src/services/providerService.ts` | ✅ **Mới** `listProviderInfo()` (keySource K2 > K1 > none; `available` = có key hoặc Ollama probe OK) · `saveProviderKey()` (encrypt AES-256-GCM, upsert theo unique `(provider_id, label)`) · `listProviderKeys()` (chỉ metadata + `maskKey`) · `deleteProviderKey()` · `testProviderKey()` (gọi adapter thật, trả `{ok, latencyMs}`) |
| `apps/server/src/routes/providers.ts` | ✅ **Mới** `GET /providers` · `GET /providers/keys` · `POST /providers/keys` · `DELETE /providers/keys/:id` · `POST /providers/keys/:id/test` — validate Zod ở biên, **không bao giờ trả key gốc** |
| `apps/server/src/app.ts` · `src/index.ts` · `src/config/env.ts` | ✅ Mount `providersRouter` tại `/api` · env `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434/v1`) · `OLLAMA_MODEL` (default `llama3.2`) · truyền `masterKey` + `ollamaBaseUrl` vào service |
| `apps/server/src/services/chatService.ts` | ✅ **Sửa nhỏ:** `request.provider` **đặt đầu** chuỗi provider rồi nối tiếp fallback chain (trước đó nó *thay* chain → mất fallback, vi phạm FR-PROVIDER-04). Không có `request.provider` → hành vi không đổi |

> `provider_keys` table đã có sẵn trong `db/schema.ts` + migration `0000` → **không cần migration mới**.

#### Phần C — Extension

| Hạng mục | Kết quả |
|---|---|
| `apps/extension/src/lib/onboarding.ts` | ✅ **Mới** (thuần, không React/Zustand) `ONBOARDING_COMPLETED_KEY` · `PREFERRED_PROVIDER_KEY` · `readOnboardingState()` / `completeOnboarding()` / `resetOnboarding()` / `readPreferredProvider()` / `writePreferredProvider()` |
| `apps/extension/src/lib/providerClient.ts` | ✅ **Mới** `listProviders()` · `listProviderKeys()` · `saveProviderKey()` · `testProviderKey()` · `deleteProviderKey()` — dùng `fetchJson` của `lib/apiClient.ts` (đã xử lý lỗi chuẩn) |
| `apps/extension/src/sidepanel/hooks/useOnboarding.ts` | ✅ **Mới** đọc/ghi cờ qua `chrome.storage.local` + lắng nghe `storage.onChanged`; expose `{ isOnboardingRequired, isLoading, complete, reset, preferredProvider }` |
| `apps/extension/src/sidepanel/hooks/useChat.ts` | ✅ Gửi `provider` ưu tiên (đọc từ `sidekick.preferredProvider`) trong `ChatRequest` → server đặt provider đó **đầu** chuỗi fallback |
| `apps/extension/src/sidepanel/components/onboarding/Onboarding.tsx` | ✅ **Mới** orchestrator 3 bước — progress bar (`ONBOARDING_STEPS`), nút "Bỏ qua", "Về sau"/"Quay lại", `data-testid="onboarding"` |
| `.../onboarding/StepPermissions.tsx` | ✅ Liệt kê quyền đã dùng + **vì sao** · nút "Mở cài đặt trình duyệt" (`chrome.tabs.create` bọc try/catch — Chrome chặn URL `chrome://` → fallback hiện extension id để copy) |
| `.../onboarding/StepProvider.tsx` | ✅ Radio list provider từ `GET /api/providers` (hiện `keySource` + `available` + `note`) · provider cần key & chưa có key → `<input type="password">` + "Lưu & kiểm tra" (`POST /providers/keys` → `POST /providers/keys/:id/test`) · nút "Bỏ qua bước này" |
| `.../onboarding/StepTry.tsx` | ✅ Ô nhập + nút "Thử" → dùng lại `streamChat()` của `lib/sseClient.ts` (**SSE thật**, không mock) → hiện câu trả lời stream + trạng thái lỗi + "Bỏ qua" |
| `apps/extension/src/sidepanel/App.tsx` → `ChatWorkspace.tsx` | ✅ Tách 2 tầng: `App.tsx` quyết định onboarding hay chat; `ChatWorkspace.tsx` = **toàn bộ nội dung chat hiện tại, di chuyển nguyên trạng** |
| `apps/extension/src/sidepanel/components/PanelHeader.tsx` | ✅ Thêm nút "Hướng dẫn" (icon `CircleHelp`, `aria-label` tiếng Việt) → mở lại onboarding (thay thế tạm cho entry trong Settings T-M1-12) |

#### Phần D — Test

| Hạng mục | Kết quả |
|---|---|
| `packages/shared/tests/onboarding.test.ts` | ✅ Schema provider mới + hằng onboarding + error code mới |
| `apps/server/tests/ollamaProvider.test.ts` | ✅ `requiresKey=false` · parse `/api/tags` · `detectOllama()` true/false · `supportsVision()` theo prefix |
| `apps/server/tests/providerService.test.ts` | ✅ encrypt→decrypt round-trip · upsert không tạo bản ghi trùng · `maskKey` chỉ 4 ký tự cuối |
| `apps/server/tests/providersRoute.test.ts` | ✅ Express thật: `GET /api/providers` (K2 ưu tiên K1) · `POST /keys` không trả key gốc · `POST .../test` trả `ok` · `DELETE` → 204 · thiếu `MASTER_KEY` → `MASTER_KEY_NOT_CONFIGURED` · body sai → `VALIDATION_ERROR` |
| `apps/server/tests/chatService.test.ts` | ✅ Bổ sung: `request.provider` đặt đầu **nhưng fallback chain vẫn còn** |
| `apps/server/tests/helpers/fakeProviderKeyDb.ts` | ✅ Harness Drizzle giả cho bảng `provider_keys` (không cần DB thật) |
| `apps/extension/tests/onboarding.test.ts` | ✅ State machine thuần: bỏ qua → `completed=true` · `resetOnboarding()` xoá cờ · `preferredProvider` persist |
| `apps/extension/tests/providerClient.test.ts` | ✅ Parse lỗi chuẩn từ `fetchJson` |
| `apps/extension/tests/onboardingUi.test.tsx` | ✅ Render 3 bước · "Bỏ qua" → `completed=true` · bước 2 hiện provider + ô nhập key khi cần · bước 3 gọi `streamChat` và hiện text |
| `apps/extension/tests/useChat.test.ts` | ✅ **+2 test**: gửi `provider` ưu tiên từ onboarding lên BFF · không có provider ưu tiên → không gửi field `provider` |
| `apps/extension/e2e/fixtures.ts` | ✅ **Sửa** seed `sidekick.onboarding.completed = true` ở **context** level (nếu không, onboarding che chat → phá 23 test cũ) · thêm fixture `sidePanelFresh` (profile tạm, không seed) cho spec onboarding |
| `apps/extension/e2e/onboarding.spec.ts` | ✅ **Mới** 6 kịch bản: mở lần đầu → thấy onboarding · điều hướng 3 bước · bỏ qua → panel chuyển sang chat · reload → không còn onboarding · nút "Hướng dẫn" mở lại onboarding |

#### Verify

| Hạng mục | Kết quả |
|---|---|
| `pnpm typecheck` | ✅ pass (shared · server · extension · eval) |
| `pnpm lint` | ✅ pass (0 error, 0 warning) — sửa 3 lỗi `no-useless-assignment` / `no-unused-vars` (`StepPermissions.tsx` · `providerService.ts` · `fakeProviderKeyDb.ts`) |
| `pnpm test` | ✅ pass — shared **123** · server **214** · extension **311** (tổng **648**, trước 547 → **+101**) |
| `pnpm build` | ✅ pass — `dist/content.js` vẫn là **IIFE 1 file, không `import`** (13.87 kB) |
| `pnpm db:migrate` | ✅ pass — **không có migration mới** (bảng `provider_keys` đã có sẵn từ migration `0000`) |
| `pnpm test:e2e` | ✅ pass — **29/29** (+6 kịch bản `onboarding.spec.ts`, 23 test cũ **không regression**) |
| Mutation spot-check | ✅ **5/5 mutation bị bắt** — Ollama `requiresKey` → `true` (2 test fail) · `maskKey` trả 8 ký tự (7 test fail) · bỏ ghi `completed` khi bấm "Bỏ qua" (3 test fail) · bỏ `preferredProvider` khỏi chain (1 test fail) · **bỏ `provider` ưu tiên khỏi request chat (1 test fail)** |

> **Ghi chú về Ollama:** adapter Ollama được giao cho T-M2-01 nhưng **đẩy lên M1** trong task này vì onboarding cần provider không cần key để demo được luồng 3 bước mà không bắt user nhập API key.

### 3.1i-bis Kết quả T-M1-07 — Markdown render + code block + copy + syntax highlight (2026-11-06)

> Chi tiết kiến trúc: [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.8.

#### Phần A — Dependency + schema thuần

| Hạng mục | Kết quả |
|---|---|
| `apps/extension/package.json` | ✅ +`react-markdown@^10.1.0` · `remark-gfm@^4.0.1` · `rehype-sanitize@^6.0.0` · `rehype-highlight@^7.0.2` (`sonner` đã có sẵn) |
| `apps/extension/src/sidepanel/components/chat/markdownSchema.ts` | ✅ **Mới** `markdownSchema` (clone `defaultSchema` + `span: [['className', /^hljs-/]]` + `code: [['className', /^language-./, 'hljs']]` + `protocols.href: ['http','https','mailto']`) · `LANGUAGE_ALIASES` · `SUPPORTED_LANGUAGES` · `toMarkdownNode` / `languageFromNode` / `extractCodeText` |

#### Phần B — Component

| Hạng mục | Kết quả |
|---|---|
| `.../chat/CodeBlock.tsx` | ✅ **Mới** header (nhãn ngôn ngữ + nút copy) · copy **source thô** qua `navigator.clipboard.writeText` · icon `Copy`→`Check` 1500 ms · `toast.success('Đã sao chép')` / `toast.error('Không sao chép được')` · `CodeBlockContext` để phân biệt code block vs inline code |
| `.../chat/MarkdownTable.tsx` | ✅ **Mới** bọc `<table>` trong `div.overflow-x-auto` (`data-testid="markdown-table-wrapper"`) → bảng rộng scroll ngang, không vỡ layout 320 px |
| `.../chat/MessageContent.tsx` | ✅ **Mới** orchestrator: `useDeferredValue(content)` · `remarkPlugins=[remarkGfm]` · `rehypePlugins` = `REHYPE_PLUGINS_STREAMING` (`[rehypeSanitize]`) khi streaming vs `REHYPE_PLUGINS_DONE` (`[rehypeHighlight, rehypeSanitize]`) khi xong (hằng module-level) · override `a` / `pre` / `code` / `table` · `skipHtml` |
| `apps/extension/src/sidepanel/components/MessageBubble.tsx` | ✅ **Sửa** assistant → `<MessageContent content={message.content} isStreaming={message.status === 'streaming'} />`; user giữ text thuần |
| `apps/extension/src/sidepanel/App.tsx` | ✅ Mount `<Toaster position="bottom-center" />` (dùng chung cho onboarding + chat) |
| `apps/extension/public/manifest.json` | ✅ +permission `clipboardWrite` (dùng thật cho copy code) |
| `apps/extension/src/sidepanel/index.css` | ✅ +`.markdown-body` (typography) · +mapping `.hljs-*` → `--code-token-*` (token có sẵn trong `design/tokens.css`) |

#### Phần C — Test

| Hạng mục | Kết quả |
|---|---|
| `apps/extension/tests/markdownSchema.test.ts` | ✅ **Mới 17 test** — allowlist `table/thead/td` · `span.hljs-*` · chặn `script` · chặn `javascript:`/`irc:` · `defaultSchema` **không bị mutate** |
| `apps/extension/tests/messageContent.test.tsx` | ✅ **Mới 25 test** — GFM (h1/h2/ul/ol/blockquote/bold/italic/inline code/link/bảng) · XSS (`<script>`, `onerror`, `javascript:`) · link `target="_blank"` + `rel="noopener noreferrer"` · code block (testid, nhãn ngôn ngữ, `span.hljs-keyword`) · copy (clipboard gọi với raw code, icon đổi, toast "Đã sao chép") · bảng (wrapper `overflow-x-auto`) · **streaming defer** (chưa có `span.hljs-*` → có) |
| `apps/extension/tests/messageContentDefer.test.tsx` | ✅ **Mới 2 test** — `useDeferredValue` được gọi với nội dung hiện tại (file riêng vì mock `react` áp dụng cho cả file) |
| `apps/extension/e2e/markdown.spec.ts` | ✅ **Mới 4 kịch bản** — render đủ (heading + bảng + code block) · copy → toast "Đã sao chép" · `<script>` không vào DOM · **0 lỗi console** |

#### Verify

| Hạng mục | Kết quả |
|---|---|
| `pnpm typecheck` | ✅ pass (shared · server · extension · eval) |
| `pnpm lint` | ✅ pass (0 error, 0 warning) |
| `pnpm test` | ✅ pass — shared **140** · server **224** · extension **376** (tổng **740**, trước 696 → **+40**) |
| `pnpm build` | ✅ pass — `dist/content.js` vẫn là **IIFE 1 file, không `import`** (không bị ảnh hưởng bởi `rehype-highlight`) |
| `pnpm db:migrate` | ✅ pass — **không có migration mới** (thay đổi chỉ ở tầng extension) |
| `pnpm test:e2e` | ✅ pass — **36/36** (+4 kịch bản `markdown.spec.ts`, 32 test cũ **không regression**) |
| Mutation spot-check | ✅ **6/6 mutation bị bắt** — bỏ `rehype-sanitize` (2 test fail) · bỏ `rel="noopener noreferrer"` (1 test fail) · đổi allowlist `href` (2 test fail) · bỏ defer-highlight khi streaming (1 test fail) · bỏ `useDeferredValue` (2 test fail) · bỏ `overflow-x-auto` ở bảng (1 test fail) |

> **Quyết định kỹ thuật:** dùng `rehype-highlight` (highlight.js đồng bộ) thay `shiki` — shiki cần wasm → cần `'wasm-unsafe-eval'` trong CSP, MV3 `script-src 'self'` không cho. Highlight **đồng bộ** + **defer khi streaming** → tránh O(n²) và tránh code block nhấp nháy unhighlighted.

### 3.1j Kết quả T-M1-08 — Citation chip + popover (FR-CONTEXT-10) (2026-11-06)

> Chi tiết kiến trúc: [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.9.

#### Phần A — Contract shared + server

| Hạng mục | Kết quả |
|---|---|
| `packages/shared/src/citation.ts` | ✅ **Mới** `CITATION_MARKER_PATTERN` (`/\[(\d{1,2})\]/g`) · `CITATION_INSTRUCTION` (chỉ chèn vào system prompt **khi có context**) · `parseCitationMarkers()` (số phân biệt, sort tăng dần, **không** mutate `lastIndex` của regex global) |
| `apps/server/src/services/chatService.ts` | ✅ `numberedContextItems()` đánh số **1-based** theo thứ tự tier (`selection` > `attachment` > `currentTab`) → prompt render `--- Nguồn [1] ([Đã bôi đen]) ---` · `buildProviderMessages()` chèn `CITATION_INSTRUCTION` · `createChatStream()` **emit SSE `citation` trước `done`** |
| `apps/server/src/services/citationService.ts` | ✅ **Mới** `extractCitations(text, sources)` — bỏ số vượt phạm vi, format snippet (`excerpt ?? text.slice(0, 320)`) · `persistCitations()` insert vào bảng `citations` (`messageId`, `idx`, `url`, `title`, `snippet`, `tabId`) |
| `packages/shared/src/index.ts` | ✅ Export `./citation.js` |

#### Phần B — Extension

| Hạng mục | Kết quả |
|---|---|
| `.../chat/citationPlugin.ts` | ✅ **Mới** remark plugin (thuần mdast) — tách text node chứa `[N]` → `<span dataCitationIndex={N}>`; **không** đụng code block / inline code |
| `.../chat/markdownSchema.ts` | ✅ +`dataCitationIndex` vào allowlist `span` (`[['className', /^hljs-/], 'dataCitationIndex']`) — **không** dùng wildcard `data*` |
| `.../chat/MessageContent.tsx` | ✅ +`citationPlugin` vào `remarkPlugins` · `CitationContext` · override `span`: có `dataCitationIndex` → render `CitationChip`, còn lại → pass-through (token `.hljs-*`) |
| `.../chat/CitationChip.tsx` | ✅ Chip inline `<button class="citation-chip" data-testid="citation-chip-{N}">` · **có** metadata → button mở popover; **chưa** có metadata (đang stream) → `<span>` |
| `.../chat/CitationPopover.tsx` | ✅ Radix Popover qua Portal: tiêu đề · domain · đoạn trích · nút "Mở trang gốc" (`chrome.tabs.create`) |
| `.../chat/CitationList.tsx` | ✅ Dòng tóm tắt nguồn dưới bubble assistant (`data-testid="citation-list"`) |
| `apps/extension/src/components/ui/popover.tsx` | ✅ **Mới** wrapper shadcn/ui trên `@radix-ui/react-popover` |
| `.../store/chatStore.ts` | ✅ +`ChatCitation` · `ChatMessage.citations` · action `addCitation` |
| `.../hooks/useChat.ts` | ✅ Xử lý SSE `case 'citation'` → `addCitation` |
| `.../components/MessageBubble.tsx` | ✅ Truyền `message.citations` xuống `MessageContent` + render `CitationList` |
| `.../sidepanel/index.css` | ✅ +`.citation-chip` dùng token `--citation-bg/-border/-link/-hover` (không hardcode màu) |

#### Phần C — Test

| Hạng mục | Kết quả |
|---|---|
| `packages/shared/tests/citation.test.ts` | ✅ **Mới 12 test** — parse marker · số trùng lặp/sort · regex `lastIndex` không bị mutate · instruction |
| `apps/server/tests/citationService.test.ts` | ✅ **Mới 12 test** — bỏ số vượt phạm vi · snippet fallback · persist |
| `apps/server/tests/citationStream.test.ts` | ✅ **Mới 5 test** — SSE `citation` phát **trước** `done` · đủ metadata |
| `apps/server/tests/contextPrompt.test.ts` | ✅ +7 test — đánh số theo tier · prompt render `[N]` |
| `apps/extension/tests/citationPlugin.test.ts` | ✅ **Mới 11 test** — tách text node · **không** đụng code/inline code |
| `apps/extension/tests/citationChip.test.tsx` | ✅ **Mới 9 test** — button vs span · aria-label · mở popover |
| `apps/extension/tests/messageContentCitation.test.tsx` | ✅ **Mới 9 test** — chip render trong markdown · override `span` không phá highlight.js |
| `apps/extension/tests/chatStore.test.ts` | ✅ +4 test — `addCitation` |
| `apps/extension/tests/useChat.test.ts` | ✅ +2 test — SSE `citation` |
| `apps/extension/e2e/citation.spec.ts` | ✅ **Mới 4 kịch bản** — chip hiện trong câu trả lời · click → popover · "Mở trang gốc" mở tab mới |

#### Verify

| Hạng mục | Kết quả |
|---|---|
| `pnpm typecheck` | ✅ pass (shared · server · extension · eval) |
| `pnpm lint` | ✅ pass (0 error, 0 warning) |
| `pnpm test` | ✅ pass — shared **152** · server **250** · extension **411** (tổng **813**, trước 740 → **+73**) |
| `pnpm build` | ✅ pass — `dist/content.js` vẫn là **IIFE 1 file, không `import`** |
| `pnpm db:migrate` | ✅ pass — **không có migration mới** (bảng `citations` đã có sẵn trong `0000`) |
| `pnpm test:e2e` | ✅ pass — **40/40** (+4 kịch bản `citation.spec.ts`, 36 test cũ **không regression**) |
| Mutation spot-check | ✅ **6/6 mutation bị bắt** — bỏ `CITATION_INSTRUCTION` (2 test fail) · đảo thứ tự tier (3 test fail) · cho phép số vượt phạm vi (2 test fail) · bỏ `dataCitationIndex` khỏi allowlist (5 test fail) · bỏ `case 'citation'` trong `useChat` (2 unit + 3 E2E fail) · ép mọi `span` thành chip (4 test fail) |

> **Quyết định kỹ thuật:** dùng **marker `[N]` do LLM sinh** (không phải suy đoán vị trí câu) — server parse marker, **loại số vượt phạm vi** (LLM bịa `[9]` khi chỉ có 3 nguồn → bỏ) → chính xác hơn heuristic, và prompt chỉ thêm `CITATION_INSTRUCTION` khi thực sự có context → không ảnh hưởng chat thuần LLM (FR-CONTEXT-13).

### 3.2 Traceability FR → Task

> Bảng đầy đủ FR → Task (kèm milestone) nằm ở [`REQUIREMENTS.md`](REQUIREMENTS.md) §11.1 — nơi duy nhất cần cập nhật khi thêm/bớt task.
> Bảng ở đây là **bản rút gọn theo nhóm FR**, dùng để audit nhanh khi sửa plan.

| Nhóm | FR trong nhóm | Task phụ trách | Ghi chú |
|---|---|---|---|
| FR-CHAT-01..14 | 14 FR | T-M0-10 · T-M0-13 · **T-M1-07 ✅**/09/10/11/13/19 | FR-CHAT-02/03/04 (Markdown, code block + copy, bảng) do T-M1-07 ✅ |
| FR-CONTEXT-01..13 | 13 FR | T-M1-01/02/04/05/**06 ✅**/**08 ✅**/14 · **T-M1-21/22/23** · **T-M2-19** | FR-CONTEXT-05/06 nâng lên Must (2026-11-04) · FR-CONTEXT-13 (chat không cần context) do T-M1-23 · **FR-CONTEXT-03 (`@` multi-tab) do T-M1-05 ✅** · **FR-CONTEXT-04 (selection) do T-M1-02 ✅** · **FR-CONTEXT-01 (cache URL+hash) + FR-CONTEXT-12 (snapshot) do T-M1-06 ✅** · **FR-CONTEXT-10 (citation chip + popover) do T-M1-08 ✅ (2026-11-06)** |
| FR-VISION-01..05 | 5 FR | **T-M1-24 ✅** (upload) · **T-M2-22** (mở rộng) | FR-VISION-01 nâng lên M · **T-M1-24 xong 2026-11-05** (vision đầy đủ Gemini + OpenAI-compatible, lưu Postgres, multi-turn) |
| FR-TOOLS-01..06 | 6 FR | T-M2-07/08/09/10/11/18 · **T-M2-20** | FR-TOOLS-03 (web search) tách riêng khỏi tool registry |
| FR-SKILL-01..07 | 7 FR | T-M2-04/05/06 · **T-M2-21** | FR-SKILL-04 (skill mẫu) + FR-SKILL-06 (điều kiện) tách task |
| FR-PROVIDER-01..09 | 9 FR | T-M0-07/08 · T-M1-15/16 · T-M2-01/02/03 | FR-PROVIDER-04 (fallback) nằm trong T-M2-02 |
| FR-WORKFLOW-01..13 | 13 FR | T-M4-01..08 · `FR-WORKFLOW-04` → **M5** | FR-WORKFLOW-04 deferred (rủi ro MV3 `tabs.onUpdated`) |
| FR-SETTINGS-01..07 | 7 FR | T-M0-14 · T-M1-12/17 · **T-M2-19** (FR-SETTINGS-04) | FR-SETTINGS-03/04/05/07 trước đó không có task → gộp vào T-M1-12 |
| FR-UX-01..10 | 10 FR | T-M1-03/10/11/12/18/19/20 · **T-M1-25 ✅** | FR-UX-02 (onboarding) tách task riêng T-M1-25 — **xong 2026-11-05** (3 bước, BYOK K2, Ollama, skippable) |
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
