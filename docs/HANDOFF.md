# HANDOFF — Bắt đầu chat mới

> Mục tiêu: chat mới nắm context trong **≤ 5 phút** mà không cần đọc lại toàn bộ `docs/`.

---

## 1. Checklist bắt đầu (làm theo thứ tự)

| # | Việc | Mất thời gian | Nếu thiếu |
|---|---|---|---|
| 1 | Đọc `AGENTS.md` (file gốc) | 2 phút | Nắm 80% context |
| 2 | Đọc `docs/HANDOFF.md` (file này) | 1 phút | Biết đang làm dở gì |
| 3 | Đọc `docs/CHANGELOG.md` — 20 dòng đầu | 30 giây | Biết gần đây đổi gì |
| 4 | `git log --oneline -10` + `git status` | 30 giây | Biết trạng thái repo |
| 5 | Nếu đang làm dở: mở file liên quan + `docs/IMPLEMENTATION_PLAN.md` § milestone tương ứng | 1 phút | Biết task tiếp theo |
| 6 | Nếu cần chi tiết kỹ thuật: mở `docs/SYSTEM_DESIGN.md` § liên quan | khi cần | — |

> **Không** cần đọc `REQUIREMENTS.md`, `EVAL_PLAN.md`, `COMPARISON_MATRIX.md` ngay — chỉ mở khi task chạm tới chúng.

---

## 2. Trạng thái hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Docs | ✅ Đầy đủ 9 file (`docs/`) + `AGENTS.md` ở root |
| Code | ✅ M0 (Foundation) hoàn tất · **T-M1-01 + T-M1-21 + T-M1-22 + T-M1-23 + T-M1-04 + T-M1-05 + T-M1-02 + T-M1-24 + T-M1-25 + T-M1-06 xong** — 4 workspace, 696 unit test + 32 E2E |
| Git | ✅ Đã init (`main`) · tag `v0.1` đánh dấu M0 |
| Milestone hiện tại | **M1 — Parity** (M0 đã đóng, M1: **10/25 task**) |
| Task tiếp theo | **T-M1-07** (markdown/code) → T-M1-08 (citation chip) |

### Đang làm dở

_(Không có — T-M1-06 hash context + snapshot + cache đã commit, task kế tiếp T-M1-07)_

### Việc đã xong gần đây (T-M1-06 — Hash context + snapshot log + cache theo URL+hash)

- **T-M1-06 (FR-CONTEXT-01 / FR-CONTEXT-12)** — đóng nốt 3 mảnh còn thiếu: (1) `request_logs.context_hash` trước đây là hash của **toàn bộ prompt** (system + history + context) → nay là hash của **context thật đã gửi**; (2) `context_snapshot` (jsonb) trước đây **chưa bao giờ** được ghi → nay ghi theo setting; (3) chưa có cache context theo URL+hash (phần còn lại của FR-CONTEXT-01 theo `IMPLEMENTATION_PLAN.md` §3.1) → nay có.
  - **Contract** — `packages/shared/src/contextHash.ts` (mới): `hashString()` (FNV-1a 32-bit → hex, **thuần** — không `node:crypto` → dùng được cho extension + server) · `hashContextItems()` (deterministic: sort theo `CONTEXT_TIER_ORDER` rồi `id`, nối `id|kind|tier|url|title|sourceKind|text` bằng `\u0000`; `truncated`/`tokens` **không** tính) · `contextHashKey()` (bỏ fragment/query, lowercase host) · `packages/shared/src/constants.ts` thêm `CONTEXT_CACHE_TTL_MS = 30 phút` + `CONTEXT_CACHE_MAX_ENTRIES = 20`.
  - **Server** — `apps/server/src/services/chatService.ts`: `resolveContextItems()` (**mới**) chạy `applyContextBudget()` **một lần** → nguồn sự thật duy nhất cho cả prompt builder lẫn log · `buildProviderMessages()` nhận `options.contextBudget` (giữ **nguyên chữ ký** cũ) · `context_hash = hashContextItems(contextBudget.items)` (không có context → `null`) · `context_snapshot` jsonb `[{ id, kind, tier, url, title, sourceKind, text, excerpt, truncated }]` — **chỉ khi** `LOG_CONTEXT_SNAPSHOT=true` · `ChatServiceDeps.logContextSnapshot` · env `LOG_CONTEXT_SNAPSHOT` (mặc định `false`).
  - **Extension** — `apps/extension/src/lib/contextCache.ts` (mới): `readCachedContext()` · `writeCachedContext()` (+ prune) · `clearContextCache()` · `toCacheEntry()` · `hasContentChanged()` — lưu `chrome.storage.local` key `sidekick.contextCache`, **không** throw khi lỗi storage · `apps/extension/src/lib/contextAttach.ts` `attachTab()` ghi cache khi trích xuất thành công + **fallback** về bản cache khi trang đang lỗi (PDF scan · extractor rỗng · mất mạng) · `lib/storage.ts` thêm `CONTEXT_CACHE_STORAGE_KEY`.
  - **Verify** — typecheck ✅ · lint ✅ (0 error, 0 warning) · test ✅ (**696 unit** = shared 140 · server 224 · extension 332) · build ✅ · db:migrate ✅ (**không** có migration mới — `context_hash` + `context_snapshot` đã có sẵn trong `0000`) · **E2E 32/32** ✅ (+3 kịch bản `e2e/contextCache.spec.ts`) · **mutation spot-check 5/5 bị bắt**.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1i · `docs/SYSTEM_DESIGN.md` §7.3.5.

### Quyết định kỹ thuật mới (T-M1-06)

| Quyết định | Lý do |
|---|---|
| `context_hash` = hash của **context đã cắt**, **không** phải hash của prompt | Đổi câu hỏi phải **không** đổi hash (hash là khoá tái lập lượt chat trong eval); đổi nội dung context thì **phải** đổi hash |
| `resolveContextItems()` — tính budget **một lần**, dùng chung cho prompt + log | Gọi `applyContextBudget()` 2 lần → 2 kết quả có thể khác nhau → `context_hash` lệch với context thật đã gửi |
| Hash **luôn** ghi · snapshot **theo setting, mặc định TẮT** | Snapshot chứa **nội dung trang** → dữ liệu nhạy cảm; cờ riêng `LOG_CONTEXT_SNAPSHOT`, **không** gộp `logFullContent` (khớp retention policy `SYSTEM_DESIGN.md` §5.2) |
| Hash FNV-1a 32-bit (thuần, không `node:crypto`) | Cần dùng ở extension **và** server → 1 hàm dùng chung; **không** phải hàm bảo mật (chỉ để so sánh) |
| `contextHash.ts` **không** import vào content script | Content script build IIFE 1 file → giữ `dist/content.js` nhỏ; dùng subpath `@sidekick/shared/constants` như hiện tại |
| Cache lưu ở `chrome.storage.local`, **không** ở service worker | MV3 SW bị kill ~30s → state trong SW mất |
| Nội dung **không đổi** → **không** ghi lại cache (giữ `capturedAt`) | Không reset TTL → trang cũ vẫn hết hạn đúng hạn. (Mutation #4 ban đầu sống sót vì thiếu test này → đã bổ sung) |
| Trang lỗi → **fallback** bản cache (nếu còn hạn) | PDF scan / extractor rỗng / mất mạng vẫn chat được |
| Cache **không có UI mới**, không hiện badge "đang lấy từ cache" | Cache là tối ưu kỹ thuật, không phải thay đổi nguồn sự thật mà user cần biết; badge gây nhiễu (DP-2). Ghi rõ ở `DESIGN_SYSTEM_BRIEF.md` §3.5.1 |
| Cache **không** dùng làm nguồn sự thật cho eval | Eval luôn dùng snapshot trong dataset → công bằng giữa 3 hệ thống (`EVAL_PLAN.md` §3.4.1) |

### Việc đã xong gần đây (T-M1-25 — Onboarding 3 bước lần đầu)

- **T-M1-25 (FR-UX-02)** — onboarding hiển thị **thay** nội dung chat trong side panel khi mở lần đầu (`sidekick.onboarding.completed` chưa set trong `chrome.storage.local`).
  - **Contract** — `packages/shared/src/types/entities.ts` (`providerInfoSchema`: `keySource` thêm `'none'` + `note?`) · `schemas/provider.ts` (`providerKeyRecordSchema` · `providerKeyTestResultSchema` · `providersResponseSchema`) · `constants.ts` (`ONBOARDING_STEPS = ['permissions','provider','try']` · `API_ROUTES.providerKeys`) · `errors.ts` (`PROVIDER_KEY_INVALID` 400 · `MASTER_KEY_NOT_CONFIGURED` 500).
  - **Server** — `providers/ollama.ts` (mới: `createOllamaProvider()` `requiresKey = false` · `detectOllama()` probe `GET /api/tags` timeout 1.5 s · `OLLAMA_VISION_MODEL_PREFIXES`) · `openaiCompatible.ts` thêm option `requiresKey?` + `testKey()` · `providers/types.ts` thêm `ProviderAdapter.testKey()` · `registry.ts` đăng ký `ollama` + `defaultModel` · `services/providerService.ts` (mới: `listProviderInfo` · `saveProviderKey` AES-256-GCM upsert `(provider_id, label)` · `listProviderKeys` chỉ metadata + `maskKey` · `deleteProviderKey` · `testProviderKey`) · `routes/providers.ts` (mới: 5 endpoint) · env `OLLAMA_BASE_URL` + `OLLAMA_MODEL`.
  - **Sửa chatService** — `request.provider` giờ **đặt đầu** chuỗi provider rồi nối tiếp fallback chain (trước đó *thay* chain → mất fallback, vi phạm FR-PROVIDER-04).
  - **Extension** — `lib/onboarding.ts` (mới, thuần: `readOnboardingState` · `completeOnboarding` · `resetOnboarding` · `readPreferredProvider` · `writePreferredProvider`) · `lib/providerClient.ts` (mới) · `hooks/useOnboarding.ts` (mới, lắng nghe `storage.onChanged`) · `components/onboarding/` (mới: `Onboarding` · `StepPermissions` · `StepProvider` · `StepTry`) · `App.tsx` tách → `ChatWorkspace.tsx` (nội dung chat nguyên trạng) · `PanelHeader.tsx` thêm nút "Hướng dẫn" (`CircleHelp`).
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (**648 unit** = shared 123 · server 214 · extension 311) · build ✅ · db:migrate ✅ (không có migration mới) · **E2E 29/29** ✅ (+6 kịch bản `e2e/onboarding.spec.ts`) · **mutation spot-check 5/5 bị bắt**.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1h · `docs/SYSTEM_DESIGN.md` §7.6.

### Quyết định kỹ thuật mới (T-M1-25)

| Quyết định | Lý do |
|---|---|
| Onboarding có ô nhập API key (BYOK đầy đủ) — lưu **K2** qua BFF | Chốt với user; cần `POST /api/providers/keys` + `GET /api/providers` (trước đó chưa tồn tại) |
| Bước 1 (quyền) **chỉ giải thích**, **không** đổi `manifest.json` | Không dùng `optional_permissions` → không phá parity, không cần user cấp quyền lại |
| Có **Ollama** trong onboarding (đẩy từ T-M2-01 lên M1) | User cần demo được luồng 3 bước mà **không** phải nhập API key |
| Adapter Ollama dùng chung `OpenAiCompatibleProvider` + option `requiresKey?: boolean` | Không nhân bản logic stream; chỉ khác header + base URL |
| `detectOllama()` probe `GET /api/tags` (timeout **1.5 s**) | Timeout ngắn → onboarding không bị treo khi user chưa bật Ollama |
| `GET /api/providers` **không gọi network** (metadata tĩnh từ registry) | Tránh blocking request của onboarding; chỉ Ollama mới được probe |
| Client **không bao giờ** nhận key gốc — chỉ `masked` (`****` + 4 ký tự cuối) | FR-PROVIDER-02; `maskKey` giữ nguyên từ M0 |
| `request.provider` **đặt đầu** chain thay vì **thay** chain | Trước đó mất fallback → vi phạm FR-PROVIDER-04; giờ provider ưu tiên nhưng vẫn fallback được |
| Client gửi `provider` ưu tiên trong `ChatRequest` (đọc từ `sidekick.preferredProvider`) | Nếu chỉ lưu cờ mà không gửi lên → provider user chọn ở onboarding **không** được dùng cho các lượt chat sau |
| Tách `App.tsx` → `App.tsx` (gating) + `ChatWorkspace.tsx` (nội dung chat nguyên trạng) | Rủi ro thấp: không sửa logic chat, chỉ di chuyển + bọc điều kiện |
| Cờ onboarding nằm ở `chrome.storage.local`, **không** ở SW | MV3 SW bị kill ~30s → state trong SW mất |
| `useOnboarding` lắng nghe `chrome.storage.onChanged` | Bấm "Bỏ qua" → panel chuyển sang chat **không cần reload** |
| Nút "Hướng dẫn" trong `PanelHeader` (icon `CircleHelp`) | Thay thế tạm cho entry trong Settings (T-M1-12 chưa làm) |
| Bước 3 dùng **SSE thật** qua `POST /api/chat` (không mock) | Onboarding phải chứng minh luồng chat thật hoạt động, không phải UI giả |
| Radio provider dùng `<input type="radio">` native + `<label>` | A11y tốt hơn, **không** cần thêm component UI (không cài thêm thư viện) |
| E2E: seed `sidekick.onboarding.completed = true` ở **context** level + fixture `sidePanelFresh` riêng | Nếu không seed, onboarding che chat → phá 23 test cũ; `sidePanelFresh` dùng profile tạm cho spec onboarding |
| Onboarding **không** nằm trong rubric eval | Đồ án đo chất lượng chat, không đo setup; so sánh với Edge/Gemini (không có onboarding) sẽ lệch tiêu chí đo — xem `EVAL_PLAN.md` §4.2.1 |

### Việc đã xong gần đây (T-M1-24 — Upload ảnh & vision input)

- **T-M1-24 (FR-VISION-01)** — ảnh là **đầu vào trực tiếp** của câu hỏi (`messages[].attachments[]`), **không** phải `ContextItem` → không phụ thuộc toggle `contextEnabled` (khác hẳn `@` / bôi đen / "Thêm trang này").
  - **Contract** — `packages/shared/src/schemas/vision.ts` (`IMAGE_MIME_TYPES` png/jpeg/webp/gif · `imageAttachmentSchema` · `imageAttachmentListSchema` ≤ 4 ảnh & tổng ≤ 12 MB) · `constants.ts` (`VISION` — 5 MB/ảnh, 4 ảnh, 12 MB tổng, 258 token/ảnh) · `chatTurnSchema.attachments` · `providerStreamRequestSchema.messages[].attachments` · 5 error code `VISION_*` + `PROVIDER_VISION_UNSUPPORTED`.
  - **Server** — bảng `message_attachments` (`data` **bytea** → Drizzle 0.45.4 không có `bytea` sẵn → `customType`) + migration `0001_puzzling_mathemanic.sql` · `attachmentService.ts` (`decodeBase64Image()` **tính lại byte thật** từ dữ liệu decode · `persistAttachments()` · `loadRecentAttachments()` → hỗ trợ hỏi tiếp bằng **text-only** ở lượt sau · `getAttachment()`) · route `GET /api/attachments/:id` trả **binary** + `Content-Type` đúng mime · `express.json({ limit: '16mb' })`.
  - **Provider** — `supportsVision()` (gemini luôn true · openai-compatible · groq `llama-4-scout`/`llama-3.2-*-vision` · openrouter theo prefix model · mock echo số ảnh) · Gemini → `parts: [{text},{inline_data:{mime_type,data}}]` · OpenAI-compatible → `content: [{type:'text'},{type:'image_url',image_url:{url:'data:<mime>;base64,<data>'}}]` · **fallback chain bỏ qua provider không hỗ trợ vision** → hết provider → `PROVIDER_VISION_UNSUPPORTED`.
  - **Token** — ảnh **luôn** gửi (kể cả khi toggle context tắt) và **trừ 258 token/ảnh** khỏi `historyBudget` **trước** khi `trimHistory()`.
  - **Extension** — `lib/imageUpload.ts` (thuần: validate · FileReader → base64 · parse DataTransfer · `measureImage()` đo pixel **không throw** · `extractImagesFromClipboard()`/`extractImagesFromDrop()` · `formatBytes`) · `hooks/useImageAttachments.ts` · `components/composer/AttachmentTray.tsx` (thumbnail + nút xoá + cảnh báo lỗi + ước lượng token) · `Composer.tsx` (nút `ImagePlus` · **paste** ảnh · **drag & drop** với `preventDefault()`) · `chatStore.pendingImages` · `useChat` chụp **snapshot history trước** khi `addMessage(userMessage)` (tránh lặp turn) · `MessageBubble.tsx` render ảnh (click → mở tab).
- **Verify** — typecheck ✅ · lint ✅ · test ✅ (**547 unit** = shared 103 · server 166 · extension 278) · build ✅ · **E2E 23/23** ✅ (+5 kịch bản `e2e/vision.spec.ts`) · **mutation re-check 5/5 bị bắt**.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1g · `docs/SYSTEM_DESIGN.md` §7.4.

### Quyết định kỹ thuật mới (T-M1-24)

| Quyết định | Lý do |
|---|---|
| Ảnh là **`messages[].attachments[]`**, **không** phải `ContextItem` | Ảnh là **đầu vào trực tiếp** của câu hỏi; nếu để trong `context` thì toggle context tắt sẽ làm mất ảnh → không đúng trực giác người dùng |
| `data` base64 **thuan** (không prefix `data:`) trong contract | Provider adapter tự quyết định định dạng (`inline_data` vs `image_url.url`) → 1 contract phục vụ nhiều provider |
| Lưu **bytea** trong Postgres thay vì file trên đĩa | Self-host, không cần object storage; ảnh đã gửi vẫn tra lại được sau khi reload panel → multi-turn |
| Server **tính lại** byte size từ dữ liệu decode, không tin `bytes` của client | Client có thể khai sai → vượt giới hạn 5 MB/12 MB mà không bị chặn |
| `ord` (int) để sắp xếp ảnh **tất định** | `created_at` trùng nhau khi lưu cùng lúc → thứ tự ảnh trong prompt không ổn định |
| `id` do **client sinh** (uuid) | Server upsert idempotent → retry không nhân bản |
| `loadRecentAttachments()` nạp ảnh lượt trước | Cho phép lượt sau hỏi tiếp về ảnh mà **không** phải upload lại (multi-turn) |
| Fallback chain **lọc provider không hỗ trợ vision** khi lượt có ảnh | Provider không hỗ trợ sẽ trả lỗi 400 → fallback vô nghĩa; hết provider → `PROVIDER_VISION_UNSUPPORTED` (error code rõ ràng thay vì lỗi 400 mơ hồ) |
| Ước lượng **258 token/ảnh** (heuristic, không kéo tokenizer) | Giống cách `estimateTokens` của context budget — nhất quán + không phình bundle; số thật từ `usage` event |
| `useChat` chụp **snapshot history trước** khi `addMessage(userMessage)` | Lấy history sau khi thêm → **lặp turn** (đã gặp thật, đã fix) |
| `mergeImages()` dedup theo **base64** (không theo `id`) | Cùng 1 ảnh gửi lại với id khác vẫn phải gộp |
| `express.json({ limit: '16mb' })` | 4 ảnh × 5 MB → base64 ≈ 27 MB... chọn 16 MB là trần thực tế; `imageAttachmentListSchema` vẫn là giới hạn thật |
| Test E2E dùng `expect.poll` cho `GET /api/attachments/:id` | Server persist ảnh **sau** khi nhận request → GET đầu tiên có thể 404 → race condition |
| `VISION_MIME_TYPES` đặt ở `constants.ts` (không phải `schemas/vision.ts`) | `schemas/vision.ts` cần tuple này → đặt ngược lại sẽ tạo **vòng import** `constants ↔ vision` |
| Test **khoá** danh sách mime (`VISION.ALLOWED_MIME_TYPES` phải đúng 4 giá trị) | Mutation "thêm `image/bmp` vào allowlist" lọt qua test cũ → phải assert allowlist đúng |
| `measureImage()` bọc try/catch, lỗi → `undefined` | Đo pixel chỉ phục vụ preview → hỏng đo không được làm hỏng đính kèm ảnh |

### Việc đã xong gần đây (T-M1-02 — selection context: bôi đen → hỏi)

- **T-M1-02 (FR-CONTEXT-04)** — 2 đường tương tác: **(A)** bôi đen trên trang → nút nổi "Hỏi Sidekick" (Shadow DOM) cạnh vùng chọn → click → đoạn text vào context với `kind: 'selection'`, `tier: 'selection'` (cao nhất); **(B)** nút "Dính đoạn đã chọn" trong panel → đọc selection của tab active qua `chrome.scripting.executeScript`.
  - **Lõi thuần** — `content/selection.ts` (`readSelectionFromDocument()` · `normalizeSelectionText()` · `isMeaningfulSelection()` · `selectionAnchorRect()`) · `lib/contextAttach.ts` (`attachSelection()` · `captureActiveSelection()`) · `packages/shared/src/constants.ts` (`MAX_SELECTION_CHARS` 10 000 · `MIN_SELECTION_CHARS` 10 · `SELECTION_PENDING_TTL_MS` 300 000).
  - **Content script** — `content/selectionWatcher.ts` (mouseup/keyup → debounce 120 ms → hiện nút) · `content/selectionButton.ts` (Shadow DOM `mode: 'open'`) · `content/selectionStyles.ts` (CSS sinh từ `design/tokens.json`).
  - **Cầu nối** — `lib/selectionProtocol.ts` (`SELECTION_ACTION` · type guard thuần · `selectionItemId()` hash FNV-1a) · `lib/selectionBridge.ts` (**open-with-fallback**) · `lib/storage.ts` (`sidekick.pendingSelection`) · `background/serviceWorker.ts`.
  - **Panel** — `hooks/useSelection.ts` (consume khi mount + `storage.onChanged`) · `hooks/useChat.ts` (`attachSelection()` + `attachActiveSelection()`) · `ContextChips.tsx` (nút "Dính đoạn đã chọn") · `App.tsx` · `ContextNotice.tsx` (case `CONTEXT_SELECTION_EMPTY`).
- **Verify** — typecheck ✅ · lint ✅ · test ✅ (**419 unit** = shared 75 · server 126 · extension 218) · build ✅ (`dist/content.js` 13.9 kB, **vẫn IIFE 1 file, không `import`**) · **E2E 18/18** ✅ (+5 kịch bản `e2e/selection.spec.ts`) · **mutation re-check 5/5 bị bắt**.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1f · `docs/SYSTEM_DESIGN.md` §7.3.4.

### Quyết định kỹ thuật mới (T-M1-02)

| Quyết định | Lý do |
|---|---|
| Cơ chế **open-with-fallback** (ghi storage → thử `sidePanel.open()` → lỗi thì im lặng) | `chrome.sidePanel.open()` chỉ chạy trong user gesture; message content script → SW **không** giữ được gesture → không phụ thuộc cứng vào việc mở được panel |
| Đoạn chờ nằm ở `chrome.storage.local`, **không** nằm trong SW | MV3 SW bị kill sau ~30s → state trong SW mất → mất đoạn chọn |
| TTL 5 phút cho đoạn chờ | User đã chuyển sang task khác → tránh đính kèm nhầm |
| `selectionProtocol.ts` dùng **type guard thuần**, không `zod` | Content script build IIFE 1 file → kéo `zod` làm bundle phình to |
| Nút nổi trong **Shadow DOM** (`mode: 'open'`) | CSS trang host không ghi đè được; `open` để Playwright locator xuyên vào để assert |
| Icon SVG **viết tay**, không `lucide-react` | Content script không được kéo thư viện UI → giữ `dist/content.js` nhỏ |
| Id item = **hash nội dung** (`selection-<hash>`) | Bôi đen lại cùng đoạn → `attachItem` **thay** item cũ, không nhân bản |
| Chỉ hiện nút khi selection ≥ 10 ký tự | Click chuột / kéo 1–2 ký tự không phải ý định "hỏi về đoạn này" |
| Ẩn nút khi `selectionchange` rỗng hoặc scroll | Toạ độ neo không còn đúng → nút "trôi" theo layout |
| `useSelection` giữ `onAttach` trong `ref` | Callback inline trong `App` tạo mới mỗi render → nếu không, effect chạy lại vô hạn |

### Việc đã xong gần nhất (T-M1-05 `@` multi-tab + đóng 8 blind spot test)

- **T-M1-05 (FR-CONTEXT-03)** — `lib/tabList.ts` (`listOpenTabs()` — `chrome.tabs.query({ currentWindow: true })` + lọc `chrome://`/`file://` + `domainOf()`, **không throw**) · `hooks/useTabs.ts` (nạp lazy) · `hooks/useMention.ts` (`findMention()` thuần — `@` phải ở đầu/sau khoảng trắng nên email `a@b.com` không bật popover; `useMention()` quản lý state + `apply()` chèn `@tên tab `) · `components/context/MentionPopover.tsx` (favicon · title · domain · ✓ tab đã đính kèm · gạch tab active · `role="listbox"`/`role="option"`/`aria-selected`) · `lib/contextAttach.ts` thêm `attachTab(tabId)` (`ContextItem { id: 'tab-N', tier: 'attachment' }`, tab đã đính kèm → không capture lại) · `hooks/useChat.ts` thêm `attachTab()` · `Composer.tsx` thêm `onCursorChange`/`onEscape`/`inputRef` · `App.tsx` lọc query + chèn text + đính kèm.
- **Đóng 8 blind spot test** (chi tiết `docs/SYSTEM_DESIGN.md` §7.2.2) — `apps/extension/tests/storage.test.ts` (mới, 10 test) · `extractor.test.ts` (+6 fixture thật + biên) · `packages/shared/tests/contextBudget.test.ts` (+4 assert phần đầu được giữ) · `chatSchema.test.ts` (+11 validate `role`/`id`/history) · `apps/server/tests/chatService.test.ts` (mới, 14 test) · `openaiCompatible.test.ts` (mới, 13 test — mock `fetch` SSE).
- **Verify** — typecheck ✅ · lint ✅ · test ✅ (**332 unit** = shared 75 · server 126 · extension 131) · build ✅ · **E2E 13/13** ✅ (+4 kịch bản `e2e/mention.spec.ts`) · **mutation re-check 5/5 bị bắt**.
- **Sửa thêm** — `apps/server/vitest.config.ts` thêm `testTimeout: 30_000` (pdfExtractor timeout giả khi 12 worker chạy song song).
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1e.

### Quyết định kỹ thuật mới (T-M1-05)

| Quyết định | Lý do |
|---|---|
| `findMention()` tách ra hàm **thuần** (không phải logic trong component) | Test được 100% không cần DOM; mutation check chứng minh bắt lỗi thật |
| Token `@` chỉ hợp lệ ở đầu chuỗi hoặc sau khoảng trắng | `@` trong email (`a@b.com`) **không** được mở popover — nếu không, mọi email trong prompt đều bật popover |
| Cơ chế "đóng token" sau `Escape` (snapshot token hiện tại) | Trình duyệt bắn `select` event sau khi thoát ô nhập → nếu không có cơ chế này popover **mở lại ngay** (đã gặp thật trong E2E) |
| `listOpenTabs()` **không bao giờ throw** | Lỗi `chrome.tabs` → trả `[]` → popover rỗng, panel vẫn chat được |
| Chỉ query `currentWindow: true` | Không lộ tab của cửa sổ khác — side panel thuộc cửa sổ hiện tại |
| Nạp danh sách tab **lazy** (chỉ khi popover mở) | Không query tabs liên tục → không tốn CPU khi user đang chat |
| Chèn `@tên tab ` vào textarea khi chọn | User **nhìn thấy** nguồn mình đính kèm → minh bạch (không giấu context) |
| Dùng lại `captureTabContext()` cho tab được chọn | Không nhân bảc 3 nhánh html/pdf/youtube của T-M1-01/21/22 → không regression |

### Việc đã xong gần nhất (Audit chất lượng test + sửa hạ tầng test)

- **Vấn đề phát hiện:** test của `apps/extension` + `apps/server` resolve `@sidekick/shared` qua `package.json` `exports` → **`packages/shared/dist/`** (bản build). Hệ quả: (1) sửa `packages/shared/src` mà quên `pnpm build` → test **chạy code cũ và vẫn xanh**; (2) `packages/shared/dist` bị `.gitignore` → fresh clone `pnpm test` **fail** (`Cannot find module "@sidekick/shared"`); (3) repo chưa có CI.
  - Bằng chứng: inject `throw` vào `packages/shared/src/contextBudget.ts` → test extension **vẫn PASS 16/16**.
- **Đã sửa:** alias `@sidekick/shared` → `packages/shared/src` trong `vitest.config.ts` của extension · server · eval (+ subpath `@sidekick/shared/constants`) · `pre` hooks ở root (`pretest` · `pretest:coverage` · `pretest:e2e` · `pretypecheck` · `prebuild` · `predev`) build shared trước · `dev:shared` (`tsc --watch`) chạy song song trong `pnpm dev` · guard test `sharedAlias.test.ts` ở extension + server.
  - Bằng chứng: sau khi có alias, inject `throw` cùng trên → test **FAIL** đúng chỗ (`packages/shared/src/contextBudget.ts:26`); xoá `dist` → `pnpm test` / `pnpm typecheck` / `pnpm build` / `pnpm dev` đều tự build và chạy được.
- **Audit mutation testing (~78 mutation):** phần lớn mutation trên logic cốt lõi đều bị test bắt → **không có bằng chứng test bị "tình cho đúng"**. Tìm được **8 blind spot thật** (3 test extractor đi nhánh khác tên · thiếu fixture biên · chỉ assert độ dài chứ không assert phần giữ lại · chưa test validate `role` · **chưa có test nào cho `lib/storage.ts`** · `chatService.ts` coverage 25% · provider thật chưa test) → ghi ở `SYSTEM_DESIGN.md` §7.2.2.
- **Số test:** 229 → **235** (+6 guard). Chi tiết: `SYSTEM_DESIGN.md` §7.1.1 + §7.2.1 + §7.2.2.
- **Bonus:** sửa 3 lỗi lint tồn đọng (`ChatRequest` unused trong `useChat.ts` · `import()` type annotation trong `e2e/context.spec.ts`).

### Quyết định kỹ thuật mới (audit test)

| Quyết định | Lý do |
|---|---|
| Alias `@sidekick/shared` → `packages/shared/src` trong **vitest** config (không phải vite build config) | Test phải chạy trên source hiện tại. `vite build` + `tsx` vẫn dùng `dist` — đúng cho production |
| Subpath `@sidekick/shared/constants` khai báo **trước** alias chung | Nếu không, alias chung sẽ che mất subpath → resolve fail |
| `pre` hooks build shared thay vì alias cho `tsc`/`vite build` | `tsc --noEmit` và `vite build` cần `dist/*.d.ts` để resolve type — alias Vite không áp dụng cho `tsc` |
| `dev:shared` (`tsc --watch`) thêm vào `pnpm dev` | Sửa `packages/shared/src` được hot-reload, không phải build lại thủ công |
| Guard test `sharedAlias.test.ts` | Chặn ai đó xoá nhầm alias → quay lại trạng thái "test xanh nhưng code sai" |

### Việc đã xong gần nhất (T-M1-23 — Ngân sách context & mô hình "đính kèm chủ động")

- **Contract** — `packages/shared/src/contextBudget.ts` (`estimateTokens` · `applyContextBudget` · `trimHistory`) + `schemas/chat.ts` (`contextItemSchema` · `contextBundleSchema` · `normalizeContext`) + `constants.ts` (`CONTEXT_WINDOWS` · `CONTEXT_SAFETY_MARGIN_TOKENS` · `MAX_CONTEXT_ITEMS`).
- **Server** — `buildContextPrompt()` render item theo tier với nhãn nguồn; `buildProviderMessages()` áp `applyContextBudget()` + `trimHistory()` → server cắt lại lần nữa (nguồn chân lý).
- **Extension** — `lib/contextAttach.ts` (`attachCurrentTab`) · `lib/storage.ts` (persist toggle) · `chatStore` (`attachedItems` · `contextEnabled` · `budget`) · `useChat` (`buildRequestContext`) · `ContextChips.tsx` · `ContextBudget.tsx` · `App.tsx` mount 2 component trên Composer.
- **Hành vi đổi (quan trọng):** context **không còn tự capture** tab active mỗi lượt. Không đính kèm gì → request **không** có payload `context` → chat thuần LLM (FR-CONTEXT-13).
- **Test** — +42 unit test (tổng 229) + **4 E2E mới** (`e2e/context.spec.ts`); `e2e/extract.spec.ts` cập nhật (phải bấm "Thêm trang này" trước khi trích xuất). Bằng chứng: `docs/IMPLEMENTATION_PLAN.md` §3.1c.

### Quyết định kỹ thuật mới (T-M1-23)

| Quyết định | Lý do |
|---|---|
| Mô hình "đính kèm chủ động" (toggle context mặc định **TẮT**) thay vì "tự share tab active" | Đã chốt với user: cần có đường "chat như LLM thuần" + biểu diễn được nhiều nguồn theo thứ tự ưu tiên (FR-CONTEXT-07/13). Đánh đổi 1 điểm parity "tiện" lấy 1 điểm "minh bạch + riêng tư" — đã ghi trung thực trong `COMPARISON_MATRIX.md` §D/§E + `EVAL_PLAN.md` FC-12 |
| Logic ngân sách đặt ở `packages/shared` (`contextBudget.ts`), **dùng chung** client + server | Meter "đã dùng X/Y" không được lệch với cái thực sự gửi đi; server vẫn cắt lại (nguồn chân lý) |
| `context` đổi sang bundle `{ items: ContextItem[] }` có `tier` | Cần nhiều nguồn + thứ tự ưu tiên; `tier` là thứ tự cấp phát ngân sách (`selection` > `attachment` > `currentTab`) |
| `z.preprocess(normalizeContext, …)` — nhận cả shape cũ lẫn mới | Eval harness / client cũ không vỡ khi đổi contract |
| `estimateTokens` là heuristic `ceil(chars/4)`, không thêm dependency tokenizer | Không kéo thêm lib vào bundle; số token thật hiển thị từ `usage` event (T-M2-03). Docs ghi rõ là **xấp xỉ** |
| Đính kèm item **tự bật** toggle context | User vừa chủ động yêu cầu dùng context → không bắt họ phải tìm nút toggle; vẫn tắt được bằng tay |
| `chatStore.reset()` giữ nguyên `attachedItems` + `contextEnabled` | "Xoá cuộc trò chuyện" không nên xoá nguồn context user đang dùng |
| T-M1-04 **hấp thụ** vào T-M1-23 | Chip + toggle là cùng một UI, tách làm trùng lặp |

### Việc đã xong gần nhất (T-M1-21 + T-M1-22 — Trích xuất PDF & transcript YouTube)

- **T-M1-21 (PDF)** — `apps/server/src/lib/pdfExtractor.ts` parse bằng `pdfjs-dist@^4.10.38` (build `legacy`) · `apps/server/src/lib/safeFetch.ts` chặn SSRF (loopback/private/link-local/CGNAT/IPv6 nội bộ/IPv4-mapped, redirect ≤ 3 hop, timeout 15s, size cap 20 MB) · `POST /api/extract/pdf`.
- **T-M1-22 (YouTube)** — `apps/server/src/lib/youtubeExtractor.ts`: watch page → `POST youtubei/v1/player` client `ANDROID` (`clientVersion 20.10.38`, `androidSdkVersion 34`, header `X-Youtube-Client-Name: 3`) → `captionTracks` → `timedtext` XML → `[mm:ss] text`. Ưu tiên `vi` → `en`; track thủ công trước `asr`.
- **Contract** — `packages/shared/src/pageKind.ts` (`detectPageKind` / `extractYouTubeVideoId` / `isPdfUrl`) + `schemas/extract.ts` + 4 error code `CONTEXT_*` + `pageContextSchema` có `sourceKind`/`contextError`.
- **Extension** — `captureTabContext()` phân nhánh theo loại trang; `ContextNotice.tsx` hiển thị lỗi trích xuất trên Composer (PDF scan / không có caption).
- **Nguyên tắc bất di bất dịch:** lỗi trích xuất **luôn trả HTTP 200** kèm `error` trong body → panel chỉ hiện thông báo, chat không bao giờ hỏng.
- +44 unit test + 2 E2E. Bằng chứng: `docs/IMPLEMENTATION_PLAN.md` §3.1b.

### Quyết định kỹ thuật mới (T-M1-21/22)

| Quyết định | Lý do |
|---|---|
| `pdfjs-dist@^4.10.38` (bản cuối Node ≥ 20) thay vì `unpdf` | `unpdf` yêu cầu Node ≥ 24, repo dùng Node 22 (`.nvmrc`) |
| `pdfjs-dist` chỉ nằm ở `apps/server` | Không kéo ~10 MB vào bundle extension → `dist/content.js` giữ nguyên ~4.8 kB |
| Client InnerTube `ANDROID` (không phải `WEB`) | Client `WEB` yêu cầu `signatureCipher`/`poToken` → `timedtext` trả về rỗng; client `ANDROID` trả `baseUrl` có `signature` hợp lệ |
| BFF tự theo redirect (tối đa 3 hop) thay vì `redirect: 'follow'` | Không kiểm soát được host của hop tiếp theo → mất lớp chống SSRF |
| Lỗi nghiệp vụ trả HTTP 200 + `error` trong body | Client (side panel) chỉ cần đọc body; tránh phân biệt status → đơn giản hoá UI, không làm hỏng chat |
| `detectPageKind()` đặt ở `packages/shared` (không trong extension) | Cả extension lẫn server đều cần → 1 nguồn sự thật; nhưng **không** export qua subpath `./constants` để content script không kéo theo `zod` |
| `pageContextSchema` mở rộng `sourceKind` + `contextError` ngay | Tránh sửa contract lần 2 ở T-M1-23 (ngân sách context) |

### Audit docs FR ↔ Task (2026-11-04)

Rà soát toàn bộ `docs/` đối chiếu `REQUIREMENTS.md` ↔ `IMPLEMENTATION_PLAN.md`. Kết quả:

- **Phát hiện:** **31 FR + 27 NFR (58 yêu cầu)** chưa được map tới task nào trong cột FR của plan. Đáng chú ý nhất: `FR-CONTEXT-05` (PDF) và `FR-CONTEXT-06` (YouTube) — không có task card nào dù `REQUIREMENTS.md` §4.2 đã liệt kê (PDF còn bị ghi nhầm vào T-M1-06); `FR-CONTEXT-07` (ngân sách context, **Must**); `FR-VISION-01` (upload ảnh, **Must**); `FR-UX-02` (onboarding, **Must**). Ngoài ra 2 nhãn FR sai: T-M1-04 (`FR-CONTEXT-09`) và T-M1-06 (`FR-CONTEXT-05`).
- **Đã sửa:** thêm 11 task card mới (T-M1-21..25, T-M2-19..22, T-M3-10..11) · sửa 2 nhãn FR sai · bổ sung FR/NFR vào 12 task card cũ · thêm bảng traceability đầy đủ (83 FR + 29 NFR) ở `REQUIREMENTS.md` §11.1 và bản rút gọn ở `IMPLEMENTATION_PLAN.md` §3.2.
- **Quyết định:** nâng `FR-CONTEXT-05` / `FR-CONTEXT-06` từ **Should → Must** (Edge A20 + Gemini B10 đều ở mức Must) → M1 tăng 20 → 25 task.
- **Trạng thái:** chỉ sửa **docs**, chưa viết code. Task implement lần lượt: T-M1-21 → T-M1-22 → T-M1-23 → T-M1-24 → T-M1-25.

> **Cập nhật 2026-11-04 (sau khi implement):** T-M1-21 + T-M1-22 + **T-M1-23** + **T-M1-05** **đã xong**. M1 hiện **6/25 task** (T-M1-01 · T-M1-21 · T-M1-22 · T-M1-23 · T-M1-05 + T-M1-04 hấp thụ). Thứ tự tiếp theo: **T-M1-02** (selection — tier cao nhất) → **T-M1-24** (upload file — tier `attachment`) → **T-M1-25** (onboarding) → rồi quay lại **T-M1-06** (truyền context — contract `context.items[]` đã sẵn sàng) → T-M1-07 (markdown/code).
>
> **Cảnh báo khi làm T-M1-02 / T-M1-24:** các task này giờ chỉ cần **tạo ra `ContextItem`** (đúng `kind` + `tier`) rồi gọi `attachItem()` — logic cắt bớt, meter, toggle, prompt rendering đã xong ở T-M1-23. Không cần sửa lại logic budget. Xem thêm `lib/contextAttach.ts` (`attachTab()` làm mẫu) — `useMention`/`MentionPopover` là mẫu cho UI pattern "overlay nổi trong Composer".
>
> **Lưu ý khi sửa E2E cũ:** context không còn tự capture mỗi lượt → test nào dựa vào việc gửi prompt là thấy `ContextNotice` đều phải bấm "Thêm trang này" trước (xem `e2e/extract.spec.ts` đã cập nhật).

### Việc đã xong gần nhất (T-M1-01 — Content script extractor)

- **T-M1-01** — `apps/extension/src/content/extractor.ts`: Readability-lite (clone `Document` → xoá noise → chấm điểm node → fallback `body`), trả `{ title, byline, url, text, excerpt, strategy, wordCount }`.
- `apps/extension/src/lib/pageContext.ts`: `captureTabContext()` + `getActiveTabId()` qua `chrome.scripting`, tự inject `content.js` nếu chưa có, không throw.
- `packages/shared`: `pageContextSchema` có `text` + `excerpt`; `LIMITS.MAX_PAGE_TEXT_CHARS = 40_000`.
- `apps/server`: `buildContextPrompt()` đưa nội dung trang vào prompt (đánh dấu "dữ liệu, không phải chỉ thị").
- `useChat` tự capture context của tab active; lỗi capture không hỏng chat.
- +29 unit test + 1 E2E thật (`e2e/extractor.spec.ts`). Bằng chứng: `docs/IMPLEMENTATION_PLAN.md` §3.1.
- **Sửa lỗi build content script:** bundle ra ESM → Chrome không load được → tách `vite.content.config.ts` (IIFE). Xem `docs/SYSTEM_DESIGN.md` §7.4.

### Việc đã xong trong phiên gần nhất (M0 — Foundation)

- **T-M0-01/02** — Monorepo pnpm workspace + ESLint/Prettier/TS strict. `pnpm install`, `pnpm typecheck`, `pnpm lint` đều pass.
- **T-M0-03** — `packages/shared`: Zod schema, union 8 SSE event, error codes.
- **T-M0-04/05** — Postgres 16 + pgvector 0.8.7 trong Docker (`sidekick-db`, healthy), Drizzle 6 bảng, migration `0000_adorable_sister_grimm.sql`.
- **T-M0-06** — BFF Express 5 (`/api/health`, error middleware, origin guard, request logger).
- **T-M0-07/08/09** — Provider layer: Mock + Groq + OpenRouter + Gemini Direct; keyResolver K1/K2/K3; AES-256-GCM.
- **T-M0-10** — `POST /api/chat` SSE 8 event + `request_logs` + abort.
- **T-M0-11/12/13/14** — Extension MV3: side panel React + Tailwind v4 + shadcn, manifest + 4 icon, `sseClient` đọc stream trực tiếp, `useChat` + Zustand, design tokens.
- **T-M0-15** — `apps/eval` scaffold (dataset loader + CLI).
- **Verify M0**: 3/3 provider stream thật · E2E side panel 2/2 pass · tag `v0.1`.
- Chi tiết bằng chứng: `docs/IMPLEMENTATION_PLAN.md` §2.1.

### Quyết định đã chốt trong các phiên trước

| Quyết định | Lý do |
|---|---|
| Tailwind + shadcn/ui (copy code vào repo) | Sở hữu 100%, không phụ thuộc runtime, tự sửa sâu được |
| Drizzle ORM + PostgreSQL 16 | Type-safe, hỗ trợ `pgvector`, migration đọc được |
| Monorepo pnpm workspace | 1 nguồn type cho extension/server/eval |
| 3 nguồn API key: K1 / K2 / K3 | Demo nhanh + BYOK an toàn + fallback khi BFF down |
| BFF là bắt buộc (không bỏ) | Cần BYOK mã hoá, RAG, MCP, log cho eval |
| Streaming không qua service worker | MV3 SW bị kill ~30s |
| Workflow (M4) implement cuối cùng | Không nằm trong yêu cầu bắt buộc của thầy |
| Git local, chưa push | Theo quyết định ban đầu |
| Provider chain `groq → openrouter → gemini` | Groq nhanh + rẻ nhất; OpenRouter/Gemini làm fallback |
| `maxOutputTokens` mặc định 2048 | OpenRouter trả HTTP 402 nếu max token quá lớn |
| Gemini `thinkingConfig.thinkingBudget = 0` | Model Gemini 3.x dùng hết budget cho "thought", không trả text |
| Origin allowlist hỗ trợ `chrome-extension://*` | Id extension load unpacked đổi theo máy, không thể hardcode |
| Typography đặt trên `#root` (không phải `body`) | Chrome inject rule `font` cho `body` ở trang extension, đè lên design token |
| Extractor tự viết thay vì dùng `@mozilla/readability` | Không kéo thêm dependency lớn vào content script; thuật toán rút gọn đủ dùng cho blog/docs |
| `pageContextSchema` mở rộng ngay ở T-M1-01 (thêm `text`/`excerpt`) | Tránh sửa contract 2 lần (T-M1-01 + T-M1-06) |
| `captureTabContext()` không bao giờ throw | Trang `chrome://` / Web Store không đọc được → panel vẫn phải chat được |
| Content script build riêng thành IIFE | Chrome KHÔNG load được content script dạng ESM → tách `vite.content.config.ts` (`docs/SYSTEM_DESIGN.md` §7.4) |
| `@sidekick/shared` có subpath export `./constants` | Content script không cần kéo theo bundle `zod` (101 kB → 4.7 kB) |
| PDF + YouTube transcript **nâng lên Must** (2026-11-04) | Edge Copilot (A20) và Chrome Gemini (B10) đều có ở mức Must → cần để đạt gate parity M1 (≥90% dòng Must). Đánh đổi: M1 20 → 25 task |
| PDF/YouTube extract **ở BFF chứ không ở content script** | PDF viewer là plugin native của Chrome (content script không inject được); transcript YouTube nằm ở `captionTracks` chứ không phải DOM text. Cả 2 nhánh chuẩn hoá về cùng shape `context.text` → `buildContextPrompt()` không phân biệt nguồn (`docs/SYSTEM_DESIGN.md` §7.3.1) |
| Bảng FR ↔ Task đặt ở `REQUIREMENTS.md` §11.1 (không phải trong plan) | FR là nguồn chân lý; plan chỉ giữ bản rút gọn theo nhóm ở §3.2 → tránh trùng lặp 2 nơi dễ lệch |
| `FR-WORKFLOW-04` (trigger theo sự kiện) defer sang M5 | `chrome.tabs.onUpdated` không đáng tin trong MV3 (SW bị kill ~30s) → phải dùng `chrome.alarms` ≥ 30s hoặc polling; rủi ro cao, không trên đường găng |
| **Context chỉ gửi khi user chủ động đính kèm** (2026-11-04, T-M1-23) | Đã chốt với user: cần đường "chat như LLM thuần" (FR-CONTEXT-13) + biểu diễn nhiều nguồn theo thứ tự ưu tiên. Edge/Gemini mặc định share tab → khác biệt được ghi trung thực trong `COMPARISON_MATRIX.md` §D/§E + `EVAL_PLAN.md` FC-12 |
| **Toggle context mặc định TẮT, nhưng đính kèm item thì tự bật** (T-M1-23) | User vừa chủ động yêu cầu dùng context → không bắt họ tìm nút toggle; vẫn tắt được bằng tay |
| Logic ngân sách context đặt ở `packages/shared` dùng chung client + server | Meter "đã dùng X/Y" không được lệch với cái thực sự gửi đi; server cắt lại là nguồn chân lý |
| `context` = bundle `{ items: ContextItem[] }` có `tier`, nhận cả shape cũ qua `z.preprocess` | Nhiều nguồn + thứ tự ưu tiên; backward compatible để eval harness / client cũ không vỡ |

---

## 3. Câu hỏi cần hỏi lại user

_(Ghi lại các câu hỏi chưa có câu trả lời, hoặc điều kiện đã thay đổi)_

- Hạn chót nộp bài cụ thể là ngày nào? (ảnh hưởng kịch bản cắt M4)
- Có nên push lên remote (GitHub) để backup không? (hiện tại chỉ git local)
- Ngôn ngữ chính của UI: tiếng Việt hay song ngữ ưu tiên?
- Có cần giữ `MockProvider` trong production build không, hay chỉ dùng cho test?

---

## 4. Mẹo để tiết kiệm token

| Cần biết | Đọc file |
|---|---|
| Dự án là gì, stack, lệnh | `AGENTS.md` |
| Task tiếp theo làm gì | `docs/IMPLEMENTATION_PLAN.md` § milestone hiện tại |
| API shape, schema DB | `docs/SYSTEM_DESIGN.md` §4–§5 |
| Component nào dùng, token nào | `docs/DESIGN_SYSTEM_BRIEF.md` §2–§3 |
| FR tương ứng | `docs/REQUIREMENTS.md` §4 (grep theo mã FR) |
| Ràng buộc MV3 | `.cursor/rules/mv3-chrome.mdc` |

**Mẹo:** dùng `Grep` với mã FR (`FR-CHAT-12`) thay vì đọc cả `REQUIREMENTS.md`.

---

## 5. Quy trình kết thúc phiên chat

Trước khi ngừng, **bắt buộc**:

1. Cập nhật §2 "Đang làm dở" + §3 "Câu hỏi cần hỏi lại user" ở file này.
2. Thêm entry vào `docs/CHANGELOG.md`.
3. `git add -A && git commit` — không để lại thay đổi chưa commit.
4. Nếu task dở → ghi rõ "tiếp tục từ đâu" trong §2.

---

## 6. Mẫu ghi chép

```markdown
### Đang làm dở
- **T-M1-01** — content script extractor: đã tạo `src/content/extractor.ts` với heuristic `<article>`.
  Còn thiếu: fallback cho trang không có `<article>`, và test với fixture HTML.
  Tiếp tục từ: thêm `tests/extractor.test.ts` với 3 fixture HTML.

### Quyết định mới trong phiên này
- Dùng `@tailwindcss/vite` plugin thay vì PostCSS config (nhanh hơn, ít file hơn).
```
