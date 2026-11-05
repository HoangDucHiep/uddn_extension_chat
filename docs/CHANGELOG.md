# CHANGELOG — Tài liệu & triển khai

> Ghi lại **mọi thay đổi** trong repo, từ mới → cũ.
> Agent mới đọc 20 dòng đầu là nắm được gần đây đã làm gì.
> Format xem `.cursor/rules/docs-sync.mdc` §2.

---

## [Unreleased]
### Added
- **T-M1-25 — Onboarding 3 bước lần đầu (FR-UX-02)**
  - `packages/shared/src/types/entities.ts` — `providerInfoSchema`: `keySource` thêm `'none'` (provider không cần key) · thêm `note?: string` (vd "Ollama chưa chạy").
  - `packages/shared/src/schemas/provider.ts` — `providerKeyRecordSchema` (id · providerId · label · masked · createdAt) · `providerKeyTestResultSchema` (ok · latencyMs · error?) · `providersResponseSchema` · `providerKeyListResponseSchema` · `saveProviderKeyResponseSchema`.
  - `packages/shared/src/constants.ts` — `ONBOARDING_STEPS = ['permissions','provider','try']` · `API_ROUTES.providerKeys = '/api/providers/keys'`.
  - `packages/shared/src/errors.ts` — thêm `PROVIDER_KEY_INVALID` (400) · `MASTER_KEY_NOT_CONFIGURED` (500).
  - `apps/server/src/providers/ollama.ts` (mới) — `createOllamaProvider()` (OpenAI-compatible `http://127.0.0.1:11434/v1`, `requiresKey = false`) · `detectOllama()` probe `GET /api/tags` timeout 1.5 s → `{ available, models, error }` · `OLLAMA_VISION_MODEL_PREFIXES`.
  - `apps/server/src/providers/openaiCompatible.ts` — thêm option `requiresKey?: boolean` (mặc định `true`) · `testKey(apiKey)` → `{ ok, error? }`.
  - `apps/server/src/providers/types.ts` — `ProviderAdapter.testKey(apiKey): Promise<ProviderKeyCheck>` (implement ở `gemini.ts` · `mock.ts` · `openaiCompatible.ts`).
  - `apps/server/src/providers/registry.ts` — đăng ký `ollama` + lưu `defaultModel` từng provider → `GET /api/providers` không gọi network (trừ probe Ollama).
  - `apps/server/src/services/providerService.ts` (mới) — `listProviderInfo()` (keySource K2 > K1 > none) · `saveProviderKey()` (AES-256-GCM, upsert theo `(provider_id, label)`) · `listProviderKeys()` (chỉ metadata + `maskKey`) · `deleteProviderKey()` · `testProviderKey()` (gọi adapter thật).
  - `apps/server/src/routes/providers.ts` (mới) — `GET /providers` · `GET /providers/keys` · `POST /providers/keys` · `DELETE /providers/keys/:id` · `POST /providers/keys/:id/test` — **không bao giờ trả key gốc**.
  - `apps/server/src/app.ts` · `src/index.ts` · `src/config/env.ts` — mount `providersRouter` tại `/api` · env `OLLAMA_BASE_URL` · `OLLAMA_MODEL`.
  - `apps/extension/src/lib/onboarding.ts` (mới, thuần) — `ONBOARDING_COMPLETED_KEY` · `PREFERRED_PROVIDER_KEY` · `readOnboardingState()` · `completeOnboarding()` · `resetOnboarding()` · `readPreferredProvider()` · `writePreferredProvider()`.
  - `apps/extension/src/lib/providerClient.ts` (mới) — `listProviders()` · `listProviderKeys()` · `saveProviderKey()` · `testProviderKey()` · `deleteProviderKey()`.
  - `apps/extension/src/sidepanel/hooks/useOnboarding.ts` (mới) — đọc/ghi cờ qua `chrome.storage.local` + lắng nghe `storage.onChanged`.
  - `apps/extension/src/sidepanel/components/onboarding/` (mới) — `Onboarding.tsx` (orchestrator 3 bước) · `StepPermissions.tsx` (giải thích quyền) · `StepProvider.tsx` (chọn provider + nhập API key) · `StepTry.tsx` (thử câu hỏi qua SSE thật).
  - `apps/extension/src/sidepanel/components/PanelHeader.tsx` — nút "Hướng dẫn" (`CircleHelp`) → mở lại onboarding.
  - **Test** — `packages/shared/tests/onboarding.test.ts` (mới) · `apps/server/tests/ollamaProvider.test.ts` (mới) · `apps/server/tests/providerService.test.ts` (mới) · `apps/server/tests/providersRoute.test.ts` (mới) · `apps/server/tests/helpers/fakeProviderKeyDb.ts` (mới) · `apps/server/tests/chatService.test.ts` (+preferred-first) · `apps/extension/tests/onboarding.test.ts` (mới) · `apps/extension/tests/providerClient.test.ts` (mới) · `apps/extension/tests/onboardingUi.test.tsx` (mới) · `apps/extension/e2e/onboarding.spec.ts` (mới, 6 kịch bản) · `apps/extension/e2e/fixtures.ts` (sửa: seed `sidekick.onboarding.completed` ở context level + fixture `sidePanelFresh`).
  - **Số test toàn repo:** 547 → **646 unit** (shared 123 · server 214 · extension 309) + 23 → **29 E2E**.
  - **Mutation spot-check:** 4/4 mutation bị bắt — Ollama `requiresKey` → `true` (2 test fail) · `maskKey` trả 8 ký tự (7 test fail) · bỏ ghi `completed` khi bấm "Bỏ qua" (3 test fail) · bỏ `preferredProvider` khỏi chain (1 test fail).

### Changed
- `apps/server/src/services/chatService.ts` — `request.provider` giờ **đặt đầu** chuỗi provider rồi nối tiếp fallback chain (trước đó nó *thay* chain → mất fallback, vi phạm FR-PROVIDER-04). Không có `request.provider` → hành vi không đổi.
- `apps/extension/src/sidepanel/App.tsx` — tách 2 tầng: `App.tsx` chọn giữa `<Onboarding />` và `<ChatWorkspace />`; nội dung chat chuyển nguyên trạng sang `sidepanel/ChatWorkspace.tsx`.
- `apps/server/src/providers/ollama.ts` — `supportsVision()` theo tiền tố model (`llama3.2-vision` · `llava` · `bakllava` · `qwen2-vl` · `qwen2.5-vl` · `minicpm-v` · `moondream` · `gemma3`) thay vì `false`.
- **Docs** — `REQUIREMENTS.md` §4.9.1 (AC chi tiết FR-UX-02) · `SYSTEM_DESIGN.md` §4.1 (5 endpoint provider) · §4.4.1 (preferred-first) · §4.4.2 (Ollama) · §7.6 (hợp đồng onboarding) · `DESIGN_SYSTEM_BRIEF.md` §3.8 (component onboarding + a11y) · `IMPLEMENTATION_PLAN.md` §3.1h (kết quả T-M1-25) · `COMPARISON_MATRIX.md` §E (tick onboarding + no-login) · `EVAL_PLAN.md` §4.2.1 (onboarding nằm ngoài rubric eval) · `AGENTS.md` + `docs/README.md` (cập nhật số task/test, việc tiếp theo).

### Fixed
- `apps/extension/src/sidepanel/components/onboarding/StepPermissions.tsx` — sửa lỗi lint `no-useless-assignment` (khởi tạo `id` trước `try`).

### Added
- **T-M1-24 — Upload ảnh & vision input (FR-VISION-01)**
  - `packages/shared/src/schemas/vision.ts` (mới) — `IMAGE_MIME_TYPES` (`image/png` · `jpeg` · `webp` · `gif`) · `MAX_IMAGE_BASE64_CHARS` · `imageAttachmentSchema` (id uuid · mimeType · data base64 thuan · bytes · width/height · fileName) · `providerImageSchema` · `imageAttachmentListSchema` (≤ 4 ảnh + tổng ≤ 12 MB).
  - `packages/shared/src/constants.ts` — `VISION` (MAX_IMAGE_BYTES 5 MB · MAX_IMAGES_PER_MESSAGE 4 · MAX_TOTAL_IMAGE_BYTES 12 MB · **ALLOWED_MIME_TYPES** · TOKEN_ESTIMATE_PER_IMAGE 258) + `VISION_MIME_TYPES` (tuple nguồn sự thật, tránh vòng import với `schemas/vision.ts`) · `API_ROUTES.attachment = '/api/attachments'`.
  - `packages/shared/src/schemas/chat.ts` — `chatTurnSchema.attachments` (ảnh là **đầu vào trực tiếp**, không phải `ContextItem` → không phụ thuộc toggle `contextEnabled`).
  - `packages/shared/src/schemas/provider.ts` — `providerStreamRequestSchema.messages[].attachments`.
  - `packages/shared/src/errors.ts` — thêm `VISION_IMAGE_TOO_LARGE` · `VISION_UNSUPPORTED_TYPE` · `VISION_TOO_MANY_IMAGES` · `VISION_TOTAL_TOO_LARGE` · `PROVIDER_VISION_UNSUPPORTED`.
  - `apps/server/src/db/schema.ts` — bảng `message_attachments` (id uuid client-generated · message_id · conversation_id · mime_type · byte_size · `ord` · width · height · file_name · `data` **bytea** · created_at) + relations với `messages` / `conversations`. Drizzle 0.45.4 không có `bytea` sẵn → dùng `customType<{ data: Buffer; driverData: Buffer }>`.
  - `apps/server/drizzle/0001_puzzling_mathemanic.sql` (mới) — migration tạo bảng + FK + index.
  - `apps/server/src/services/attachmentService.ts` (mới) — `decodeBase64Image()` (validate mime + **tính lại byte size thật** từ dữ liệu decode, không tin `bytes` của client) · `toDataUrl()` · `persistAttachments()` · `loadRecentAttachments()` (nạp ảnh của lượt trước → hỗ trợ hỏi tiếp bằng **text-only** ở lượt sau) · `getAttachment()` · `countAttachments()`.
  - `apps/server/src/routes/attachments.ts` (mới) — `GET /api/attachments/:id` trả **binary** ảnh kèm header `Content-Type` đúng mime.
  - `apps/server/src/app.ts` — `express.json({ limit: '16mb' })` (payload base64 của 4 ảnh) + đăng ký `attachmentsRouter`.
  - `apps/server/src/providers/` — `supportsVision()` cho `gemini` (luôn true) · `openaiCompatible` · `groq` (`llama-4-scout` · `llama-3.2-11b/90b-vision`) · `openrouter` (prefix `google/gemini` · `openai/gpt-4o` · `anthropic/claude-3/4`…) · `mock` (echo số ảnh + mime). Payload: Gemini → `parts: [{ text }, { inline_data: { mime_type, data } }]` · OpenAI-compatible → `content: [{ type: 'text' }, { type: 'image_url', image_url: { url: 'data:<mime>;base64,<data>' } }]`.
  - `apps/server/src/services/chatService.ts` — `persistUserMessage()` trả về id · `persistAttachments()` · `mergeImages()` (dedup theo base64, **không** theo id) · fallback chain **bỏ qua provider không hỗ trợ vision** khi lượt có ảnh → hết provider → `PROVIDER_VISION_UNSUPPORTED` · `buildProviderMessages()` **trừ token ảnh** (258/ảnh) khỏi `historyBudget` **trước** khi `trimHistory()`.
  - `apps/extension/src/lib/imageUpload.ts` (mới, thuần) — validate mime + 5 MB/ảnh + 12 MB tổng · đọc file → base64 qua `FileReader` · parse `DataTransfer` (paste + drop) · **`measureImage()`** (đo kích thước pixel: `createImageBitmap` → fallback `Image` → `undefined`, **không throw**) · **`extractImagesFromClipboard()`** / **`extractImagesFromDrop()`** · `formatBytes()`.
  - `apps/extension/src/sidepanel/hooks/useImageAttachments.ts` (mới) — state ảnh chờ gửi · đọc file · báo lỗi theo error code chuẩn · `removeImage()` / `clearImages()` / `clearError()`.
  - `apps/extension/src/sidepanel/components/composer/AttachmentTray.tsx` (mới) — thumbnail preview từng ảnh + nút xoá (`aria-label` tiếng Việt) + cảnh báo lỗi + ước lượng token.
  - `apps/extension/src/sidepanel/components/Composer.tsx` — nút `ImagePlus` mở file picker (`data-testid="composer-file-input"`) · bắt **paste** ảnh · **drag & drop** (`preventDefault()` trên `dragover` + `drop`) · gửi kèm ảnh đã chọn.
  - `apps/extension/src/sidepanel/store/chatStore.ts` + `hooks/useChat.ts` — `pendingImages` trong store · `useChat` chụp **snapshot history trước** khi `addMessage(userMessage)` (tránh lặp turn) · truyền `attachments` trong payload `POST /api/chat`.
  - `apps/extension/src/sidepanel/components/MessageBubble.tsx` + `App.tsx` — render ảnh đính kèm trong tin nhắn user · click để mở tab xem ảnh đầy đủ.
  - **Test** — `packages/shared/tests/vision.test.ts` (mới, 28 test — gồm test **khoá danh sách mime** chống mutation thêm mime mới) · `apps/server/tests/attachmentService.test.ts` (mới) · `apps/server/tests/attachmentsRoute.test.ts` (mới) · `apps/server/tests/visionProviders.test.ts` (mới) · `apps/server/tests/visionContent.test.ts` (mới) · `apps/server/tests/chatService.test.ts` (+vision) · `apps/extension/tests/imageUpload.test.ts` (mới, 23 test — gồm `measureImage` + wrapper clipboard/drop) · `apps/extension/tests/AttachmentTray.test.tsx` (mới) · `apps/extension/tests/useImageAttachments.test.ts` (mới) · `apps/extension/tests/useChat.test.ts` (+vision) · `apps/extension/tests/chatStore.test.ts` (+pendingImages).
  - **E2E** — `apps/extension/e2e/vision.spec.ts` (mới, 5 kịch bản): upload qua file picker → chip/thumbnail hiện → gửi → `messages[].attachments[]` có ảnh → **xoá ảnh** khỏi tray → request không còn attachments → `GET /api/attachments/:id` trả binary đúng `Content-Type` → file sai định dạng → hiện lỗi, không gửi ảnh.
  - **Số test toàn repo:** 419 → **547 unit** (shared 103 · server 166 · extension 278) + 18 → **23 E2E**.
  - **Mutation re-check:** 5/5 mutation bị bắt — bỏ `supportsVision()` ở Gemini (test fail) · đổi dedup `mergeImages()` từ base64 sang `id` (test fail) · bỏ trừ token ảnh khỏi `historyBudget` (test fail) · bỏ `measureImage()` trả `undefined` (test fail) · **thêm `image/bmp` vào danh sách mime (test fail sau khi bổ sung test khoá allowlist)**.
- **T-M1-02 — Selection context: bôi đen → hỏi (FR-CONTEXT-04)**
  - `packages/shared/src/constants.ts` — thêm `LIMITS.MAX_SELECTION_CHARS` (10 000) · `LIMITS.MIN_SELECTION_CHARS` (10) · `SELECTION_PENDING_TTL_MS` (300 000).
  - `apps/extension/src/content/selection.ts` (mới) — **thuần** (không `chrome.*`, test được trong jsdom): `readSelectionFromDocument()` · `normalizeSelectionText()` (gộp whitespace, bỏ ký tự điều khiển, cắt tại ranh giới từ, **không** cắt giữa surrogate pair) · `isMeaningfulSelection()` · `selectionAnchorRect()` (neo dưới vùng chọn → chuyển lên trên khi tràn viewport, clamp toạ độ).
  - `apps/extension/src/content/selectionWatcher.ts` (mới) — nghe `mouseup` + `keyup` (Shift/⌘A) → debounce 120 ms → hiện nút nổi; `selectionchange` rỗng hoặc `scroll` → ẩn nút; không hiện khi selection < 10 ký tự.
  - `apps/extension/src/content/selectionButton.ts` (mới) — nút nổi "Hỏi Sidekick" trong `attachShadow({ mode: 'open' })` (CSS trang host không ghi đè được) · `position: fixed` · `z-index: 2147483647` · `data-testid="selection-affordance"` · icon SVG viết tay (không kéo `lucide-react` vào content script).
  - `apps/extension/src/content/selectionStyles.ts` (mới) — CSS shadow root **sinh từ `design/tokens.json`** + biến thể `prefers-color-scheme: dark` → **không** hardcode màu.
  - `apps/extension/src/lib/selectionProtocol.ts` (mới) — `SELECTION_ACTION` (`sidekick:selection`) · `PendingSelection` · `isSelectionMessage()` (type guard thuần, **không** kéo `zod` vào content script) · `selectionItemId()` (hash FNV-1a) · `SELECTION_EMPTY_ERROR_CODE`.
  - `apps/extension/src/lib/selectionBridge.ts` (mới) — `handleSelectionMessage()`: ghi `chrome.storage.local` **trước**, rồi **thử** `chrome.sidePanel.open({ windowId })` bọc `try/catch` (Chrome từ chối vì mất user gesture → im lặng) → cơ chế **open-with-fallback**.
  - `apps/extension/src/lib/storage.ts` — thêm `PENDING_SELECTION_STORAGE_KEY` (`sidekick.pendingSelection`) · `writePendingSelection()` · `readPendingSelection()` (bỏ qua + xoá nếu quá TTL) · `consumePendingSelection()` · `clearPendingSelection()`.
  - `apps/extension/src/lib/contextAttach.ts` — thêm `attachSelection()` → `ContextItem { kind: 'selection', tier: 'selection', id: 'selection-<hash>' }` (bôi đen lại cùng đoạn → **thay** item cũ, không nhân bản) + `captureActiveSelection()` → `chrome.scripting.executeScript` (lỗi / trang nội bộ → `undefined`, không throw).
  - `apps/extension/src/background/serviceWorker.ts` — `chrome.runtime.onMessage` → `handleRuntimeMessage()`; không giữ state lâu dài, không proxy streaming.
  - `apps/extension/src/content/contentScript.ts` — khởi động watcher · click nút nổi → `chrome.runtime.sendMessage({ action: 'sidekick:selection' })` · expose `window.__sidekickGetSelection()` cho đường B; **giữ nguyên** `EXTRACT_CONTENT_ACTION` + `__sidekickExtractContent` (không regression T-M1-01).
  - `apps/extension/src/sidepanel/hooks/useSelection.ts` (mới) — consume pending selection khi **mount** + khi `chrome.storage.onChanged` bắn · bỏ qua payload quá TTL · `onAttach` giữ trong `ref` (không chạy lại effect mỗi render).
  - `apps/extension/src/sidepanel/hooks/useChat.ts` — thêm `attachSelection()` (đường A) + `attachActiveSelection()` (đường B) → `attachItem()` + `setContextError()` khi rỗng.
  - `apps/extension/src/sidepanel/components/context/ContextChips.tsx` — thêm nút "Dính đoạn đã chọn" (icon `MousePointer2`, `data-testid="context-add-selection"`), disabled khi `isAttaching`.
  - `apps/extension/src/sidepanel/App.tsx` — dùng `useSelection()` + truyền `onAttachSelection` xuống `ContextChips`.
  - `apps/extension/src/sidepanel/components/context/ContextNotice.tsx` — thêm case `CONTEXT_SELECTION_EMPTY`.
  - `apps/extension/src/types/globals.d.ts` — khai báo `__sidekickGetSelection`.
  - **Test** — `apps/extension/tests/selection.test.ts` (mới, 23 test) · `apps/extension/tests/selectionProtocol.test.ts` (mới, 13 test) · `apps/extension/tests/selectionWatcher.test.ts` (mới, 8 test) · `apps/extension/tests/selectionBridge.test.ts` (mới, 11 test) · `apps/extension/tests/useSelection.test.ts` (mới, 8 test) · `apps/extension/tests/contextAttach.test.ts` (+12 test) · `apps/extension/tests/storage.test.ts` (+11 test) · `apps/extension/tests/setup.ts` (bổ sung mock `chrome.storage.onChanged` / `chrome.sidePanel.open` / `chrome.scripting.executeScript`).
  - **E2E** — `apps/extension/e2e/selection.spec.ts` (mới, 5 kịch bản): (1) bôi đen trên trang thật → nút nổi xuất hiện → click → SW lưu `sidekick.pendingSelection`; (2) panel đang mở → click nút nổi → chip `data-tier="selection"`; (3) đường B → nút "Dính đoạn đã chọn" → chip; (4) gửi câu hỏi → `context.items[0].tier === 'selection'`; (5) thứ tự ưu tiên — selection đứng trước tab (`CONTEXT_TIER_ORDER`).
  - **Số test toàn repo:** 332 → **419 unit** (shared 75 · server 126 · extension 218) + 13 → **18 E2E**.
  - **Mutation re-check:** 5/5 mutation bị bắt — bỏ guard `MIN_SELECTION_CHARS` (7 test fail) · bỏ lọc TTL (2 test fail) · đổi `tier: 'selection'` → `'attachment'` (2 test fail) · bỏ guard độ dài trong `captureActiveSelection` (1 test fail) · đảo thuật toán neo nút nổi (1 test fail).

### Changed
- `docs/REQUIREMENTS.md` — FR-VISION-01 ghi rõ hành vi đã implement (upload → preview → gửi inline → lưu Postgres → multi-turn) + giới hạn định dạng/kích thước.
- `docs/SYSTEM_DESIGN.md` — thêm §7.4 "Vision input (T-M1-24)" (contract · bảng `message_attachments` · luồng provider theo loại · fallback chain · route `GET /api/attachments/:id`).
- `docs/DESIGN_SYSTEM_BRIEF.md` — thêm spec `AttachmentTray` (vị trí · thumbnail · nút xoá · cảnh báo lỗi · ước lượng token).
- `docs/IMPLEMENTATION_PLAN.md` — T-M1-24 ✅ · §3.1g kết quả verify.
- `docs/COMPARISON_MATRIX.md` — tick dòng "Upload ảnh kèm câu hỏi" (đối chiếu B17) · `docs/EVAL_PLAN.md` — nhóm `vision` tách đường upload vs ảnh trong DOM + ghi rõ ràng buộc provider.
- `AGENTS.md` — M1: 8/25 task · 547 unit test + 23 E2E · việc tiếp theo → T-M1-25.
- `docs/REQUIREMENTS.md` — FR-CONTEXT-04 ghi rõ 2 đường tương tác + cơ chế fallback.
- `docs/SYSTEM_DESIGN.md` — thêm §7.3.4 "Selection context (T-M1-02)".
- `docs/DESIGN_SYSTEM_BRIEF.md` — thêm §3.5 "Selection affordance"; các mục sau đổi số thứ tự (§3.6 Overlays, §3.7 Settings).
- `docs/IMPLEMENTATION_PLAN.md` — T-M1-02 ✅ · thêm §3.1f kết quả verify.
- `docs/COMPARISON_MATRIX.md` — tick dòng "Bôi đen → hỏi (selection context)" (T-M1-02) + ghi chú T-M1-02 ở bảng so sánh.
- `AGENTS.md` — M1: 7/25 task · 419 unit test + 18 E2E · việc tiếp theo → T-M1-24.

### Fixed
- `apps/server/vitest.config.ts` — thêm `testTimeout: 30_000`: `pdfExtractor.test.ts` timeout giả khi 12 worker Vitest chạy song song (đây là tải máy, không phải lỗi logic — test pass khi chạy riêng).

### Docs
- `docs/REQUIREMENTS.md` §4.2 — FR-CONTEXT-04 ghi rõ hành vi đã implement · §11.1 — T-M1-02 ✅.
- `docs/SYSTEM_DESIGN.md` §7.3.4 (mới) — thiết kế selection context (mermaid + cơ chế open-with-fallback + bảng file liên quan + ràng buộc MV3 + bảng quy tắc hành vi) · §7.4 — ghi rõ `dist/content.js` 13.9 kB vẫn IIFE 1 file.
- `docs/DESIGN_SYSTEM_BRIEF.md` §3.5 (mới) — spec `SelectionAffordance` (vị trí · cô lập Shadow DOM · token sinh từ `tokens.json` · a11y · điều kiện hiện).
- `docs/IMPLEMENTATION_PLAN.md` §3 — T-M1-02 ✅ · §3.1f (mới) — bảng verify Phần A–D + verify + mutation · §3.2 traceability FR-CONTEXT-04.
- `docs/COMPARISON_MATRIX.md` §E — tick dòng "Bôi đen → hỏi (selection context)" (T-M1-02) · bảng §D — cột Sidekick ghi `(T-M1-02)`.
- `docs/HANDOFF.md` — cập nhật trạng thái T-M1-02 + quyết định kỹ thuật mới.

- **T-M1-05 — `@`-mention multi-tab (FR-CONTEXT-03)**
  - `apps/extension/src/lib/tabList.ts` (mới) — `listOpenTabs(limit = 20)` liệt kê tab đang mở qua `chrome.tabs.query({ currentWindow: true })` (chỉ cửa sổ hiện tại → không lộ tab cửa sổ khác), lọc trang nội bộ (`detectPageKind() === 'unknown'` → `chrome://` / `file://` / Web Store), `domainOf()` bỏ `www.`; **không bao giờ throw** (lỗi → `[]`).
  - `apps/extension/src/sidepanel/hooks/useTabs.ts` (mới) — `useTabs(enabled)` nạp danh sách tab **lazy** (chỉ khi popover mở) + `reload()`.
  - `apps/extension/src/sidepanel/hooks/useMention.ts` (mới) — `findMention()` (thuần, dễ test): token `@` chỉ hợp lệ khi ở đầu chuỗi hoặc sau khoảng trắng → `@` trong email (`a@b.com`) **không** bật popover; `useMention()` quản lý state mở/đóng + `apply()` chèn `@tên tab ` + cơ chế "đóng token" sau `Escape` (trình duyệt bắn `select` event sau khi thoát ô nhập → popover không mở lại).
  - `apps/extension/src/sidepanel/components/context/MentionPopover.tsx` (mới) — overlay nổi `absolute bottom-full` bám trên `Composer`: favicon (fallback `Globe`) · title · domain · dấu `Check` (tab đã đính kèm) · gạch `--color-accent` (tab đang active) · trạng thái loading / rỗng · `role="listbox"` + `role="option"` + `aria-selected` + `aria-label` tiếng Việt.
  - `apps/extension/src/lib/contextAttach.ts` — thêm `attachTab(tabId, existingItems)` (bọc `captureTabContext()` thành `ContextItem { id: 'tab-N', kind: 'tab', tier: 'attachment' }`) + `tabItemId()`; tab đã đính kèm → **không capture lại**; không throw.
  - `apps/extension/src/sidepanel/hooks/useChat.ts` — thêm `attachTab(tabId)` (cầu nối store ↔ `contextAttach`).
  - `apps/extension/src/sidepanel/components/Composer.tsx` — thêm `onCursorChange` · `onEscape` · `inputRef` (cần cho phát hiện token `@` + đưa con trỏ về đúng chỗ sau khi chèn).
  - `apps/extension/src/sidepanel/App.tsx` — lọc tab theo query (title/domain/URL) · chèn `@tên tab` vào textarea · đính kèm tab đã chọn · highlight tab active.
  - **Test** — `apps/extension/tests/tabList.test.ts` (mới, 11 test) · `apps/extension/tests/useMention.test.ts` (mới, 11 test) · `apps/extension/tests/useTabs.test.ts` (mới, 5 test) · `apps/extension/tests/MentionPopover.test.tsx` (mới, 7 test) · `apps/extension/tests/contextAttach.test.ts` (mới, 8 test) · `apps/extension/tests/useChat.test.ts` (+3 test `attachTab`).
  - **E2E** — `apps/extension/e2e/mention.spec.ts` (mới, 4 kịch bản): (1) gõ `@` → popover hiện danh sách tab; (2) chọn tab → chip context hiện + `@tên tab` trong textarea + `context.items[0].tier === 'attachment'`; (3) lọc tab theo chuỗi đã gõ; (4) `Escape` → đóng popover.
- **Đóng 8 blind spot test (mutation audit vòng 2 — chi tiết `docs/SYSTEM_DESIGN.md` §7.2.2)**
  - `apps/extension/tests/storage.test.ts` (mới, 10 test) — `readContextEnabled()` / `writeContextEnabled()`: mặc định `false` · đọc/ghi đúng key `sidekick.contextEnabled` · giá trị không phải `true` → `false` · storage lỗi → **không throw**.
  - `apps/extension/tests/extractor.test.ts` (+6 test) — fixture fallback **thật** (mọi block < `MIN_BLOCK_LENGTH` → rơi vào nhánh `doc.body`) · dedup `<blockquote><p>` (kích hoạt `if (nested) continue`) · `NEGATIVE_PATTERN` **bên trong** node được chọn (`.ad-banner` / `.comment`) · 3 fixture biên (chỉ `<title>` · chỉ `<h1>` · link-density cao).
  - `packages/shared/tests/contextBudget.test.ts` (+4 test) — assert **phần đầu được giữ lại** sau khi cắt (head slice) — phân biệt được cắt đầu vs cắt cuối · đúng số ký tự = token còn lại × `CHARS_PER_TOKEN` · item không bị cắt → `truncated: false`.
  - `packages/shared/tests/chatSchema.test.ts` (+11 test) — `role` sai / thiếu · messages rỗng · vượt & bằng đúng `MAX_HISTORY_MESSAGES` · `describe('contextItemSchema')`: `id` rỗng / thiếu · `kind` sai · `tier` sai · `title` quá dài · `tabId` không phải số nguyên.
  - `apps/server/tests/chatService.test.ts` (mới, 14 test) — thứ tự event `meta → token → done` · `usage` event · provider lỗi → `error` event + `finishReason: 'error'` · thiếu key → `MISSING_API_KEY` · fallback chain sang provider kế tiếp · `abort` → `finishReason: 'aborted'` · `buildProviderMessages()` (system prompt · context gắn cuối · không context → không thêm) · `buildContextPrompt()` (sort theo tier · nhãn nguồn) · `hashText()`.
  - `apps/server/tests/openaiCompatible.test.ts` (mới, 13 test) — parse SSE thành token chunk · đọc `usage` · `401` → **không** fallback · `404` / `429` / `500` → fallback model kế tiếp · hết model → error cuối · model trong body request khi fallback · `Authorization` header · `error` trong SSE payload · JSON hỏng bị bỏ qua · `resolveModel()` · `listModels()` fallback.
  - **Số test toàn repo:** 235 → **332 unit** (shared 75 · server 126 · extension 131) + 9 → **13 E2E**.

### Fixed
- `apps/server/vitest.config.ts` — thêm `testTimeout: 30_000`: `pdfExtractor.test.ts` timeout giả khi 12 worker Vitest chạy song song (đây là tải máy, không phải lỗi logic — test pass khi chạy riêng).

### Docs
- `docs/REQUIREMENTS.md` §4.2 — FR-CONTEXT-03 ghi rõ hành vi đã implement · §11.1 — T-M1-05 ✅.
- `docs/SYSTEM_DESIGN.md` §7.3.3 (mới) — thiết kế `@` multi-tab (mermaid + quy tắc phát hiện token + bảng file liên quan + ràng buộc MV3) · §7.2.1 — số test 235 → 332 / 9 → 13 · §7.2.2 — vòng 2 mutation audit + bảng 8 blind spot đã fix + bảng 5 mutation re-check.
- `docs/DESIGN_SYSTEM_BRIEF.md` §3.4 — spec `MentionPopover` (vị trí · kích hoạt · nội dung · token · a11y).
- `docs/IMPLEMENTATION_PLAN.md` §3 — T-M1-05 ✅ · §3.1e (mới) — bảng verify Phần A + Phần B · §3.2 traceability FR-CONTEXT-03.
- `docs/COMPARISON_MATRIX.md` §E — tick dòng "`@` đính kèm tab (nhiều tab)" (T-M1-05).

### Added
- **Audit chất lượng test + sửa hạ tầng test (`@sidekick/shared` resolve từ source)**
  - `apps/extension/vitest.config.ts` · `apps/server/vitest.config.ts` · `apps/eval/vitest.config.ts` (mới) — alias `@sidekick/shared` → `packages/shared/src/index.ts` + subpath `@sidekick/shared/constants` → `packages/shared/src/constants.ts`. Subpath khai báo **trước** alias chung để không bị che.
  - `apps/extension/tests/sharedAlias.test.ts` · `apps/server/tests/sharedAlias.test.ts` (mới, 3 test mỗi file) — guard chống regression: alias tồn tại · trỏ đúng `packages/shared/src` · `@sidekick/shared` resolve về **cùng instance module** với import source trực tiếp (alias bị xoá → 2 instance khác nhau → test fail).
  - `package.json` (root) — `pretest` · `pretest:coverage` · `pretest:e2e` · `pretypecheck` · `prebuild` · `predev` build `packages/shared` trước; `dev:shared` (`tsc -p tsconfig.build.json --watch`) chạy song song với `dev:ext` + `dev:server` trong `pnpm dev`.
  - **Số test toàn repo:** 229 → **235 unit** (shared 59 · server 99 · extension 77) + **9 E2E**.
- **T-M1-23 — Ngân sách context & cắt bớt thông minh (FR-CONTEXT-07) + mô hình "đính kèm chủ động" (FR-CONTEXT-13)**
  - `packages/shared/src/contextBudget.ts` (mới) — `estimateTokens()` (`ceil(chars/4)` — heuristic, ghi rõ là xấp xỉ) · `applyContextBudget()` (cấp phát theo tier `selection` → `attachment` → `currentTab`, item vượt chỗ bị **cắt đầu** + `truncated` + `droppedChars`, trả `{ items, usedTokens, maxTokens, historyBudget, droppedItems }`) · `trimHistory()` (giữ lượt mới nhất trước, **luôn giữ** lượt user cuối cùng).
  - `packages/shared/src/schemas/chat.ts` — `contextItemSchema` (`id`/`kind`/`tier`/`url?`/`title`/`text?`/`excerpt?`/`sourceKind?`/`tabId?`) · `contextBundleSchema` (`{ items }`, max 20) · `normalizeContext()` — `chatRequestSchema.context` dùng `z.preprocess(normalizeContext, …)` nên **nhận cả** shape mới `{ items }` lẫn shape cũ phẳng `{ url, title, text }` (→ bọc thành `items[0]` tier `currentTab`) → backward compatible cho eval harness / client cũ.
  - `packages/shared/src/constants.ts` — `CONTEXT_WINDOWS` (gemini 1 000 000 · groq/openrouter 128 000 · ollama 32 000 · mock 8 000) · `CONTEXT_SAFETY_MARGIN_TOKENS = 2_000` · `MAX_CONTEXT_ITEMS = 20`.
  - `apps/server/src/services/chatService.ts` — `buildContextPrompt(context)` render từng item theo tier với nhãn nguồn rõ ràng (`[Đã bôi đen]` · `[Tab đính kèm]` · `[File đính kèm]` · `[Trang hiện tại]`) · `buildProviderMessages()` áp `applyContextBudget()` + `trimHistory()` → **server cắt lại lần nữa** (nguồn chân lý, client có thể gửi bản siêu lớn).
  - `apps/extension/src/lib/contextAttach.ts` (mới) — `attachCurrentTab()` bọc `captureTabContext()` (giữ nguyên 3 nhánh html/pdf/youtube của T-M1-01/21/22 → không regression) thành `ContextItem` tier `attachment`; **không bao giờ throw** (lỗi trả qua `error`/`errorMessage`); tab đã đính kèm → không capture lại.
  - `apps/extension/src/lib/storage.ts` (mới) — `readContextEnabled()` / `writeContextEnabled()` — persist toggle ở `chrome.storage.local` key `sidekick.contextEnabled`; mọi lỗi bị nuốt (storage không truy cập được → dùng giá trị mặc định).
  - `apps/extension/src/sidepanel/store/chatStore.ts` — thêm `attachedItems: ContextItem[]` · `contextEnabled: boolean` (mặc định **false**) · `budget: ContextBudgetResult | undefined` + actions `attachItem` · `removeItem` · `clearAttachedItems` · `setContextEnabled` · `hydrateContextEnabled` · `recomputeBudget`. `reset()` giữ nguyên context đã đính kèm (clear cuộc trò chuyện không xoá nguồn context của user).
  - `apps/extension/src/sidepanel/hooks/useChat.ts` — **bỏ** `captureActiveContext()` (tự capture tab active mỗi lượt) → thay bằng `buildRequestContext()`: `contextEnabled === false` hoặc không có item → **không gửi payload `context`** (chat thuần LLM) ; ngược lại → `applyContextBudget()` rồi gửi `context.items`. Bổ sung `attachCurrentTab()` (user chủ động đính kèm) + hydrate toggle từ storage.
  - `apps/extension/src/sidepanel/components/context/ContextChips.tsx` (mới) — chip từng item đã đính kèm (icon theo `kind`: `MousePointer`/`Globe`/`FileText` + title + nút xoá có `aria-label` tiếng Việt) · chip toggle `role="switch"` · nút "Thêm trang này". *(T-M1-04 được hấp thụ)*
  - `apps/extension/src/sidepanel/components/context/ContextBudget.tsx` (mới) — meter "Đã dùng X / Y token" · màu theo ngưỡng `< 70%` `--success` · `70–90%` `--warning` · `> 90%` `--danger` · dòng phụ "N nguồn bị cắt khỏi context" · `role="status"` + `aria-live="polite"`.
  - `apps/extension/src/sidepanel/App.tsx` — mount `ContextChips` + `ContextBudget` phía trên `Composer`; `ContextNotice` giữ nguyên.
  - **Test** — `packages/shared/tests/contextBudget.test.ts` (mới) · `packages/shared/tests/chatSchema.test.ts` (mở rộng: 2 shape context) · `apps/server/tests/contextPrompt.test.ts` (mở rộng: render nhiều item theo tier · server tự cắt lại · `trimHistory`) · `apps/extension/tests/contextAttach.test.ts` (mới, 6 test) · `apps/extension/tests/chatStore.test.ts` (+8 test context) · `apps/extension/tests/useChat.test.ts` (3 test context viết lại).
  - **E2E** — `apps/extension/e2e/context.spec.ts` (mới, 4 kịch bản): (1) không đính kèm → request **không** có `context`; (2) bấm "Thêm trang này" → chip hiện + `context.items[0].tier === 'attachment'`; (3) meter hiện "… / … token"; (4) tắt toggle → request lại không có `context`. `apps/extension/e2e/extract.spec.ts` cập nhật: phải bấm "Thêm trang này" trước khi trích xuất (context không còn tự capture mỗi lượt).
  - **Số test toàn repo:** **229 unit** (shared 59 · server 96 · extension 74) + **9 E2E**.

### Changed
- **Hành vi sản phẩm (T-M1-23):** context **không còn tự động** gửi tab active ở mọi lượt chat → chuyển sang mô hình "**chỉ những gì user chủ động đính kèm**". Không đính kèm gì (hoặc toggle TẮT) → request gửi prompt trần → chat hoạt động như LLM thuần. Đính kèm (nút "Thêm trang này" · `@` · bôi đen · upload file) → item vào `context.items[]` với `tier` ưu tiên. Toggle mặc định **TẮT**; đính kèm item tự bật toggle (user vừa yêu cầu dùng context) nhưng vẫn tắt được bằng tay.
  - `docs/REQUIREMENTS.md` §4.2 — sửa FR-CONTEXT-02 · **thêm FR-CONTEXT-13** (chat không cần context) · §3 thêm **US-16** · §11.1 map FR-CONTEXT-13 → T-M1-23 · ghi chú FR-CONTEXT-11 (chỉ hỗ trợ một phần bởi `trimHistory`).
  - `docs/SYSTEM_DESIGN.md` §4.2.1 (mới) — hợp đồng `context` bundle + item + tier + quy tắc backward compatible · §7.3.2 (mới) — mô hình attach + ngân sách token theo provider + 2 tầng client/server · §3 (cây thư mục).
  - `docs/IMPLEMENTATION_PLAN.md` §3 — T-M1-23 ✅ · T-M1-04 ✅ (hấp thụ) · §3.1c (mới) bảng verify T-M1-23 · §3.2 traceability FR-CONTEXT-01..13.
  - `docs/COMPARISON_MATRIX.md` §D — dòng "Context trang" ghi rõ Sidekick dùng cơ chế **đính kèm chủ động** (Edge/Gemini mặc định share tab) + ghi chú khác biệt + §E tick 3 dòng.
  - `docs/EVAL_PLAN.md` §3.2 — nhóm task mới `general_qa` (chat không cần context, ≥ 4 task) · tổng ≥ 52 task · §9 thêm **FC-12** (trạng thái context giống nhau) + ghi chú công bằng về cơ chế context.
  - `docs/DESIGN_SYSTEM_BRIEF.md` §3.4 — spec chi tiết `ContextChips` + `ContextBudget` (vị trí · token · a11y) · §4 thêm trạng thái "không đính kèm gì".
  - `AGENTS.md` §6 + `docs/README.md` — số task M1 (3/25 → **5/25**) · số unit test (187 → **229**) · task kế tiếp.

### Changed
- **Test của extension/server/eval giờ chạy trên SOURCE của `packages/shared`, không phải bản build trong `dist/`.**
  - Trước: `@sidekick/shared` resolve qua `package.json` `exports` → `packages/shared/dist/`. Sửa `packages/shared/src` mà quên `pnpm build` → test **chạy code cũ và vẫn xanh** (chứng minh: inject `throw` vào `packages/shared/src/contextBudget.ts` → test extension vẫn PASS 16/16).
  - Sau: inject cùng trên → test **FAIL** đúng chỗ (`packages/shared/src/contextBudget.ts:26`).
- **Fresh clone (`packages/shared/dist` bị `.gitignore`) giờ chạy được** `pnpm test` · `pnpm typecheck` · `pnpm build` · `pnpm dev` — tự build shared trước (trước đây fail với `Cannot find module "@sidekick/shared"`).
- `apps/extension/src/sidepanel/hooks/useChat.ts` — bỏ import `ChatRequest` không dùng (lint error tồn đọng).
- `apps/extension/e2e/context.spec.ts` — thay `import('@playwright/test').Page` bằng type-only import `import { type Page }` (lint error tồn đọng).

### Fixed
- **Rủi ro "test xanh nhưng code sai"** — test extension/server trước đây resolve `@sidekick/shared` từ `dist` (bản build cũ) → sửa source mà quên build là test vẫn xanh. Đã sửa bằng alias + guard test.
- **Fresh clone không chạy được test** — `packages/shared/dist` không có sẵn → `pnpm test` fail. Đã sửa bằng `pre` hooks.
- 3 lỗi ESLint tồn đọng (`no-unused-vars` cho `ChatRequest` · 2 lỗi `consistent-type-imports` trong `e2e/context.spec.ts`) → `pnpm lint` giờ sạch.
- Số liệu meter "đã dùng X/Y token" không lệch với cái thực sự gửi đi: extension và server dùng **cùng** hàm `applyContextBudget()` từ `@sidekick/shared`.

### Docs
- `docs/SYSTEM_DESIGN.md` §7.1.1 (mới — nguyên tắc "test phải chạy trên source" + 3 hệ quả + cách sửa + guard) · §7.2.1 (mới — số test hiện tại) · §7.2.2 (mới — kết quả mutation audit + 8 blind spot + mức độ thực tế từng tầng test) · §3 (cây thư mục) · `docs/HANDOFF.md` (trạng thái + quyết định kỹ thuật) · `docs/CHANGELOG.md`.
- `docs/REQUIREMENTS.md` · `docs/SYSTEM_DESIGN.md` · `docs/IMPLEMENTATION_PLAN.md` · `docs/COMPARISON_MATRIX.md` · `docs/EVAL_PLAN.md` · `docs/DESIGN_SYSTEM_BRIEF.md` · `docs/CHANGELOG.md` · `docs/HANDOFF.md` · `AGENTS.md` · `docs/README.md` — đồng bộ theo T-M1-23.

- **T-M1-21 / T-M1-22 — Hoàn thiện theo plan: chặn hostname nội bộ + fallback `ytInitialPlayerResponse` + `pageKindSchema`**
  - `apps/server/src/lib/safeFetch.ts` — chặn thêm hostname nội bộ trước khi DNS resolve: `localhost` · `localhost.localdomain` · `*.local` · `*.internal` · `*.localdomain` (một số host nội bộ không resolve được hoặc resolve ra IP công cộng nhưng vẫn chỉ tới dịch vụ trong Docker network).
  - `apps/server/src/lib/youtubeExtractor.ts` — **2 tầng dự phòng** thay vì 1 tầng: tầng 1 InnerTube (`youtubei/v1/player`, client `ANDROID`) → tầng 2 parse `ytInitialPlayerResponse` nhúng trong HTML watch page (dùng bộ đếm ngoặc có nhận biết chuỗi/escape, không dùng regex) → hết cả 2 → `CONTEXT_TRANSCRIPT_UNAVAILABLE`. Hàm `resolvePlayerResponse()` chỉ nhảy sang tầng 2 khi lỗi là lỗi mạng/parse (`CONTEXT_EXTRACT_FAILED`), lỗi nghiệp vụ vẫn trả thẳng.
  - `packages/shared/src/schemas/extract.ts` — thêm `pageKindSchema` (`z.enum(PAGE_KINDS)`) để validate `sourceKind` từ client.
  - **Test** — `apps/server/tests/safeFetch.test.ts` (+3: chặn `localhost` / `*.internal` / `*.local`) · `apps/server/tests/youtubeExtractor.test.ts` (+3: fallback khi InnerTube 502 · fallback khi watch page không có API key · cả 2 tầng hỏng → `CONTEXT_TRANSCRIPT_UNAVAILABLE`) · `packages/shared/tests/extractSchema.test.ts` (+2) · `apps/extension/tests/pageKind.test.ts` (file mới, 4 test: quyết định phía client cho 4 loại URL).
  - **Số test toàn repo:** **187 unit** (shared 38 · server 91 · extension 58) + **5 E2E**.
  - **Docs** — `SYSTEM_DESIGN.md` §7.3.1 (chặn hostname nội bộ + 2 tầng dự phòng + `pageKindSchema`) · `IMPLEMENTATION_PLAN.md` §3.1b (bảng verify + số liệu test) · `AGENTS.md` §6 + `docs/README.md` + `docs/HANDOFF.md` (số liệu test).
- **T-M1-21 / T-M1-22 — Nối context PDF & transcript YouTube vào side panel** — 2 nhánh trích xuất mới được dùng trong panel, chuẩn hoá về cùng shape `context.text` với nhánh HTML.
  - `apps/extension/src/lib/extractClient.ts` — `requestExtract(kind, url)` gọi `POST /api/extract/pdf` hoặc `POST /api/extract/youtube` qua `fetchJson` sẵn có; **không bao giờ throw** → lỗi thành `{ error, errorMessage }`.
  - `apps/extension/src/lib/pageContext.ts` — `captureTabContext()` phân nhánh theo `detectPageKind(url)`: `html` → content script (giữ nguyên hành vi T-M1-01) · `pdf`/`youtube` → BFF (merge `text`/`excerpt`/`title`) · `unknown` (`chrome://`, `file://`) → context tối thiểu, không gọi mạng. Lỗi → set `sourceKind` + `contextError` + `contextErrorMessage`.
  - `apps/extension/src/sidepanel/components/context/ContextNotice.tsx` — banner lỗi trích xuất nằm ngay trên Composer: PDF scan → "PDF này là bản scan — hãy tải lên ảnh" · video không caption → "Video này không có phụ đề" · lỗi khác → thông báo chung. Dùng design token `--warning-subtle`/`--warning`/`--text-secondary`; `role="status"` + `aria-live="polite"`; nút đóng có `aria-label` tiếng Việt; icon `lucide-react` (`FileWarning` / `AlertTriangle` / `X`).
  - `apps/extension/src/sidepanel/store/chatStore.ts` — thêm `contextError` · `contextErrorMessage` · `contextSourceKind` + action `setContextError`.
  - `apps/extension/src/sidepanel/hooks/useChat.ts` — `captureActiveContext()` ghi lỗi trích xuất vào store; `useChat()` trả `contextError` + `contextErrorMessage`.
  - `apps/extension/src/sidepanel/App.tsx` — render `ContextNotice` khi có `contextError`.
  - **Test** — `apps/extension/tests/extractClient.test.ts` (+4) · `apps/extension/tests/extractContext.test.ts` (+7) · `apps/extension/tests/pageContext.test.ts` (+1 `sourceKind`, cập nhật case "tab không truy cập được") · **+2 E2E** `apps/extension/e2e/extract.spec.ts` (stub BFF bằng `page.route` → panel hiện `ContextNotice` đúng `data-error-code` cho PDF scan & video không caption).
  - **Docs** — `REQUIREMENTS.md` §4.2 (trạng thái FR-CONTEXT-05/06 ✅) + §11.1 (task ✅) · `IMPLEMENTATION_PLAN.md` §3 (task ✅) + §3.1b (bảng verify) · `COMPARISON_MATRIX.md` §D + §E (✅) · `DESIGN_SYSTEM_BRIEF.md` §3.4 (component `ContextNotice` + token + a11y).
- **T-M1-21 — Trích xuất PDF server-side (FR-CONTEXT-05)** — Chrome render PDF bằng PDF viewer built-in (plugin native `chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/`) → content script không inject được → phải parse ở BFF.
  - `apps/server/src/lib/safeFetch.ts` — lớp chống SSRF cho mọi URL do client gửi lên: chỉ cho `http:`/`https:` · resolve DNS (`node:dns/promises`) rồi chặn loopback `127/8` · private `10/8`, `172.16/12`, `192.168/16` · link-local `169.254/16` (cloud metadata) · CGNAT `100.64/10` · `0.0.0.0/8` · IPv6 `::1`, `fc00::/7`, `fe80::/10` · IPv4-mapped `::ffff:x.x.x.x` · tự đi theo redirect (tối đa 3 hop, kiểm tra lại từng hop; 301/302/303 → đổi sang `GET`) · timeout 15s (AbortController) · giới hạn size khi đọc **stream** (không chỉ dựa `content-length`).
  - `apps/server/src/lib/pdfExtractor.ts` — parse bằng `pdfjs-dist@^4.10.38` (bản `legacy/build/pdf.mjs`, Node ≥ 20 khớp `.nvmrc` 22): gom text item theo tọa độ Y (`transform[5]`) để giữ newline · truyền `standardFontDataUrl` cho PDF dùng font chuẩn non-embedded · PDF không có text layer (bản scan) → `CONTEXT_PDF_NOT_READABLE`.
  - `apps/server/src/routes/extract.ts` — `POST /api/extract/pdf` (validate `extractRequestSchema`) · **luôn trả HTTP 200** cho lỗi nghiệp vụ kèm `{ error, errorMessage }` trong body → client không phân biệt theo status → chat không bao giờ hỏng vì lỗi trích xuất.
  - `apps/server/src/app.ts` — mount `createExtractRouter()` vào `API_BASE_PATH`.
  - `apps/server/package.json` — thêm `pdfjs-dist@^4.10.38` (bản cuối hỗ trợ Node ≥ 20; `v5` yêu cầu Node ≥ 22.3).
  - **Test** — `apps/server/tests/safeFetch.test.ts` (+9) · `apps/server/tests/pdfExtractor.test.ts` (+5, dựng PDF mini có xref chuẩn để test offline) · `apps/server/tests/extractRoute.test.ts` (+5, HTTP thật qua Express).
- **T-M1-22 — Transcript YouTube server-side (FR-CONTEXT-06)** — transcript nằm ở `captionTracks` trong player response, không phải DOM text.
  - `apps/server/src/lib/youtubeExtractor.ts` — `GET` watch page (lấy `INNERTUBE_API_KEY` + `VISITOR_DATA` bằng regex) → `POST youtubei/v1/player` với client `ANDROID` (`clientVersion 20.10.38`, `androidSdkVersion 34`, header `X-Youtube-Client-Name: 3`) → đọc `captions.playerCaptionsTracklistRenderer.captionTracks[]` → `fetch` `captionTracks[].baseUrl` với `User-Agent` Android → parse XML timedtext (`<p t d>` hoặc `<text start dur>`) → transcript `[mm:ss] text`.
  - Chọn track: ưu tiên ngôn ngữ `vi` → `en` → ngôn ngữ còn lại; trong cùng ngôn ngữ ưu tiên track thủ công (`kind !== 'asr'`).
  - Fallback rõ ràng → `CONTEXT_TRANSCRIPT_UNAVAILABLE` (không caption / geo-block / live stream / player response không hợp lệ).
  - **Test** — `apps/server/tests/youtubeExtractor.test.ts` (+11, mock `global.fetch` → watch page → InnerTube → timedtext XML).
- **T-M1-21 / T-M1-22 — Trích xuất PDF & transcript YouTube (contract `packages/shared`)** — chuẩn hoá 2 nhánh trích xuất context mới về cùng shape `context.text` với nhánh HTML.
  - `packages/shared/src/pageKind.ts` — `detectPageKind(url)` → `'html' | 'pdf' | 'youtube' | 'unknown'` · `extractYouTubeVideoId(url)` (hỗ trợ `/watch?v=`, `/shorts/`, `/live/`, `/embed/`, `youtu.be/`) · `isPdfUrl(url)`.
  - `packages/shared/src/schemas/extract.ts` — `extractRequestSchema` (`{ kind: 'pdf' | 'youtube', url }`) · `extractResponseSchema` (`{ kind, text, title?, excerpt?, truncated, error?, errorMessage? }`) · `EXTRACT_ERROR_CODES`.
  - `packages/shared/src/errors.ts` — thêm 4 error code chuẩn: `CONTEXT_PDF_NOT_READABLE` (422) · `CONTEXT_PDF_UNREACHABLE` (502) · `CONTEXT_TRANSCRIPT_UNAVAILABLE` (422) · `CONTEXT_EXTRACT_FAILED` (500).
  - `packages/shared/src/constants.ts` — `LIMITS.MAX_PDF_BYTES = 20_000_000` · `LIMITS.MAX_EXTRACT_TEXT_CHARS = 40_000` · `LIMITS.EXTRACT_FETCH_TIMEOUT_MS = 15_000` · `API_ROUTES.extractPdf` / `API_ROUTES.extractYoutube`.
  - `packages/shared/src/schemas/chat.ts` — `pageContextSchema` thêm `sourceKind?` · `contextError?` · `contextErrorMessage?` để UI hiển thị lỗi trích xuất.
  - **Test** — `packages/shared/tests/extractSchema.test.ts` (+15 unit test): 4 loại URL cho `detectPageKind` · `extractYouTubeVideoId` · `isPdfUrl` · validate `extractRequestSchema` / `extractResponseSchema`.
  - **Docs** — `docs/SYSTEM_DESIGN.md` §4.1 (2 endpoint đã implement, lỗi nghiệp vụ trả HTTP 200) + §7.3.1 (contract + cơ chế `safeFetch` / `pdfExtractor` / `youtubeExtractor`) + §3 (cây thư mục `apps/server/src/`).

### Added
- **Docs — Audit traceability FR ↔ Task (2026-11-04)** — rà soát toàn bộ `docs/` đối chiếu `REQUIREMENTS.md` với `IMPLEMENTATION_PLAN.md`; phát hiện **31 FR + 27 NFR (58 yêu cầu)** chưa được map tới task nào trong cột FR của plan, cộng 2 nhãn FR sai. Đã bổ sung task + bảng traceability đầy đủ.
  - **`docs/REQUIREMENTS.md` §11.1** — bảng **FR ↔ Task** đầy đủ cho toàn bộ **83 FR + 29 NFR** (112 yêu cầu), chia theo nhóm (FR-CHAT / FR-CONTEXT / FR-VISION / FR-TOOLS / FR-SKILL / FR-PROVIDER / FR-WORKFLOW / FR-SETTINGS / FR-UX / NFR-PERF / NFR-SEC / NFR-REL / NFR-A11Y / NFR-MAINT), kèm cột Priority và Milestone.
  - **`docs/IMPLEMENTATION_PLAN.md` §3.2** — bảng rút gọn FR → Task theo nhóm (để audit nhanh khi sửa plan) + ghi nhận kết quả audit.
  - **Task card mới trong M1** (M1: 20 → 25 task):
    - `T-M1-21` — Trích xuất PDF (text-based) (FR-CONTEXT-05)
    - `T-M1-22` — Transcript YouTube (FR-CONTEXT-06)
    - `T-M1-23` — Ngân sách context & cắt bớt thông minh (FR-CONTEXT-07)
    - `T-M1-24` — Upload ảnh (paste / drag-drop / file picker) (FR-VISION-01)
    - `T-M1-25` — Onboarding lần đầu 3 bước (FR-UX-02)
  - **Task card mới trong M2** (M2: 18 → 22 task): `T-M2-19` chính sách context theo domain + lịch sử duyệt opt-in + mode "chỉ dùng trang" (FR-CONTEXT-08/09/11, FR-SETTINGS-04, NFR-SEC-02/06) · `T-M2-20` web search tool (FR-TOOLS-03) · `T-M2-21` skill library built-in + skill gắn điều kiện (FR-SKILL-04/06) · `T-M2-22` vision mở rộng (FR-VISION-02/03/04/05).
  - **Task card mới trong M3** (M3: 9 → 11 task): `T-M3-10` backup DB tự động (`pg_dump` cron) (NFR-REL-05) · `T-M3-11` bộ ADR (NFR-MAINT-05).
  - **`docs/SYSTEM_DESIGN.md` §7.3.1** — thiết kế nhánh trích xuất PDF & YouTube: content script không đủ (PDF viewer là plugin native, transcript nằm ở `captionTracks`) → cả 2 nhánh fetch ở BFF rồi chuẩn hoá về cùng shape `context.text`; kèm quy tắc bảo mật (chống SSRF: chặn mạng nội bộ, giới hạn kích thước, timeout) và nguyên tắc "lỗi trích xuất không được làm hỏng chat". Thêm 2 endpoint đích `POST /api/extract/pdf` · `POST /api/extract/youtube` vào §4.1.

### Changed
- **`docs/REQUIREMENTS.md` §4.2** — `FR-CONTEXT-05` (PDF) và `FR-CONTEXT-06` (transcript YouTube) **nâng từ Should → Must**. Lý do: Edge Copilot (A20) và Chrome Gemini (B10) đều có ở mức Must để đạt parity; đây là 2 dòng "Must" mới trong gate M1. Bổ sung AC chi tiết cho cả 2 (PDF scan → báo "không đọc được, hãy upload ảnh"; PDF nội bộ/`file://` → báo rõ; YouTube không có caption / geo-block / consent → báo rõ).
- **`docs/REQUIREMENTS.md` §6.3** — dòng ràng buộc "Content script không chạy trên PDF viewer" được sửa thành cách xử lý thật (BFF fetch bytes + parse server-side) thay vì "mở PDF bằng viewer ngoài".
- **`docs/IMPLEMENTATION_PLAN.md`** — sửa nhãn FR sai: `T-M1-04` (`FR-CONTEXT-02/09` → `FR-CONTEXT-02`; `FR-CONTEXT-09` thực chất là lịch sử duyệt web, thuộc `T-M2-19`) · `T-M1-06` (`FR-CONTEXT-01/05` → `FR-CONTEXT-01/02/03/07`; nhãn cũ nhầm sang PDF). Bổ sung FR/NFR vào các task card cũ: `T-M0-02` (+NFR-SEC-08) · `T-M0-06` (+NFR-SEC-05) · `T-M0-07` (+NFR-MAINT-03) · `T-M0-11` (+NFR-PERF-06) · `T-M0-12` (+NFR-SEC-03) · `T-M1-01` (+NFR-PERF-04) · `T-M1-07` (+NFR-SEC-04, NFR-PERF-02) · `T-M1-09` (+FR-CHAT-08/11) · `T-M1-10` (+FR-CHAT-07/12, FR-UX-05) · `T-M1-12` (+FR-SETTINGS-03/04/05/07, NFR-SEC-07) · `T-M1-14` (+FR-CONTEXT-12, NFR-REL-01) · `T-M1-15/16` (+NFR-SEC-01) · `T-M1-19` (+FR-UX-08, NFR-REL-02/04) · `T-M1-20` (+FR-UX-07/09/10, NFR-PERF-03, NFR-A11Y-01..05) · `T-M1-03/18` (bỏ nhầm FR-UX-02) · `T-M2-01` (+FR-PROVIDER-07) · `T-M2-04/07` (+NFR-MAINT-03) · `T-M2-13` (+NFR-MAINT-02) · `T-M3-02` (+NFR-PERF-05) · `T-M3-03` (+NFR-MAINT-02) · `T-M3-04` (+FR-UX-10, NFR-PERF-02) · `T-M3-09` (+NFR-PERF-06) · `T-M4-02..08` (bổ sung FR-WORKFLOW-06/08/09/10/11/12/13). §8 timeline thêm tuần W5.5 · §10 thứ tự cắt thêm 4 mục + đánh dấu T-M1-21/22/23/24/25 là **không được cắt**.
- **`docs/COMPARISON_MATRIX.md`** — `A20` (Edge: tóm tắt video/PDF) và `B10` (Gemini: tóm tắt video YouTube) đổi ưu tiên `S` → `M`; §D thêm hàng "Context PDF / video (transcript)"; §E checklist parity thêm 4 dòng (PDF, YouTube, ngân sách context, upload ảnh).
- **`docs/SYSTEM_DESIGN.md`** — §3 cây thư mục bổ sung `lib/contextBudget.ts` + `routes/extract.ts` + `lib/{pdfExtractor,youtubeExtractor}.ts`; §8 thêm 2 dòng ngân sách trích xuất PDF/YouTube; §9 thêm 2 rủi ro (SSRF qua fetch URL, YouTube không có caption).
- **`docs/DESIGN_SYSTEM_BRIEF.md`** — thêm component `ContextBudget` (§3.4) + sửa nhãn `ContextChips` (`FR-CONTEXT-09` → `FR-CONTEXT-02`); §4 thêm 3 state mới: "Context không đọc được" (PDF scan / `file://`), "Transcript không có" (YouTube), "Context vượt ngân sách"; §6 bổ sung mapping `Onboarding` (FR-UX-02) + `AttachmentTray`/`AttachmentChip` (FR-VISION-01).
- **`docs/EVAL_PLAN.md`** — thêm 2 nhóm task `doc_extract` (PDF, 2 task) + `video_transcript` (YouTube, 2 task) → dataset 44 → 48 task; §12 checklist thêm dòng kiểm tra 2 nhóm này.
- **`docs/README.md`** — cập nhật số FR/NFR (82/30) + số task (82) + phiên bản docs v1.1 + trạng thái milestone (M0 ✅ xong, M1 1/25 task).
- **`AGENTS.md`** — cập nhật §6: M1 còn 1/25 task (thay vì 1/20).
- **`docs/HANDOFF.md`** — ghi nhận quyết định nâng PDF/YouTube lên Must + kết quả audit.

### Fixed
- **Nhãn FR sai trong `IMPLEMENTATION_PLAN.md`** — `T-M1-04` ghi `FR-CONTEXT-09` (lịch sử duyệt web, thực chất không liên quan toggle context) và `T-M1-06` ghi `FR-CONTEXT-05` (PDF, thực chất là truyền context sang BFF). Đã sửa cả hai.
- **`docs/REQUIREMENTS.md` §11** — thiếu bảng FR → Task khiến không kiểm chứng được FR nào đã được implement. Đã bổ sung §11.1.

### Added
- **T-M1-01** — Content script extractor "Readability-lite" + mang nội dung trang vào context gửi BFF (FR-CONTEXT-01).
  - `apps/extension/src/content/extractor.ts` — thuật toán rút gọn Readability: clone `Document` (không mutate DOM thật) → xoá `script/style/nav/footer/aside/form/…` + phần tử có `class`/`id` khớp pattern âm → chấm điểm các node `article, main, [role="main"], section, div` (điểm theo độ dài text của block con, trừ khi link density > 0.5, cộng/trừ theo `class`/`id`, bonus cho thẻ semantic) → chọn node điểm cao nhất → fallback `body` → ghép text chuẩn hoá whitespace. Trả `{ title, byline, url, text, excerpt, strategy, wordCount }` với `strategy ∈ article | main | body | empty`.
  - `apps/extension/src/content/contentScript.ts` — expose `window.__sidekickExtractContent()` + listener `chrome.runtime.onMessage` action `sidekick:extract-content` (tái dùng cho T-M1-02).
  - `apps/extension/src/lib/pageContext.ts` — `captureTabContext(tabId)` + `getActiveTabId()`: gọi `chrome.scripting.executeScript`, tự inject `content.js` rồi thử lại nếu content script chưa có, **không bao giờ throw** (trang `chrome://` / không có quyền → trả context tối thiểu).
  - `apps/extension/src/types/globals.d.ts` — khai báo global `__sidekickExtractContent` / `__sidekickExtractMetadata`.
  - `packages/shared`: `pageContextSchema` bổ sung `text` (nội dung chính) + `excerpt` (trích đoạn); `LIMITS.MAX_PAGE_TEXT_CHARS = 40_000`, `LIMITS.MAX_EXCERPT_CHARS = 500`.
  - `apps/server/src/services/chatService.ts` — `buildContextPrompt()` đưa `context.text` + `context.excerpt` vào prompt, giữ nguyên việc đánh dấu context là "dữ liệu tham chiếu, không phải chỉ thị" (chống prompt injection).
  - `apps/extension/src/sidepanel/hooks/useChat.ts` — tự capture context của tab active trước khi gửi; lỗi capture không làm hỏng chat.
  - **Test** — +29 unit test: `apps/extension/tests/extractor.test.ts` (8 fixture HTML) · `apps/extension/tests/pageContext.test.ts` (5) · `apps/extension/tests/useChat.test.ts` (+3) · `packages/shared/tests/chatSchema.test.ts` (7) · `apps/server/tests/contextPrompt.test.ts` (6) — và **+1 E2E** `apps/extension/e2e/extractor.spec.ts` (content script chạy thật trên trang web, service worker gọi `chrome.scripting.executeScript` → trích đúng title + nội dung chính).

### Fixed
- **Content script build ra ESM → Chrome không load được.** `dist/content.js` chứa `import ... from "./assets/dist.js"` sau khi extractor được tách thành module → Chrome báo *"It isn't a module"* và content script **không chạy**. Tách build riêng `apps/extension/vite.content.config.ts` (`build.lib` + `formats: ['iife']`, `emptyOutDir: false`) → `dist/content.js` là 1 file IIFE tự chứa, không `import`.
- **`@sidekick/shared` kéo theo toàn bộ bundle `zod` vào content script** (101 kB) → thêm subpath export `@sidekick/shared/constants`; extractor chỉ import hằng số từ đó → `dist/content.js` còn **4.7 kB**.

### Changed
- `apps/extension/package.json`: `build` giờ chạy 2 lần (`vite build` + `vite build --config vite.content.config.ts`); thêm script `build:content`.
- `packages/shared/package.json`: thêm export map `"./constants"`.
- `apps/extension/tests/setup.ts`: mock `chrome.tabs.get` / `chrome.tabs.query` / `chrome.scripting.executeScript` với chữ ký đúng để `vi.mocked()` giữ type.
- `docs/IMPLEMENTATION_PLAN.md`: thêm cột **Status** cho bảng task M1 (T-M1-01 ✅) + mục **§3.1 Kết quả verify T-M1-01**.
- `docs/SYSTEM_DESIGN.md`: §3 cây thư mục cập nhật (có `content/extractor.ts` + `lib/pageContext.ts` + `vite.content.config.ts`); §4.2 thêm **shape `ChatRequest` đang chạy thật** (khung đích M2+ giữ nguyên); §7.2 số test + **§7.3** luồng trích xuất nội dung trang + **§7.4** quy tắc build content script (IIFE); §8 ghi rõ cache `chrome.storage.local` chưa implement.
- `docs/REQUIREMENTS.md`: FR-CONTEXT-01 ghi chú trạng thái đã implement; §6.5 cây thư mục cập nhật.
- `docs/COMPARISON_MATRIX.md`: §E checklist parity gắn trạng thái + task ID tương ứng.
- `docs/HANDOFF.md`: milestone hiện tại M1 · task kế tiếp **T-M1-02**.
- Số test toàn repo: **120 unit** (shared 22 · server 55 · extension 43) + **3 E2E**.

### Added
- **T-M0-01 → T-M0-15** — Milestone M0 (Foundation) hoàn thành, đạt toàn bộ gate verify (xem `docs/IMPLEMENTATION_PLAN.md` §2.1).
  - **T-M0-01/02** — Monorepo pnpm workspace (`apps/extension`, `apps/server`, `apps/eval`, `packages/shared`), ESLint 10 + Prettier + TS strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
  - **T-M0-03** — `packages/shared`: Zod schemas, union 8 SSE event, error codes chuẩn, entity types.
  - **T-M0-04/05** — Docker Compose Postgres 16 + `pgvector/pgvector:pg16`, Drizzle schema 6 bảng (`conversations`, `messages`, `citations`, `tool_calls`, `provider_keys`, `request_logs`), migration `0000_adorable_sister_grimm.sql`.
  - **T-M0-06** — BFF Express 5: `/api/health`, error middleware, origin guard, request logger, `.env` loader có validate bằng Zod.
  - **T-M0-07/08/09** — Provider layer: `MockProvider` + adapter Groq / OpenRouter / Gemini Direct, registry có fallback chain, `keyResolver` hỗ trợ K1 (env) / K2 (BYOK mã hoá) / K3 (local), `crypto.ts` dùng AES-256-GCM.
  - **T-M0-10** — `POST /api/chat` trả SSE 8 event (`meta` → `token`* → `citation`/`tool_call`/`tool_result` → `usage` → `done`), ghi `messages` + `request_logs`, hỗ trợ abort.
  - **T-M0-11/12/13/14** — Extension MV3: Vite 8 + React 18 + Tailwind v4 + shadcn/ui, `manifest.json` (`side_panel`, `scripting`, `storage`, `tabs`, `contextMenus`, `<all_urls>`, CSP `script-src 'self'`), 4 icon PNG, `sseClient` đọc `ReadableStream` trực tiếp từ BFF, `useChat` hook + Zustand store, design token `design/tokens.json` → `design/tokens.css` (light/dark, WCAG 2.2 AA).
  - **T-M0-15** — `apps/eval` scaffold (dataset loader + CLI + `tsconfig.json`).
- **Test** — 91 unit test (shared 15 · server 49 · extension 27) + 2 E2E Playwright (`apps/extension/e2e/sidepanel.spec.ts`): load unpacked, render header/composer, gõ prompt nhận token thật từ BFF, provider chip hiển thị, design token apply.
- **`scripts/verify-providers.mjs`** — script verify 3 provider stream thật (Groq / OpenRouter / Gemini Direct) + `scripts/generate-icons.mjs` sinh icon PNG từ SVG.

### Changed
- `docs/IMPLEMENTATION_PLAN.md`: thêm cột **Status** cho bảng task M0 (tất cả ✅) + mục **§2.1 Kết quả verify M0** với bằng chứng từng gate.
- `apps/server/src/middleware/origin.ts`: hỗ trợ wildcard theo scheme (`chrome-extension://*`) — id extension load unpacked đổi theo máy nên không thể hardcode origin.
- `apps/server/.env.example`: `ALLOWED_ORIGINS` thêm `chrome-extension://*`.
- `docs/SYSTEM_DESIGN.md`, `docs/REQUIREMENTS.md`, `docs/DESIGN_SYSTEM_BRIEF.md`, `docs/README.md`, `AGENTS.md`: đồng bộ với trạng thái M0 đã implement.
- `docs/REQUIREMENTS.md`:
  - §1.6 bổ sung stack đã chốt (React + Tailwind + shadcn/ui, Drizzle, monorepo pnpm) và đổi mốc hạn chót thành "M2 = EVAL_REPORT bắt buộc, M3 = polish + nộp, M4 = workflow tuỳ chọn".
  - §2 parity summary: thêm dòng "3 nguồn API key (K1/K2/K3)" và "Workflow automation (M4, sau cùng)"; đổi mức ưu tiên của Image gen / Voice / Vision từ "M2" sang "C".
  - §6.5 cấu trúc thư mục: cập nhật sang monorepo pnpm (`apps/extension`, `apps/server`, `apps/eval`, `packages/shared`).
  - §7.2 schema: thêm bảng `eval_datasets` và `eval_judgments`.
  - §11 Traceability: bổ sung dòng cho Design System / System Design / Implementation Plan.
  - Header: cập nhật status + danh sách docs liên quan.
- `docs/COMPARISON_MATRIX.md`:
  - §0 bổ sung 3 nguồn: Copilot Actions in Edge (A27), Gemini Tasks (B28), Gemini Schedules (B28).
  - §D: thêm chú thích giải thích thứ tự ưu tiên và vị trí M4 của workflow.
- `docs/EVAL_PLAN.md`:
  - §10: ghi rõ Eval thuộc M2 và là deliverable bắt buộc; nhóm `workflow` chỉ chạy ở M4.
  - §12: thêm 2 checklist item (bỏ nhóm workflow nếu chưa có M4; giữ `EVAL_REPORT.md` trong git).
  - §7: đổi toàn bộ đường dẫn `eval/…` → `apps/eval/…` và lệnh `npm run eval:*` → `pnpm eval:*` cho khớp monorepo pnpm.

### Fixed
- **Extension gửi message assistant rỗng lên BFF** → BFF trả `VALIDATION_ERROR`. `useChat` giờ loại message có `content` rỗng khỏi lịch sử gửi đi.
- **`apiClient.fetchJson` crash** khi BFF/proxy trả body không phải JSON (ném `SyntaxError` thay vì `ApiError` chuẩn) → nay parse trong `try/catch`, fallback `INTERNAL_ERROR`.
- **Font trong side panel không áp dụng design token**: Chrome inject rule `font` cho `body` ở trang extension, đè lên `font-family`/`font-size`. Typography chuyển sang đặt trên `#root` (div) thay vì `body`.
- **`@theme inline` tự tham chiếu `var(--font-sans)`** trong `index.css` → vòng lặp CSS làm token rỗng. Bỏ `@theme`, import `design/tokens.css` sau `tailwindcss` để token ghi đè mặc định của Tailwind.
- **`sidepanel.html` build ra `dist/src/sidepanel/index.html`** (sai đường dẫn `side_panel.default_path`) → chuyển entry HTML ra `apps/extension/sidepanel.html` ở root project.
- **`pnpm eval:run` không chạy được**: `node --experimental-strip-types` không resolve được import `.js` trỏ tới file `.ts` → chuyển sang `tsx` (giống `apps/server`), và truyền đúng tên script từ root (`pnpm --filter @sidekick/eval run run`).
- Sửa 4 tham chiếu `§X.Y` sai phát sinh khi viết lại docs: `workflow-discipline.mdc` trỏ `SYSTEM_DESIGN.md` §6 → §5 (data model); `REQUIREMENTS.md` §11 traceability trỏ §5 (SSE) → §4 và §6 (schema) → §5; `IMPLEMENTATION_PLAN.md` T-M2-18 trỏ "theo §7" (DoD) → "theo §10" (kịch bản cắt); `docs-sync.mdc` bỏ mẫu link `](*.md)` gây báo động link chết giả.
- `docs/HANDOFF.md` — đếm số file docs 8 → 9 (thêm `SYSTEM_DESIGN.md` + `IMPLEMENTATION_PLAN.md`).
- `AGENTS.md` — cập nhật mô tả cấu trúc `docs/` (9 file).

### Docs
- Cập nhật `REQUIREMENTS.md` §6.5 + `SYSTEM_DESIGN.md` §3/§7 + `DESIGN_SYSTEM_BRIEF.md` §2 theo trạng thái implement thực tế.
- `docs/HANDOFF.md`: ghi nhận M0 hoàn tất, việc tiếp theo là M1 (parity).
- Kiểm tra toàn repo bằng script: **0 link chết**, **0 tham chiếu `§X.Y` không resolve** (quét 15 file `.md`/`.mdc`).
- **`docs/SYSTEM_DESIGN.md`** — kiến trúc chi tiết: 12 ADR, cấu trúc thư mục, hợp đồng API (30 endpoint), giao thức SSE (8 event type), data model Drizzle (17 bảng), chiến lược bảo mật, chiến lược test, rủi ro kỹ thuật.
- **`docs/IMPLEMENTATION_PLAN.md`** — kế hoạch task-level M0–M4 (71 task, có mã `T-Mx-xx`), Definition of Done, timeline 13 tuần, phân công 3 thành viên, kịch bản thiếu thời gian.
- **`docs/DESIGN_SYSTEM_BRIEF.md`** — viết lại (file từng bị mất): 7 design principles, design token inventory (color/typography/spacing/motion/layout), component inventory + chiến lược dùng lại vs tự viết, state & hành vi UI chuẩn hoá, checklist WCAG 2.2 AA, traceability component ↔ FR.
- **`docs/HANDOFF.md`** — quy trình bắt đầu chat mới (6 bước, ≤ 5 phút), mẹo tiết kiệm token, quy trình kết thúc phiên.
- **`docs/CHANGELOG.md`** — file này.
- **`AGENTS.md`** — entry point ngắn (<200 dòng) cho agent: stack, kiến trúc, lệnh, quy ước bắt buộc, trạng thái milestone.
- **`.cursor/rules/`** — 5 rule file: `project-overview.mdc`, `docs-sync.mdc`, `coding-standards.mdc`, `mv3-chrome.mdc`, `workflow-discipline.mdc`.
- **`.cursorrules`** — bản compact 20 dòng cho công cụ không đọc `.cursor/rules`.
- **`.gitignore`**, **`.editorconfig`**, **`.npmrc`**, **`.nvmrc`** — setup files cơ bản.

---

## [v0.1 — 2026-11-03] — Baseline tài liệu

### Added
- `docs/REQUIREMENTS.md` — 14 User Stories, 81 Functional Requirements, 29 Non-Functional Requirements, kiến trúc, schema DB, phân tích rủi ro, roadmap M0–M4.
- `docs/COMPARISON_MATRIX.md` — 28 tính năng Edge Copilot (A1–A28), 28 tính năng Chrome Gemini (B1–B28), 15 tính năng độc quyền (C1–C15), checklist parity M1 và M4.
- `docs/EVAL_PLAN.md` — chiến lược eval 2 tầng, dataset 44 task, rubric 8 tiêu chí, judge prompt, 11 fairness controls, 3 bảng kết quả, kế hoạch triển khai 4 tuần.
- `docs/README.md` — index tài liệu, thứ tự đọc, sơ đồ kiến trúc.

### Notes
- Xác định 3 nguồn API key: K1 (team key trong `.env`), K2 (BYOK mã hoá qua BFF trong Postgres), K3 (BYOK trực tiếp trong `chrome.storage.local` khi BFF down).
- Xác định các ràng buộc MV3: `activeTab` không dùng được trong side panel; `sidePanel.open()` chỉ trong user gesture; SW bị kill ~30s → streaming không đi qua SW.
