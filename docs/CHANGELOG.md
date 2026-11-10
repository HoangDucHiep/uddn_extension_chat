# CHANGELOG — Tài liệu & triển khai

> Ghi lại **mọi thay đổi** trong repo, từ mới → cũ.
> Agent mới đọc 20 dòng đầu là nắm được gần đây đã làm gì.
> Format xem `.cursor/rules/docs-sync.mdc` §2.

---

## [Unreleased]

### Added
- **T-M2-06 — Skills: skill library browser lọc theo tag (FR-SKILL-07)**
  - **Quyết định thiết kế:** lọc chạy **phía server** (`GET /api/skills?q=...&tags=a,b`) → không tải toàn bộ skill về client để lọc. Lọc **cả** built-in (registry trong code) **và** skill của user. Chế độ khớp tag = **`any`** (có **ít nhất 1** tag trong danh sách) — đơn giản hơn `all`, hợp lý với "lọc theo tag"; so khớp **không phân biệt hoa thường**. Query `q` khớp **tên** **hoặc** **mô tả** → gõ "email" ra được skill `viet-email`.
  - **Contract shared:** `packages/shared/src/schemas/skill.ts` → `skillListQuerySchema.tags` (nhận **2 dạng**: `?tags=a&tags=b` hoặc `?tags=a,b` → `z.preprocess` chuẩn hoá về mảng chuỗi).
  - **Server:** `apps/server/src/services/skillService.ts` → `ListSkillsParams.tags` + `matchesTags()` + `matchesQuery()` (tên **hoặc** mô tả). `apps/server/src/routes/skills.ts` → không đổi (query đã đi qua `skillListQuerySchema`).
  - **Extension:** `apps/extension/src/lib/skillClient.ts` → `ListSkillsParams.tags` → `?tags=a,b`. `apps/extension/src/sidepanel/components/skills/SkillLibrary.tsx` (mới) → ô tìm kiếm (`type="search"` + icon `Search`) · hàng **chip tag** (toggle, `aria-pressed`) · card skill (tên + mô tả + badge phạm vi + badge tag + icon `Play`) · **click card → chạy ngay** (`onUse` → chen `/ten-skill` vào composer + đóng drawer + focus composer) · trạng thái `loading` / `empty` / `emptyFiltered` / `error` (inline, không crash).
  - **UI:** `apps/extension/src/sidepanel/components/skills/SkillManager.tsx` → **2 tab** (`role="tablist"`): **Quản lý** (CRUD + import/export) · **Thư viện** (`SkillLibrary`). **Không** thêm thư viện UI.
  - **i18n:** `skill.manager.tabManage` · `skill.manager.tabLibrary` · `skill.library.searchPlaceholder` · `skill.library.searchLabel` · `skill.library.tagFilterLabel` · `skill.library.loading` · `skill.library.empty` · `skill.library.emptyFiltered`.
  - **Test:** `apps/server/tests/skillsRoute.test.ts` (+4 — `?tags=` lọc đúng · nhiều tag mode `any` · lọc cả built-in · `q` khớp cả mô tả) · `apps/extension/tests/skillLibrary.test.tsx` (8 — mới) · `apps/extension/tests/skillManager.test.tsx` (+2 — tab mặc định · chuyển tab).
  - **Docs:** `docs/SYSTEM_DESIGN.md` §7.25.9 (mới) · `docs/REQUIREMENTS.md` §4.5 (FR-SKILL-07 → ✅) + §9 traceability · `docs/DESIGN_SYSTEM_BRIEF.md` §3.13.5 (mới).
- **T-M2-05 — Skills: import/export JSON (FR-SKILL-05)**
  - **Định dạng file:** `version: 1` + `exportedAt` (ISO 8601) + `skills[]` (shape `Skill` đầy đủ) → `sidekick-skills-<yyyyMMdd-HHmm>.json`.
  - **Quyết định thiết kế:** export **chỉ** skill `scope === 'user'` (skill built-in nằm trong registry trong code `apps/server/src/skills/builtin.ts` → export ra rồi import lại vô nghĩa + đụng tên). Import **bỏ qua** `id` / `scope` / `createdAt` / `updatedAt` → server tự sinh `id` mới + gán `scope: 'user'` → không ghi đè skill của máy khác. Skill **trùng tên** → **bỏ qua** + toast tổng kết (không hỏi lại user). `version` khi import **không** bắt buộc → user tự viết file vẫn import được. Tối đa `SKILL_MAX_IMPORT_ITEMS = 100` skill / lần import.
  - **Contract shared:** `packages/shared/src/skillIO.ts` (mới — thuần) → `SKILL_IO_VERSION` · `SKILL_MAX_IMPORT_ITEMS` · `buildSkillExport()` · `toImportableSkills()` (chuẩn hoá slug · loại tên rỗng/trùng trong file · cắt tag rỗng) · `buildSkillFileName()`. `packages/shared/src/schemas/skillIO.ts` (mới) → `skillImportItemSchema` · `skillImportPayloadSchema` · `skillExportPayloadSchema`. `packages/shared/src/index.ts` → export 2 file mới.
  - **Extension:** `apps/extension/src/lib/skillIO.ts` (mới) → `exportSkillsFile()` (dùng `downloadTextFile` có sẵn — `Blob` + `<a download>`, **không** cần permission `chrome.downloads`) · `importSkillsFile()` (`file.text()` + `JSON.parse` + `skillImportPayloadSchema.safeParse` → lỗi có **đường dẫn field** rõ ràng). `apps/extension/src/sidepanel/components/skills/SkillManager.tsx` → 2 nút **"Xuất JSON"** (`Download`, disabled khi user chưa có skill nào) · **"Nhập JSON"** (`Upload` + `<input type="file" accept="application/json,.json" hidden>`) trong drawer Kỹ năng.
  - **Không cần endpoint mới** — export dùng `GET /api/skills?scope=user`, import dùng `POST /api/skills` (server đã trả `CONFLICT` khi trùng tên → client bỏ qua).
  - **i18n:** `skill.manager.export` · `skill.manager.import` · `toast.skillExported` · `toast.skillExportFailed` · `toast.skillImported` · `toast.skillImportedPartial` · `toast.skillImportFailed`.
  - **Test:** `packages/shared/tests/skillIO.test.ts` (20 — export chỉ lấy scope user · round-trip không mất dữ liệu · bỏ id/scope · slug hoá · schema reject version sai / skills rỗng / > 100) · `apps/extension/tests/skillIO.test.ts` (7) · `apps/extension/tests/skillManager.test.tsx` (+5 — nút xuất/nhập · xuất disabled · import trùng → bỏ qua · import mới → gọi API).
  - **Docs:** `docs/SYSTEM_DESIGN.md` §7.25.8 (mới) · `docs/REQUIREMENTS.md` §4.5 (FR-SKILL-05 → ✅) + §9 traceability · `docs/DESIGN_SYSTEM_BRIEF.md` §3.13.4 (mới).
- **T-M2-04 — Skills: menu `/`, CRUD, seed built-in tối thiểu (FR-SKILL-01/02/03, NFR-MAINT-03)**
  - **Quyết định thiết kế:** skill được áp dụng bằng cách **server resolve** — client gửi `skillId` trong `POST /api/chat` → server nối `prompt_template` vào system prompt + `model` của skill **ghi đè** model của request. Lý do: server là nguồn sự thật, client không cần biết nội dung template, 1 template dùng được cho mọi provider. Skill lưu ở **Postgres** (bảng `skills`) cho skill của user + registry **trong code** cho built-in.
  - **Contract shared:** `packages/shared/src/skill.ts` (mới — thuần) → `SKILL_SCOPES` · `SKILL_MAX_*` · `normalizeSkillName()` (slug: lowercase · bỏ dấu NFD · `đ`→`d` · `[^a-z0-9]+`→`-`) · `matchesSkillPrefix()` · `filterSkills()` · `SKILL_INPUT_PLACEHOLDER` · `SKILL_DEFAULT_INPUT` · `applySkillTemplate()` · `buildSkillInstruction()` · `stripSkillToken()`. `packages/shared/src/schemas/skill.ts` (mới) → `skillSchema` · `skillListResponseSchema` · `createSkillSchema` (tên tự chuẩn hoá slug) · `updateSkillSchema` (partial + `.refine` phải có ≥1 field) · `skillListQuerySchema`. `packages/shared/src/schemas/chat.ts` → `chatRequestSchema.skillId` (uuid, optional). `packages/shared/src/constants.ts` → `API_ROUTES.skills`. `packages/shared/src/index.ts` → export 2 file mới.
  - **Server — bảng + migration:** `apps/server/src/db/schema.ts` → bảng `skills` (`id uuid pk` · `name text unique` · `description text` · `prompt_template text` · `scope text` · `enabled bool` · `tags text[]` · **`model text` nullable** · timestamps). Migration **`0004_worthless_earthquake.sql`** (`drizzle-kit generate`).
  - **Server — seed built-in:** `apps/server/src/skills/builtin.ts` (mới) → `BUILTIN_SKILLS` = **3 skill** với **uuid cố định** (`a1000000-0000-4000-8000-00000000000{1,2,3}`): `tom-tat` · `giai-thich-don-gian` · `dich`. Định nghĩa trong code → **không** cần migration seed. *(Thư viện ≥ 8 skill nằm ở T-M2-21 — chưa implement.)*
  - **Server — service + API:** `apps/server/src/services/skillService.ts` (mới) → `listSkills()` (gộp built-in + user, sắp xếp `scope` rồi `name`) · `createSkill()` (tên trùng → `CONFLICT`) · `updateSkill()` / `deleteSkill()` (không tồn tại → `NOT_FOUND`; **xoá/sửa built-in → `FORBIDDEN`**) · `resolveSkillForChat()`. `apps/server/src/routes/skills.ts` (mới) → `GET/POST/PATCH/DELETE /api/skills` (validate Zod ở biên → `400 VALIDATION_ERROR`). Đăng ký trong `apps/server/src/app.ts`.
  - **Server — ghép prompt:** `apps/server/src/services/chatService.ts` → `resolveSkillForChat()` trước khi build provider messages → system prompt = `DEFAULT_SYSTEM_PROMPT` + `buildSkillInstruction(skill.promptTemplate)` (loại `{input}` → câu hỏi **không** lặp 2 lần) · user turn = `applySkillTemplate(template, câu hỏi)` (rỗng → `"Hãy áp dụng skill này."`) · `model = skill.model ?? request.model`. Token `/ten-skill` bị **strip** (client + server lần 2, chỉ đúng tên skill vừa resolve → không xoá nhầm URL).
  - **Extension — lớp dữ liệu:** `apps/extension/src/lib/skillClient.ts` (mới) → `listSkills()` · `createSkill()` · `updateSkill()` · `deleteSkill()` (parse bằng `skillListResponseSchema` / `skillSchema`) · `apps/extension/src/sidepanel/store/skillStore.ts` (mới — Zustand `useSkillStore`: `items` · `isLoading` · `error` · `refresh` · `create` · `update` (optimistic + rollback) · `remove` · `duplicate` (`${name}-copy`)) · `apps/extension/src/sidepanel/hooks/useSkillCommand.ts` (mới) → `findSkillToken(value, cursor)` → `{ query, start, end }` + `sync` / `close` / `apply` / `strip`.
  - **Extension — UI:** `apps/extension/src/sidepanel/components/skills/SkillMenu.tsx` (mới — popover `role="listbox"` trên textarea, lọc **prefix**, badge scope, dòng active tự cuộn) · `SkillManager.tsx` (mới — drawer Radix `Dialog` **trượt từ trái**, 2 nhóm **Có sẵn** / **Của tôi**, dùng nhanh / sửa / nhân bản / xoá có `ConfirmDialog`) · `SkillFormDialog.tsx` (mới — tạo/sửa: tên + preview slug · mô tả · prompt (`{input}`) · model · tags; validate bằng schema shared) · `PanelHeader.tsx` → nút icon `Sparkles` (`data-testid="skills-button"`) · `chat/MessageActions.tsx` → action **"Lưu thành kỹ năng"** (`BookmarkPlus`) trên **user message** (prefill = nội dung message) · `MessageBubble.tsx` → nối prop `onSaveAsSkill` · `Composer.tsx` → props `skillPopover` + `onSkillKeyDown` (menu `/` lo Enter/Tab) · `ChatWorkspace.tsx` → wiring đầy đủ (`selectedSkillId` · strip token khi gửi · `skillPopover` · drawer + form).
  - **i18n:** `skill.*` + `toast.skill*` + `header.openSkills` (`apps/extension/src/i18n/vi.ts` là nguồn sự thật → `en.ts` thiếu/thừa key = lỗi `pnpm typecheck`).
  - **Test:** `packages/shared/tests/skill.test.ts` (21) · `apps/server/tests/skillService.test.ts` (21) · `apps/server/tests/skillsRoute.test.ts` (13) · `apps/server/tests/chatSkill.test.ts` (10) · `apps/extension/tests/skillClient.test.ts` (9) · `apps/extension/tests/skillStore.test.ts` (11) · `apps/extension/tests/useSkillCommand.test.ts` (14) · `apps/extension/tests/skillMenu.test.tsx` (6) · `apps/extension/tests/skillManager.test.tsx` (10) · `apps/extension/e2e/skills.spec.ts` (6 — stub `/api/skills` + `/api/chat`, không cần BFF thật).
  - **Docs:** `docs/SYSTEM_DESIGN.md` §7.25 (mới) + §4.1 (endpoint) + §4.2 (`ChatRequest.skillId`) + §5.1 (bảng `skills`) + §5.3 (migration `0004`) · `docs/REQUIREMENTS.md` §4.5 (AC FR-SKILL-01/02/03 + FR-SKILL-04 ghi rõ phạm vi seed) · `docs/DESIGN_SYSTEM_BRIEF.md` §3.13 (mới) · `docs/IMPLEMENTATION_PLAN.md` §4.3 (mới) + dòng task T-M2-04 ✅ · `docs/COMPARISON_MATRIX.md` §B6/B7/B8/B26 · §C10 · §D · §E + §E.1.4 (mới) · `docs/HANDOFF.md` · `AGENTS.md` §6.
- **T-M2-03b — Budget cap (FR-PROVIDER-06), enforce phía server**
  - **Quyết định thiết kế:** cấu hình hạn mức **lưu phía server** (Postgres — bảng `budget_settings`, singleton `id = 'default'`) → server là **nguồn chặn sự thật**, client **không** tự so sánh hạn mức. Kỳ tính: `daily` (từ 00:00 hôm nay) · `monthly` (từ 00:00 ngày 1) theo **giờ địa phương của máy chạy BFF** (BFF chạy local cùng máy với trình duyệt → khớp "hôm nay" của user). 2 mức: `warnThresholdPercent` (mặc định 80) → cảnh báo; vượt 100% → `exceeded`. `hardBlock` (tuỳ chọn, mặc định bật) → **chặn** lượt chat mới.
  - **Contract shared:** `packages/shared/src/budget.ts` (mới — thuần) → `resolveBudgetPeriod()` · `evaluateBudgetState()` · `DEFAULT_BUDGET_SETTINGS` · `BUDGET_PERIODS` · `BUDGET_STATES`. `packages/shared/src/schemas/budget.ts` (mới) → `budgetSettingsSchema` · `budgetSettingsPatchSchema` · `budgetStatusSchema`. `packages/shared/src/constants.ts` → `API_ROUTES.budget`. `packages/shared/src/errors.ts` → `ERROR_CODES.BUDGET_EXCEEDED` + `ERROR_STATUS_MAP` → **402**. `packages/shared/src/chatErrors.ts` → `ChatErrorKind` mới `'budget'` (`isRetryableKind` = `false`, `shouldAutoRetry` = `false` → không retry vô ích, tránh vòng lặp).
  - **SSE event mới `budget`** (`packages/shared/src/events.ts`): `{ type, state, spentUsd, limitUsd, percentUsed, period }` — emit **trước** `meta` (kiểm tra hạn mức trước khi gọi provider) và **thêm 1 lần sau lượt** (đã cộng `costUsd` của lượt) → banner cập nhật ngay.
  - **Server — bảng + migration:** `apps/server/src/db/schema.ts` → bảng `budget_settings` (`id text pk` · `enabled` · `limit_usd numeric(12,6)` · `warn_threshold_percent` · `period` · `hard_block` · timestamps). Migration **`0003_good_mimic.sql`** (`drizzle-kit generate`).
  - **Server — service + API:** `apps/server/src/services/budgetService.ts` (mới) → `readBudgetSettings()` · `writeBudgetSettings()` (upsert) · `sumSpendSince()` (`SUM(request_logs.cost_usd)`) · `buildBudgetStatus()` · `isBudgetBlocked()`. `apps/server/src/routes/budget.ts` (mới) → `GET /api/budget` · `PUT /api/budget` (validate Zod ở biên → `400 VALIDATION_ERROR`). Đăng ký trong `apps/server/src/app.ts`.
  - **Server — enforce:** `apps/server/src/services/chatService.ts` → kiểm tra budget **trước** `prepareTurn` → vượt hạn mức + `hardBlock` → **không** tạo turn, **không** gọi provider (chi phí = 0) → SSE `budget` → `error` (`BUDGET_EXCEEDED`, `retryable: false`) → `done(finishReason: 'error')`; lượt bị chặn vẫn ghi **1 dòng `request_logs`** (cost 0, `error = 'BUDGET_EXCEEDED'`).
  - **Extension:** `apps/extension/src/lib/budgetClient.ts` (mới) · `apps/extension/src/sidepanel/store/budgetStore.ts` (mới — `useBudgetStore`, tách khỏi `chatStore.budget` = context budget) · `apps/extension/src/sidepanel/hooks/useBudgetStatus.ts` (mới — `GET /api/budget` khi mở panel) · `apps/extension/src/sidepanel/components/settings/BudgetSettings.tsx` (mới — section **"Ngân sách chi phí"**: bật · hạn mức USD · kỳ `Hôm nay`/`Tháng này` · ngưỡng cảnh báo % · toggle chặn · dòng "Đã dùng $x / $y" + nút "Lưu hạn mức"; lỗi API hiện **inline**, không crash drawer) · `apps/extension/src/sidepanel/components/BudgetBanner.tsx` (mới — banner dưới header: `warning` → `--warning` · `exceeded` → `--danger` + nút "Mở cài đặt") · `apps/extension/src/sidepanel/hooks/useChat.ts` → `case 'budget'` cập nhật `budgetStore` · `apps/extension/src/sidepanel/components/states/ErrorState.tsx` → case `'budget'`: **ẩn** nút "Thử lại", hiện nút "Mở cài đặt hạn mức" (`Gauge`) · `SettingsDrawer` + `ChatWorkspace` tích hợp · i18n `budget.*` + `state.error.openBudget` + `state.error.budgetHint` (`vi.ts` · `en.ts`).
  - **Test:** `packages/shared/tests/budget.test.ts` (18) · `apps/server/tests/budgetService.test.ts` (16) · `apps/server/tests/budgetRoute.test.ts` (6) · `apps/server/tests/chatBudget.test.ts` (5 — xác nhận **provider không được gọi** khi vượt hạn mức) · `apps/extension/tests/budgetSettings.test.tsx` (6) · `apps/extension/tests/budgetBanner.test.tsx` (5) · `apps/extension/e2e/budget.spec.ts` (3 — stub `/api/budget`, không cần BFF thật).
  - **Kiểm chứng live** (BFF + Docker + `.env` có K1): `GET /api/budget` → `state: "disabled"` · `PUT` hạn mức `0.01` USD → `state: "exceeded"` → `POST /api/chat` trả SSE `budget` (`exceeded`) → `error` `BUDGET_EXCEEDED` (`retryable: false`) → `done(finishReason: "error")` · `request_logs` ghi 1 dòng `error = BUDGET_EXCEEDED`, `cost_usd = 0` → **không** gọi provider · `PUT` sai (`limitUsd = -1`) → **400 `VALIDATION_ERROR`**.
- **Script `scripts/manual-checklist.mjs` (`pnpm manual:checklist`)** — tự động hoá phần "test tay" của [`MANUAL_TEST_GUIDE.md`](MANUAL_TEST_GUIDE.md) §11b: load extension **unpacked** (`apps/extension/dist`) vào **Chrome thật** (profile tạm → **không** đụng profile người dùng) → đi từng mục checklist → **lưu ảnh chụp** vào `artifacts/manual-test/` (git-ignore). Bao gồm cả kiểm chứng **fallback live**: khởi động BFF phụ ở port `8791` với `DEFAULT_PROVIDER=ollama` (Ollama không chạy → lỗi network **retryable**) + `PROVIDER_FALLBACKS=groq,openrouter` → gửi 1 lượt chat → đọc `GET /api/logs` để xác nhận `fallback_from`. **Kết quả 2026-11-10: 15/15 mục pass** (xem `MANUAL_TEST_GUIDE.md` §13b).
- **T-M2-02 — Model picker động + fallback chain runtime (FR-PROVIDER-03/04)**
  - **Server — danh sách model động:** `GET /api/providers/:id/models` (`apps/server/src/routes/providers.ts`) → `listProviderModels()` (`apps/server/src/services/providerService.ts`) → `ProviderAdapter.discoverModels?(apiKey)` (`apps/server/src/providers/types.ts`). `openaiCompatible.ts` (`groq` · `openrouter`) gửi header `Authorization: Bearer` · `gemini.ts` gửi header `x-goog-api-key` → trước đây `GET /models` **không** có key → provider trả 401 → luôn rơi về danh sách tĩnh. Response `ProviderModelsResponse` = `{ providerId, models, source }` với `source: 'live' | 'fallback'` (adapter không implement `discoverModels` → server tự fallback về `preferredModels`).
    - Contract shared: `packages/shared/src/constants.ts` (`API_ROUTES.providerModels`) · `packages/shared/src/schemas/provider.ts` (`providerModelsResponseSchema` · `providerModelSourceSchema`).
  - **Server — fallback chain runtime:** `apps/server/src/services/chatService.ts` lặp qua chuỗi ứng viên (provider được chỉ định → `registry.getFallbackChain()`); provider **không có key** hoặc **không hỗ trợ vision** → bỏ qua (không tốn lượt thử). Fallback **chỉ** khi lỗi `retryable` **và** `streamedToken === false` (đã stream dở thì fallback sinh nội dung trùng lặp) → lỗi 401/403 **không** fallback, giữ nguyên hành vi M1. Khi chuyển provider → **tính lại** `contextBudget` + `messagesForProvider` theo context window của provider mới.
  - **SSE event mới `provider_switch`** (`packages/shared/src/events.ts`): `{ type, from, to, reason, model }` — phát **trước** token đầu tiên của provider mới.
  - **Migration `0002_certain_vector.sql`** — cột mới `request_logs.fallback_from` (`text`, nullable) lưu provider đã lỗi → truy vết được lượt chat nào đã fallback. Cập nhật `apps/server/src/db/schema.ts` + `apps/server/src/services/requestLogService.ts` + `packages/shared/src/schemas/logs.ts`.
  - **Extension — `ModelPicker`** (`apps/extension/src/sidepanel/components/ModelPicker.tsx`): Radix `Popover` ở header panel · danh sách provider (`GET /api/providers`, chỉ provider `available`) → danh sách model của provider đó · **> 12 model** thì có ô tìm kiếm · đổi provider → **xoá model đã chọn** · nút "Về mặc định". Lựa chọn lưu `chrome.storage.local` key `sidekick.modelSelection` (`apps/extension/src/lib/modelSelection.ts` — module thuần, **không** Zod để giữ bundle content script nhỏ) → persist qua reload, dùng cho **mọi** lượt chat sau (gửi `provider` + `model` trong `POST /api/chat`). Nút trigger hiện provider/model **đang thật sự chạy** (từ SSE `meta`).
  - **Extension — phản ứng `provider_switch`** (`apps/extension/src/sidepanel/hooks/useChat.ts`): đổi chip provider ở header + ghi provider thật vào bubble + **toast** "Đã chuyển sang provider X" (i18n `providerSwitch.toast`).
    - **Test:** `apps/server/tests/providerModelsRoute.test.ts` (4) · `apps/server/tests/fallbackChain.test.ts` (6) · `apps/extension/tests/modelSelection.test.ts` · `providerModelsClient.test.ts` · `modelPicker.test.tsx` · `useChatM2.test.ts` · `apps/extension/e2e/modelPicker.spec.ts` (3).
- **T-M2-03 — Hiển thị token & chi phí (FR-PROVIDER-05)**
  - `apps/extension/src/lib/costFormat.ts` (mới) — `formatCostUsd()`: 4 chữ số thập phân (chi phí nhỏ như `0.0004` không bị làm tròn mất) · `0` → chuỗi rỗng (provider local → không hiện `$0.0000` gây hiểu nhầm).
  - `ChatMessage.costUsd` (`apps/extension/src/sidepanel/store/chatStore.ts`) — lấy từ SSE `usage` (`apps/extension/src/sidepanel/hooks/useChat.ts`) → chi phí do **server** tính từ `PROVIDER_PRICING` → UI **không** lệch với giá thật.
  - `apps/extension/src/sidepanel/components/chat/UsageBadge.tsx` (mới) — badge dưới bubble assistant: `↑ {tokensIn} ↓ {tokensOut} token · ~ $0.0123` · chưa có `usage` event → **không** render rỗng.
  - `apps/extension/src/sidepanel/components/settings/UsageSettings.tsx` (mới) + `apps/extension/src/lib/usageClient.ts` (mới) — section **"Chi phí & sử dụng"** trong `SettingsDrawer`: `GET /api/usage` → tổng token + tổng chi phí + bảng phân rã **theo ngày** (`byDay[]`) · khoảng `today/7d/30d/all` + nút làm mới.
  - **Test:** `apps/extension/tests/costFormat.test.ts` · `usageBadge.test.tsx` · `usageSettings.test.tsx`.
- **T-M2-03 (bổ sung) — Bộ chọn khoảng thời gian trong section "Chi phí & sử dụng"**
  - `apps/extension/src/sidepanel/components/settings/UsageSettings.tsx` — 4 nút `Hôm nay / 7 ngày / 30 ngày / Tất cả` (mặc định `7d`) → tính mốc `from` (**ISO 8601**, canh đầu ngày theo giờ local) → `GET /api/usage?from=…`. Khoảng `all` → **không** gửi `from` (lấy toàn bộ). Đổi khoảng → gọi lại API (không cần bấm "Làm mới").
  - i18n: `usage.settings.rangeLabel` + `usage.settings.range.{today,7d,30d,all}` (`vi.ts` · `en.ts`).
  - **Test:** `apps/extension/tests/usageSettings.test.tsx` (+3 test: mặc định `7d` · đổi khoảng → `from` đúng mốc đầu ngày · khoảng `all` → không có tham số `from`) · `apps/extension/e2e/modelPicker.spec.ts` (mở rộng: đổi khoảng không crash).

### Fixed
- **Skill: server chưa thay `{input}` bằng câu hỏi thật + chưa strip token `/ten-skill` lần 2** (T-M2-04 — sửa trong lúc audit) — `apps/server/src/services/chatService.ts` chỉ nối `buildSkillInstruction(template)` vào **system prompt**, còn `applySkillTemplate()` + `stripSkillToken()` (đã có trong `packages/shared/src/skill.ts` và đã được mô tả trong docs) thì **chưa** được gọi → prompt mẫu với placeholder `{input}` bị model nhận **dạng rỗng** (chỉ còn phần chỉ dẫn), và token `/ten-skill` có thể lọt xuống model nếu client quên strip. Đã sửa `buildProviderMessages()`: **user turn cuối cùng** (câu hỏi đang trả lời) được ghi đè bằng `applySkillTemplate(skill.promptTemplate, stripSkillToken(question, skill.name))` → câu hỏi xuất hiện đúng **1 lần**, token `/ten-skill` bị loại ở **cả 2 lớp** (client + server). Chỉ áp dụng cho turn cuối → turn `continue` / `regenerate` không bị ghi đè nhầm. Bổ sung 3 test (`apps/server/tests/chatSkill.test.ts` 7 → **10**): token bị strip · câu hỏi rỗng → `SKILL_DEFAULT_INPUT` · template không có `{input}` → câu hỏi được append.
- **i18n tiếng Việt của section "Ngân sách chi phí"** — chuỗi mới trong `apps/extension/src/i18n/vi.ts` viết **không dấu** (`'Ngan sach chi phi'`) → UI hiện sai chữ và test E2E không tìm thấy text. Đã sửa sang **có dấu** đầy đủ (`'Ngân sách chi phí'` · `'Mở cài đặt hạn mức'` · …) và chuyển placeholder `budget.settings.spentOfLimit` từ `${spent}` sang `{spent}` (đúng cú pháp `formatMessage()` — `${...}` **không** được thay thế).
- **`GET /api/usage` trả 500 khi Docker Desktop chưa chạy** — BFF báo `db: "down"` nhưng `/api/usage` ném lỗi `INTERNAL_ERROR` thay vì trả thông báo dễ hiểu. **Nguyên nhân gốc:** Postgres chạy trong container `sidekick-db` → Docker Desktop tắt là mất DB. Đã xác nhận lại: mở Docker → `sidekick-db` healthy → `/api/usage` trả `200` với `byDay[]` đúng, và bộ lọc `?from=` hoạt động (from hôm nay → `totalTokens: 0`, from 3 ngày trước → đủ 3 ngày). **Lưu ý vận hành:** `pnpm dev:server` phải chạy **sau** `docker compose up -d`, nếu không thì `/api/usage` + `/api/logs` trả 500.
- `packages/shared/tests/events.test.ts` — assert `CHAT_EVENT_TYPES` còn **8** event type trong khi union đã có **9** (thêm `provider_switch` ở T-M2-02) → `pnpm test` fail ở `packages/shared`. Sửa thành **9** + thêm 2 test: parse `provider_switch` + từ chối event thiếu `to`.
- **Flake E2E** (không phải hồi quy): `e2e/contextCache.spec.ts > trang đang lỗi → fallback về nội dung đã cache` fail 1 lần khi chạy song song (`toHaveLength` trên `undefined`) → chạy lại riêng file: **3/3 pass**; chạy lại cả suite: **91/91 pass** → tải song song. Ghi nhận trong `docs/HANDOFF.md` §2.
- **Flake E2E lần 2 (2026-11-10, môi trường — không phải hồi quy code):** 1 lần chạy `pnpm test:e2e` cho ra **4 failed / 87 passed** và mất **52 phút** (bình thường ~4–5 phút). Nguyên nhân: Groq trả **413 TPM** (`Limit 8000, Requested 24413`) → server fallback sang OpenRouter chậm hơn → timeout chuỗi. Chạy lại ngay sau đó: **91/91 pass trong 3.9 phút**. Bài học: E2E phụ thuộc **provider thật** → tỉ lệ lỗi phụ thuộc quota provider, không phải logic của repo.
- **Fix rò rỉ tiến trình trong `scripts/manual-checklist.mjs`:** `child.kill()` chỉ giết **wrapper** (`cmd.exe` của `pnpm.cmd`) → tiến trình con (`node` của `tsx`) vẫn chạy và **giữ port `8791`** → BFF phụ sót lại sau khi script kết thúc (phát hiện qua `netstat -ano` → PID 22128). Đã thay bằng `killProcessTree()`: Windows dùng `taskkill /PID <pid> /T /F` (giết cả cây tiến trình), POSIX dùng `process.kill(-pid, 'SIGTERM')`. Đã verify: chạy script xong → port `8791` **được giải phóng**.

### Changed
- **Checklist parity §E: 32/35 = 91.4% → 33/35 = 94.3%** (T-M2-03 đóng dòng "Token/cost hiển thị") — `docs/COMPARISON_MATRIX.md` §E + §E.1.3 (mới) · `docs/IMPLEMENTATION_PLAN.md` §3.1u.2 · `docs/REQUIREMENTS.md` §4.6 (AC của FR-PROVIDER-03/04/05).
- **Phạm vi M2 được chốt lại (2026-11-10):** **T-M2-01 đẩy lại** — quyết định user: **không thêm provider mới** (OpenAI/Anthropic) → giữ nguyên `PROVIDER_IDS` (`mock · groq · openrouter · gemini · ollama`), `packages/shared/src/constants.ts` **không đổi**, **không** migration bảng provider. Phần "model list động" của T-M2-01 đã thực hiện xong trong T-M2-02. **T-M2-03 đóng**; phần budget cap (FR-PROVIDER-06) tách ra **T-M2-03b** → **đã xong 2026-11-10**.
- **Đóng M1 (Milestone Parity) — tag `v0.2`** (`docs/COMPARISON_MATRIX.md` §E · §E.1 · `docs/IMPLEMENTATION_PLAN.md` §3.1u · `docs/REQUIREMENTS.md` §9 · `docs/README.md` · `AGENTS.md` §6 · `docs/HANDOFF.md` §2)
  - **Checklist parity §E chuẩn hoá:** **32 dòng** đã implement trước đây ghi `- [ ]` → `- [x]` (25 dòng). Danh sách đầy đủ 35 dòng: **32/35 = 91.4%** ✅ (ngưỡng gate ≥ 90%).
  - **Cross-check độc lập theo dòng "Must" ở §A/§B:** **21/23 = 91.3%** ✅ (ngưỡng ≥ 90%).
  - **3 dòng còn mở — đều có task kế tiếp, không phải thiếu sót:** Skills `/` + library (→ T-M2-04/06/21 — Chrome Gemini cần đăng nhập Google cho Skills, Sidekick cố ý không phụ thuộc tài khoản hãng) · token/cost **UI** (→ T-M2-03; phần **log** đã đầy đủ ở M1) · Direct/BYOK fallback khi BFF down (→ T-M1-15/16, ⏸ tạm dừng 2026-11-08).
  - **`COMPARISON_MATRIX.md` §D** — dòng "Skills": Sidekick `✅` → `➖` + gap `S (M2 — T-M2-04/06/21)` (sửa lại mâu thuẫn với §E: Skills **chưa** implement ở M1).
  - **`COMPARISON_MATRIX.md` §E.1.2** — ghi rõ **bằng chứng** từng vế của gate (15 fixture HTML + E2E trang thật + PDF + YouTube caption + `request_logs` API) + **giới hạn**: bộ "10 trang thật" là **dataset eval M2** (`tasks.json` hiện rỗng `[]`) → điền ở T-M2-12 → **không** tuyên bố đã đạt 8/10 trang thật ở M1.
  - **Số liệu test chốt lúc đóng M1:** shared 243 · server 377 · extension 706 · eval 11 = **1337 unit** + **88 E2E** (23 file).

### Docs
- **T-M2-03b — tài liệu budget cap (FR-PROVIDER-06)** — `docs/SYSTEM_DESIGN.md` **§7.24** (mới) + §4.1 (endpoint `GET/PUT /api/budget`) + §4.3 (union SSE có `budget`) + §5 (bảng `budget_settings`) · `docs/REQUIREMENTS.md` FR-PROVIDER-06 → **✅ ĐÃ IMPLEMENT** + AC chi tiết + bảng traceability §11.1 · `docs/DESIGN_SYSTEM_BRIEF.md` **§3.7.3** (mới — spec `BudgetSettings` + `BudgetBanner` + a11y) + §3.7 traceability · `docs/IMPLEMENTATION_PLAN.md` row `T-M2-03b` ✅ + **§4.2** (kết quả M2 — trạng thái · verify · ảnh hưởng gate) · `docs/COMPARISON_MATRIX.md` dòng **C6** (ghi budget cap là tính năng độc quyền — **không** thêm dòng §E → giữ nguyên **33/35 = 94.3%**) · `docs/HANDOFF.md` §2 (tiến độ M2 **3/23** + tóm tắt T-M2-03b) · `docs/README.md` + `AGENTS.md` §6 + `docs/CONTEXT_HANDOFF_2026-11-09.md` (refresh) + `docs/MANUAL_TEST_GUIDE.md` §14 (budget cap → ✅).
- **Đồng bộ toàn bộ tài liệu theo trạng thái M2 (2026-11-10)** — 4 nhóm thay đổi, **không** đụng code (chỉ sửa `docs/`):
  - **`docs/CONTEXT_HANDOFF_2026-11-09.md`** — **refresh** (tên file giữ nguyên theo lần tạo 2026-11-09, thêm dòng cảnh báo ở header): "M2 ⬜ Chưa bắt đầu" → **🟡 Đang làm 2/22 task** · "**42 task**" → **22 task** (đếm đúng bảng §4) · "T-M1-13 đã defer" → **đã xong 2026-11-09** (commit `0a8d9d6`) · `HEAD 3211d9c` → **`000ddcc`** · số liệu test `1311 unit / 81 E2E` → **`1394 unit / 91 E2E`** (24 file) · thêm hàng `pnpm manual:checklist` **15/15 mục** · roadmap §8 bỏ "Ưu tiên 1 — T-M1-13" (đã xong) → thay bằng **T-M2-12 (dataset eval)** + bảng thứ tự mới. **Lý do:** file này là bàn giao context — đọc sai số liệu cũ dẫn tới kế hoạch sai.
  - **`docs/IMPLEMENTATION_PLAN.md`** — thêm **row `T-M2-03b`** (budget cap · FR-PROVIDER-06) vào bảng task §4 (trước đó chỉ là `TODO` trong ghi chú → không theo dõi được) · thêm mục mới **§4.1 "Kết quả M2 — T-M2-02 + T-M2-03"** theo đúng pattern `§3.1x` của M1 (trạng thái task + verify + ảnh hưởng gate parity + việc tiếp theo) · rút gọn block "Ghi chú phạm vi M2" còn trùng nội dung với §4.1 → trỏ sang §4.1 · cập nhật định mức M2 **22 → 23 task** (~39 → ~40 ngày công). **Lý do:** M1 có đủ mục kết quả cho từng task, M2 thì không → lệch pattern và mất bằng chứng.
  - **Version header 6 file docs** — cập nhật theo đúng bảng trạng thái ở `docs/README.md`: `REQUIREMENTS.md` v1.0 → **v2.3** · `SYSTEM_DESIGN.md` v1.0 → **v2.4** · `DESIGN_SYSTEM_BRIEF.md` v1.0 → **v2.0** · `IMPLEMENTATION_PLAN.md` v1.0 → **v2.4** · `COMPARISON_MATRIX.md` v1.0 → **v2.3** · `EVAL_PLAN.md` v1.0 → **v1.4** (đều kèm ngày cập nhật). **Lý do:** header vẫn ghi `v1.0 · 2026-11-03` trong khi bảng trạng thái đã là `v2.x` → vi phạm rule `docs-sync.mdc` §5 ("đổi số version → cập nhật mọi nơi đang nhắc tới số đó").
  - **`docs/README.md` · `docs/HANDOFF.md`** — bảng trạng thái: `IMPLEMENTATION_PLAN.md` v2.3 → **v2.4** (mô tả row `T-M2-03b` + §4.1) · dòng `CONTEXT_HANDOFF` ghi rõ đã refresh · milestone M2 **2/23 task** · `HANDOFF.md` §2 thêm dòng trỏ tới §4.1.
- `docs/MANUAL_TEST_GUIDE.md` — **§13b** (mới) "Script chạy checklist test tay tự động" (`pnpm manual:checklist`) + bảng kết quả **15/15 mục pass** ngày 2026-11-10 · §13 số liệu test cũ → **1394 unit** + **91 E2E** · §15 ghi chú mục 19–21 đã kiểm chứng tự động (nhưng vẫn nên bấm tay 1 lần để xác nhận toast render).
- `docs/HANDOFF.md` — §2 số liệu **1394 unit** + **91 E2E** + kết quả kiểm chứng live (model động 428 model · fallback `ollama → groq` · `fallback_from` trong DB) · ghi rõ `pnpm manual:checklist` là cách chạy checklist §11b một lần.
- `docs/README.md` · `AGENTS.md` — đồng bộ số liệu test + nhắc lệnh `pnpm manual:checklist`.
- Sửa link `[EVAL_REPORT.md](EVAL_REPORT.md)` **chưa tồn tại** trong `EVAL_PLAN.md` §7 → đổi thành text thuần kèm mã task (`deliverable M2 — T-M2-17`) → mọi link `.md` trong `docs/` **đều resolve được** (rule `docs-sync.mdc` §5).
- `docs/README.md` — bảng tài liệu: thêm `CONTEXT_HANDOFF_2026-11-09.md`; bảng phiên bản docs cập nhật (11 file).
- `.gitignore` — ignore `.tmp-*.log` / `.tmp-*.err` (log tạm của dev server).

### Added
- **Contract eval dataset đồng bộ với `EVAL_PLAN.md` (nền cho T-M2-12/13)**
  - `packages/shared/src/schemas/eval.ts` (mới) — Zod schema là **nguồn sự thật** cho contract dataset: `EVAL_GROUPS` (**8 nhóm** theo `EVAL_PLAN.md` §3.2: `page_qa` · `summarize` · `cross_tab` · `writing` · `vision` · `doc_extract` · `video_transcript` · `general_qa`) · `evalGroupSchema` · `evalLangSchema` · `evalPageSchema` · `evalReferenceSchema` · `evalTaskSchema` (shape §3.1) · `evalTaskListSchema`. Export trong `packages/shared/src/index.ts`.
    - Nhóm `workflow` (§3.2.1, M4) **cố ý không** có trong `EVAL_GROUPS` → không làm dataset M2 bị reject.
    - Field **snake_case** (`snapshot_path` · `content_hash` · `key_points` · `must_include_facts` · `must_not_contain` · `expected_citations`) — dataset là JSON interchange, dùng chung với transcript thủ công của Edge/Gemini.
  - `apps/eval/src/types.ts` — bỏ `EVAL_GROUPS` cũ (`page_qa`/`summarization`/`rewrite`/`coding`/`comparison`) + shape `reference.answer/keyFacts` (**sai chuẩn `EVAL_PLAN.md`**) → **re-export** từ `@sidekick/shared`; giữ `EvalRunResult` + `EVAL_RUNS_PER_TASK = 3`.
  - `apps/eval/src/dataset.ts` — `validateTask()` dùng `evalTaskSchema.safeParse` (thay validate tay) → lỗi có **đường dẫn field** rõ ràng.
  - `apps/eval/tests/dataset.test.ts` (mới, 11 test) — fixture hợp lệ cho **từng** group + reject (group sai · `must_include_facts` sai kiểu · thiếu `page.snapshot_path` · thiếu `id` · `lang` sai · dataset không phải array) + `filterTasks`.
  - `apps/eval/dataset/tasks.json` **giữ rỗng `[]`** — đúng chuẩn M1; điền dataset thật là T-M2-12.
  - **Không** thêm dependency mới (Zod đã có sẵn) · **không** migration · **không** đổi API server.
  - Docs: `EVAL_PLAN.md` §3.1 (bảng field bắt buộc + ghi chú contract) + §3.2 (ghi chú `EVAL_GROUPS`) · `SYSTEM_DESIGN.md` §4.5 (mới) · `IMPLEMENTATION_PLAN.md` (ghi chú T-M2-12).
- **Parity "Panel giữ nguyên khi chuyển tab" — đã chứng minh bằng E2E**
  - `apps/extension/e2e/panelPersistence.spec.ts` (mới, 3 test) — mock `chrome.tabs` + stub SSE `/api/chat`:
    - đổi tab → gallery đổi `data-profile` theo trang mới.
    - đổi tab **khi đã có thread** → thread giữ nguyên (user + assistant) + panel **vẫn đọc lại tab mới** (đếm số lần `chrome.tabs.query`) → chứng minh panel thật sự phản ứng với sự kiện đổi tab, không phải "đơ" vì state đứng yên.
    - đổi tab lần 2 → thread vẫn giữ nguyên.
  - **Không** đổi code sản phẩm — hành vi đã đúng sẵn: side panel thuộc **cửa sổ** → Chrome giữ panel mở khi đổi tab (native) · React state của panel sống suốt (document không reload) · `useActivePage` chỉ cập nhật `page` (gợi ý theo trang), **không** đụng `chatStore` → không reset thread.
  - Docs: `SYSTEM_DESIGN.md` §7.21 (mới) · `COMPARISON_MATRIX.md` §E (dòng "Panel giữ nguyên khi chuyển tab" → `- [x]`).
- **T-M1-13 — Export cuộc trò chuyện (FR-CHAT-10)**
  - `apps/extension/src/lib/export.ts` (mới) — module **thuần** (không DOM / Zod / Chrome API): `buildMarkdownExport()` · `buildJsonExport()` · `buildExportFileName()`. File `.md` có metadata đầu file (thời điểm xuất ISO · conversation id · số tin nhắn) + metadata từng lượt assistant (provider · model · token in/out · request-id 6 ký tự — cùng slot với chip trong bubble) + danh sách nguồn `[N]`. File `.json` có `version` · `exportedAt` · `conversation{id,title}` · `messages[]{role,content,createdAt,provider?,model?,tokensIn?,tokensOut?,requestId?,citations?}` (field không có giá trị → **bỏ hẳn**, không để `undefined`).
  - `apps/extension/src/lib/downloadFile.ts` (mới) — `downloadTextFile()` dùng `Blob` + `URL.createObjectURL` + `<a download>`; **tái sử dụng** cho export settings (`DataSettings.tsx`) → chỉ 1 bản trong repo.
  - `apps/extension/src/sidepanel/components/chat/ExportMenu.tsx` (mới) — Radix `Popover` (đã có sẵn `components/ui/popover.tsx`) với 3 mục: **Sao chép Markdown** · **Xuất .md** · **Xuất .json** + toast kết quả (`sonner`).
  - `apps/extension/src/sidepanel/components/PanelHeader.tsx` — thêm prop `exportMenu?: ReactNode` (header chỉ lo vị trí, không cần biết chi tiết hành động).
  - `apps/extension/src/sidepanel/ChatWorkspace.tsx` — dựng `exportMessages` từ `activePathMessages(messages, path)` → chỉ xuất **đường đi active** (đúng nội dung user đang nhìn thấy).
  - i18n: `chat.export` · `chat.exportCopy` · `chat.exportMarkdown` · `chat.exportJson` · `chat.exportDefaultTitle` · `toast.exportCopied` · `toast.exportDone` · `toast.exportFailed` (VI + EN).
  - Test: `apps/extension/tests/export.test.ts` (mới, 15 unit test) + `apps/extension/e2e/export.spec.ts` (mới, 4 E2E test).
  - **Không** migration · **không** dependency mới · **không** permission mới · **không** đổi manifest.

### Added
- **`docs/MANUAL_TEST_GUIDE.md`** (mới) — hướng dẫn **cài đặt + test tay toàn bộ tính năng M1** cho người dùng (không phải agent):
  - §0 Tóm tắt nhanh (6 lệnh) · §1 Yêu cầu · §2 Cài đặt chi tiết (pnpm · Docker · migrate · `.env` K1 · build · load unpacked · dev mode).
  - §3 Onboarding 3 bước · §4 Chat (streaming · markdown/code/bảng · 4 hành động tin nhắn · CRUD hội thoại · 6 trạng thái lỗi) · §5 Context (gợi ý theo trang · đính kèm · `@` · bôi đen · citation · ngân sách · PDF/YouTube · cache) · §6 Ảnh · §7 Settings (7 section) · §8 Phím tắt 2 lớp · §9 Mở/toggle panel + context menu · §10 Responsive + a11y · §11 Kiểm tra `request_logs` · §12 Xử lý sự cố (11 lỗi thường gặp) · §13 Chạy test tự động · §14 Bảng "đã có / chưa có" · §15 Checklist 18 mục để đánh dấu.
  - Mọi tên nút / hành vi trong hướng dẫn đã được **đối chiếu với source thật** (`data-testid` · `i18n/vi.ts` · `manifest.json`).

### Fixed
- **Hồi quy bundle content script** — `dist/content.js` phình từ **13.87 kB** → **151 kB** (T-M1-17) → **~46 kB** (T-M1-20) vì kéo theo **Zod** + dictionary **đầy đủ**; nay **17.27 kB** (gzip 6.65 kB).
  - **Nguyên nhân T-M1-17** — `lib/i18n.ts` → `lib/settings.ts` → `@sidekick/shared` (barrel `index`) → toàn bộ bundle `zod` (~100 kB).
  - **Nguyên nhân T-M1-20** — `lib/i18n.ts` → `i18n/index.ts` → `i18n/vi.ts` + `i18n/en.ts` (dictionary đầy đủ ~34 kB).
  - **Cách sửa** — tách **2 tầng dictionary**:
    - `apps/extension/src/i18n/format.ts` (mới) — `formatMessage()` + `resolveLanguage()`, **không** import dictionary.
    - `apps/extension/src/i18n/outsidePanel.vi.ts` (mới) — **nguồn sự thật** của 4 khoá ngoài panel (`content.selectionButton` · `content.selectionButtonLabel` · `background.menu.open` · `background.menu.askSelection`).
    - `apps/extension/src/i18n/outsidePanel.en.ts` (mới) — bản EN (kiểu ràng buộc key).
    - `apps/extension/src/i18n/outsidePanel.ts` (mới) — `createOutsidePanelTranslator(language)`.
    - `apps/extension/src/i18n/surface.ts` (mới) — union kiểu `OutsidePanelKey` (suy ra từ `outsidePanel.vi.ts`).
    - `apps/extension/src/lib/i18nSurface.ts` (mới) — `getSurfaceTranslator()` cho content script + service worker.
    - `apps/extension/src/lib/storageKeys.ts` (mới) — khoá storage + `readStoredUiLanguage()` đọc **thuộc tính** trực tiếp, **không** validate bằng Zod.
    - `apps/extension/src/i18n/vi.ts` + `en.ts` — spread `outsidePanelViDictionary` / `outsidePanelEnDictionary` vào dictionary đầy đủ → **nguồn sự thật** vẫn là 1 chỗ.
    - `apps/extension/src/lib/i18n.ts` — dùng `readStoredUiLanguage()` (không Zod) + `createTranslator()` từ `@/i18n`.
    - `apps/extension/src/content/contentScript.ts` — dùng `getSurfaceTranslator()` thay `getTranslator()`.
    - `apps/extension/src/background/contextMenus.ts` — dùng `getSurfaceTranslator()`.
    - `apps/extension/src/lib/settings.ts` — re-export hằng khoá storage từ `storageKeys.ts` (giữ 1 nguồn sự thật).
  - **Guard hồi quy** — `apps/extension/tests/contentBundleGuard.test.ts` (mới, 10 test): duyệt **đệ quy đồ thị phụ thuộc** của `src/content/contentScript.ts` → chặn `@sidekick/shared` (barrel) · dictionary đầy đủ · `react` · `zod`; kèm assert `dist/content.js` **≤ 40 kB** + không chứa marker Zod.
    - > Guard dùng **đồ thị phụ thuộc**, không phải grep từng file — bản grep lọt lưới (đổi `contentScript.ts` sang import `../lib/i18n.js` vẫn xanh).
    - > `import type` bị **xoá khi build** → không báo động giả.
  - **Số test toàn repo:** 1301 → **1311 unit** (extension 681 → **691**) + 81 E2E (không đổi).
  - **Kích thước bundle:** `dist/content.js` **151 kB → 17.27 kB** (gzip 6.65 kB).
  - **Migration:** **không** có migration mới · **không** dependency mới · **không** permission mới · **không** đổi manifest.

### Removed
- **BYOK (K2 + K3) — tạm dừng theo quyết định user 2026-11-08** (T-M1-15 ⏸ · T-M1-16 ⏸)
  - `apps/extension/src/sidepanel/components/onboarding/StepProvider.tsx` — **gỡ ô nhập API key** + nút "Lưu & kiểm tra" → provider cần key mà chưa có **K1** chỉ hiện thông báo hướng dẫn (`data-testid="onboarding-key-required"`); luồng chọn provider + `onSelect` giữ nguyên.
  - `apps/extension/src/i18n/vi.ts` + `en.ts` — thêm `onboarding.provider.keyRequired`; **xoá** 8 key chỉ dùng cho luồng nhập key (`keyLabel` · `keyPlaceholder` · `keyHint` · `keyTooShort` · `keySaved` · `keyInvalid` · `keySaveFailed` · `saveAndTest`).
  - `apps/extension/tests/onboardingUi.test.tsx` — assert `onboarding-key-required` thay cho `onboarding-api-key`.
  - **Server giữ nguyên** (`POST /api/providers/keys` · `GET/DELETE /api/providers/keys/:id` · `POST /api/providers/keys/:id/test` + bảng `provider_keys` AES-256-GCM) → mở lại được bằng cách thêm lại UI, **không** migration.
  - **Không** đổi schema · **không** dependency mới · **không** permission mới.

### Added
- **T-M1-20 — Responsive 320–640px + a11y pass cơ bản (FR-UX-06/07/09/10, NFR-A11Y-01..05)**
  - `apps/extension/src/sidepanel/App.tsx` — thêm `<SkipLink />` (anchor `#sidekick-composer-input`, `sr-only focus:not-sr-only`).
  - `apps/extension/src/sidepanel/ChatWorkspace.tsx` — thread dùng `role="log"` + `aria-label` (**không** đặt `aria-live` → screen reader không đọc lại lịch sử cũ) · `overflow-x-hidden` · dịch chuỗi `chat.oldVersions`.
  - `apps/extension/src/sidepanel/components/Composer.tsx` — `id="sidekick-composer-input"` · `t('composer.hint')` (bỏ literal sót từ T-M1-17) · `aria-hidden="true"` cho icon trang trí · `min-w-0`.
  - `apps/extension/src/sidepanel/components/chat/MessageContent.tsx` — `role="article"` + `aria-live="polite"` + `aria-atomic="false"` + `aria-relevant="additions text"` **chỉ khi** đang stream.
  - `apps/extension/src/sidepanel/components/chat/ConversationList.tsx` — tab nhóm conversation có `id` + `aria-controls="conversation-panel"` + roving `tabIndex`; panel có `role="tabpanel"`.
  - `apps/extension/src/sidepanel/components/MessageBubble.tsx` — dòng "Đang tạo câu trả lời..." dùng `role="status"` · `min-w-0` · focus ring chuẩn hoá.
  - `apps/extension/src/components/ui/dialog.tsx` — nút đóng `h-6 w-6` + `aria-label={t('common.close')}` + `max-w-full`.
  - `apps/extension/src/sidepanel/components/context/{ContextChips,ContextNotice}.tsx` · `chat/PromptGallery.tsx` · `composer/AttachmentTray.tsx` — icon-button lên `h-6 w-6` (≥ 24px, WCAG 2.2 §2.5.8) · focus ring chuẩn hoá.
  - `apps/extension/src/sidepanel/index.css` — `#root` dùng `min-width: min(var(--panel-min-width), 100%)` → không tràn ngang khi viewport < 320px.
  - `apps/extension/src/i18n/useI18n.ts` (mới) — hook dùng chung để `components/ui/dialog.tsx` dịch được mà không phụ thuộc tầng `sidepanel/`; `sidepanel/hooks/useI18n.ts` re-export.
  - `apps/extension/src/i18n/vi.ts` + `en.ts` — thêm key `composer.hint` · `a11y.skipToComposer` · `chat.oldVersions` · `chat.threadLabel`.
  - **Test** — `apps/extension/tests/a11y.test.tsx` (mới, 9 test) · `apps/extension/e2e/responsive.spec.ts` (mới, 5 kịch bản 320/480/640px).
  - **Số test toàn repo:** 1292 → **1301 unit** (extension 672 → **681**) + 76 → **81 E2E**.
  - **Migration:** **không** có migration mới · **không** dependency mới · **không** permission mới · **không** đổi manifest.

### Fixed
- **Chuỗi literal còn sót sau T-M1-17** — `composer.hint` ("Enter để gửi · Shift+Enter để xuống dòng · @ để đính kèm tab") trong `Composer.tsx` chưa được dịch → nay lấy từ `t('composer.hint')`.
- `chat.oldVersions` ("Phien ban cu") + nhãn thread (`role="log"`) → chuyển sang i18n (`chat.oldVersions` · `chat.threadLabel`).
- `aria-label="Đóng"` cứng của nút đóng Dialog → `t('common.close')`.
- **Panel tràn ngang khi bề rộng < 320px** — `#root` có `min-width: 320px` cứng → nay `min(var(--panel-min-width), 100%)`; drawer + chip nguồn thêm `max-w-full` / `max-w-[min(180px,100%)]`.
- **Icon-button < 24px** (`p-[2px]` + icon `h-3` ≈ 18px, dưới WCAG 2.2 §2.5.8) → mọi icon-button lên `h-6 w-6` (≥ 24px).
- **Focus ring không đồng nhất** — 12 chỗ dùng `focus-visible:outline-none focus-visible:ring-[var(--focus-ring)]` → chuẩn hoá về `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]`.
- **Screen reader đọc lại toàn bộ lịch sử chat khi streaming** → live region chỉ đặt trên phần **vừa** stream (`MessageContent`: `role="article"` + `aria-live="polite"` + `aria-atomic="false"` + `aria-relevant="additions text"`); thread (`role="log"`) không đặt `aria-live`.

### Docs
- **T-M1-20** — `docs/SYSTEM_DESIGN.md` thêm **§7.19** (ràng buộc layout · focus ring 1 pattern · live region đúng chỗ · skip-link · roving tabindex · tap target 24px · dọn literal i18n) · `docs/REQUIREMENTS.md` FR-UX-06/07/09/10 + NFR-A11Y-01..05 ✅ + **§4.9.5** (AC chi tiết) + bảng traceability §11.1 · `docs/DESIGN_SYSTEM_BRIEF.md` **§5** (checklist a11y → đã tick) + **§5.1** (quy ước a11y bắt buộc) + bảng traceability §6 · `docs/IMPLEMENTATION_PLAN.md` T-M1-20 ✅ (2026-11-08) + **§3.1t** (bảng kết quả) · `docs/COMPARISON_MATRIX.md` checklist §E: responsive + a11y ✅ T-M1-20 · `docs/HANDOFF.md` · `AGENTS.md` §6.

### Added
- **T-M1-18 — Keyboard shortcuts cấu hình được (FR-UX-01)**
  - `apps/extension/src/lib/shortcuts.ts` (mới) — hàm thuần: `normalizeShortcut()` · `isReservedShortcut()` · `parseShortcut()` · `shortcutFromKeyboardEvent()` · `matchesShortcut()` · `formatShortcutLabel()` · `RESERVED_CHROME_SHORTCUTS` (**28** tổ hợp dành riêng của trình duyệt) · `DEFAULT_SHORTCUTS` · `SHORTCUT_COMMANDS`.
  - `apps/extension/src/lib/shortcutStorage.ts` (mới) — đọc/ghi `chrome.storage.local` key `sidekick.shortcuts`: `readShortcuts()` · `writeShortcut()` · `clearShortcut()` · `resolveShortcut()`.
  - `apps/extension/src/lib/shortcutProtocol.ts` (mới) — hằng `SHORTCUT_TOGGLE_ACTION = 'sidekick:shortcut-toggle'` + type guard `isShortcutToggleMessage()` (thuần, **không** kéo Zod vào content script).
  - `apps/extension/src/lib/shortcutBridge.ts` (mới) — service worker nhận message toggle → thử `chrome.sidePanel.open()`.
  - `apps/extension/src/content/shortcutListener.ts` (mới) — content script bắt `keydown` → khớp shortcut nhanh → gửi message toggle (bundle IIFE vẫn **không** chứa React).
  - `apps/extension/src/sidepanel/components/settings/ShortcutsSettings.tsx` (mới) — section "Phím tắt" trong Settings: **2 lớp** (native của Chrome đọc bằng `chrome.commands.getAll()` + nút mở `chrome://extensions/shortcuts` · nhanh của Sidekick bấm để bắt phím + "Về mặc định").
  - `apps/extension/src/sidepanel/components/settings/SettingsDrawer.tsx` — thêm `<ShortcutsSettings />` (7 section thay vì 6).
  - `apps/extension/src/i18n/vi.ts` + `en.ts` — thêm **14** key `settings.shortcuts.*`.
  - `apps/extension/tests/shortcuts.test.ts` (mới, 18 test) · `apps/extension/tests/shortcutStorage.test.ts` (mới, 7 test) · `apps/extension/tests/shortcutsSettings.test.tsx` (mới, 5 test).
  - `apps/extension/e2e/shortcuts.spec.ts` (mới) — 3 kịch bản E2E: hiển thị · đổi & persist · về mặc định.
  - **Ràng buộc Chrome MV3:** Chrome **không** có `chrome.commands.update()` / `reset()` (API riêng của Firefox) → thiết kế 2 lớp thay vì giả lập API không tồn tại. Chi tiết: `SYSTEM_DESIGN.md` §7.18.
  - **Số test toàn repo:** 1263 → **1292 unit** (extension 643 → **672**) + 73 → **76 E2E**.
  - **Migration:** **không** có migration mới · **không** dependency mới · **không** permission mới · **không** đổi manifest.

### Added
- **T-M1-17 — i18n VI/EN (FR-SETTINGS-06)**
  - `apps/extension/src/i18n/vi.ts` (mới) — `viDictionary` là **nguồn sự thật** của danh sách key (`const` object) → `TranslationKey = keyof typeof viDictionary` · `Dictionary = Record<TranslationKey, string>`.
  - `apps/extension/src/i18n/en.ts` (mới) — `enDictionary: Dictionary` → **thiếu/thừa key = lỗi `pnpm typecheck`** (không cần test runtime để bắt).
  - `apps/extension/src/i18n/index.ts` (mới) — `getDictionary()` (fallback VI) · `resolveLanguage()` · `formatMessage()` (placeholder `{name}`) · `createTranslator()`.
  - `apps/extension/src/i18n/context.ts` (mới) — `I18nContext` **không JSX** → content script + service worker không import React.
  - `apps/extension/src/lib/i18n.ts` (mới) — `readUiLanguage()` (đọc storage) · `translatorFor()` · `getTranslator()` (cho nơi không phải React).
  - `apps/extension/src/sidepanel/hooks/useI18n.ts` (mới) — trả `{ t, language }`.
  - `apps/extension/src/sidepanel/components/I18nProvider.tsx` (mới) — bọc ở `App.tsx`; `useMemo` tạo `t` mới khi đổi ngôn ngữ → re-render toàn bộ cây.
  - **Test** — `apps/extension/tests/i18n.test.tsx` (mới, 20) · `apps/extension/e2e/i18n.spec.ts` (mới, 2 kịch bản).
    - **Số test toàn repo:** 1243 → **1263 unit** (shared 243 · server 377 · extension **643**) + 71 → **73 E2E**.
    - **Migration:** **không** có migration mới · **không** dependency mới (không `i18next`) · **không** permission mới · **không** đổi manifest · **không** component UI mới.

### Changed
- **T-M1-17 — Toàn bộ side panel đã dịch VI/EN** — mọi chuỗi literal trong component → `t('key')`.
  - `apps/extension/src/sidepanel/App.tsx` — **nâng `useSettings()`** lên đây → `settings` + `onSettingsChange` truyền xuống `ChatWorkspace` → `SettingsDrawer`; bọc `<Onboarding>` + `<ChatWorkspace>` trong `<I18nProvider language={settings.uiLanguage}>` → đổi ngôn ngữ áp dụng **ngay**, **không reload**.
  - `apps/extension/src/sidepanel/ChatWorkspace.tsx` — nhận `settings` + `onSettingsChange` · truyền xuống `SettingsDrawer` · dịch toast + banner offline + tiêu đề drawer.
  - `apps/extension/src/sidepanel/components/settings/SettingsDrawer.tsx` — dùng props; **fallback** về `useSettings()` khi không truyền props (test render độc lập vẫn chạy).
  - `apps/extension/src/sidepanel/components/settings/LanguageSettings.tsx` — **xoá** dòng cảnh báo "Giao diện hiện vẫn dùng tiếng Việt…" (không còn đúng) · options dịch động.
  - `apps/extension/src/sidepanel/components/settings/{Theme,Appearance,Privacy,Data,Endpoint}Settings.tsx` — options động qua `t()` · nhãn + toast + confirm dịch.
  - Component khác — `PanelHeader` · `Composer` · `MessageBubble` · `MessageActions` · `MessageEditBox` · `CodeBlock` · `Citation{Chip,Popover,List}` · `PromptGallery` · `SummarizeButton` · `ConversationList` · `ConfirmDialog` · `states/{ConnectionBadge,LoadingState,ErrorState}` · `context/{ContextChips,ContextBudget,ContextNotice,MentionPopover}` · `composer/AttachmentTray` · `chat/ScrollToBottomButton` · `onboarding/{Onboarding,StepPermissions,StepProvider,StepTry}` · `hooks/useChat` · `hooks/useImageAttachments`.
  - `apps/extension/src/content/selectionButton.ts` — nhận `label` + `ariaLabel` từ caller (bỏ hằng tiếng Việt).
  - `apps/extension/src/content/contentScript.ts` — `localizeSelectionButton()` đọc storage → cập nhật text/aria-label nút nổi trong Shadow DOM.
  - `apps/extension/src/background/contextMenus.ts` — 2 nhãn menu lấy từ `await getTranslator()`.
  - `apps/extension/src/background/serviceWorker.ts` — `chrome.storage.onChanged` → đổi `sidekick.settings` → gọi lại `registerContextMenus()` (idempotent) → nhãn menu đổi theo ngôn ngữ, **không cần reload trình duyệt**.

### Fixed
- Section "Ngôn ngữ" trong Settings không còn hiện dòng cảnh báo sai ("Giao diện hiện vẫn dùng tiếng Việt…") — sau T-M1-17 toàn bộ UI **đã** dịch được.

### Docs
- `docs/SYSTEM_DESIGN.md` — thêm **§7.17** (kiến trúc module i18n · luồng đổi ngôn ngữ · phạm vi dịch · bảng kiểm thử).
- `docs/REQUIREMENTS.md` — FR-SETTINGS-06 đánh dấu ✅ T-M1-17 + cập nhật AC chi tiết §4.8.1 + bảng traceability §11.1.
- `docs/DESIGN_SYSTEM_BRIEF.md` — thêm **§3.11** (i18n VI/EN — không component mới, chỉ thay chuỗi literal) + cập nhật traceability §6.
- `docs/IMPLEMENTATION_PLAN.md` — T-M1-17 ✅ (2026-11-08) + thêm **§3.1r** (bảng kết quả) + cập nhật traceability.
- `docs/COMPARISON_MATRIX.md` — checklist §E: i18n VI/EN ✅ T-M1-17.

### Docs
- **T-M1-18** — `docs/SYSTEM_DESIGN.md` thêm **§7.18** (2 lớp phím tắt · ràng buộc Chrome MV3 `commands.update` không tồn tại · deny-list · luồng lưu trữ) · `docs/REQUIREMENTS.md` FR-UX-01 ✅ + **§4.9.4** (AC chi tiết) · `docs/DESIGN_SYSTEM_BRIEF.md` thêm **§3.7.1** (spec `ShortcutsSettings`) + cập nhật bảng traceability §3.7 · `docs/IMPLEMENTATION_PLAN.md` T-M1-18 ✅ (2026-11-08) + **§3.1s** (bảng kết quả) · `docs/COMPARISON_MATRIX.md` checklist §E: phím tắt cấu hình được ✅ T-M1-18 · `docs/HANDOFF.md` · `AGENTS.md` §6.

### Added
- **T-M1-14 — Request logging đầy đủ vào `request_logs` (NFR-MAINT-04 + FR-CONTEXT-12 + NFR-REL-01)**
  - `packages/shared/src/pricing.ts` (mới) — `PROVIDER_PRICING` (USD / 1M token input·output, snapshot) · `resolveModelPricing()` (model lạ → giá mặc định của provider) · `calculateCostUsd({ provider, model, tokensIn, tokensOut })` → làm tròn **6** chữ số (khớp `numeric(12,6)`) · `mock`/`ollama` → `0`.
  - `packages/shared/src/schemas/logs.ts` (mới) — `requestLogSummarySchema` (**metadata only** — không `promptText`/`responseText`/`contextSnapshot`) · `logsResponseSchema` (`{ items, total }`) · `usageResponseSchema` (`{ totalTokens, totalCostUsd, byDay[] }`) · `logsQuerySchema` · `usageQuerySchema`.
  - `packages/shared/src/schemas/provider.ts` — `providerStreamRequestSchema` += `requestId?: string`.
  - `packages/shared/src/constants.ts` — `API_ROUTES.logs` + `API_ROUTES.usage`.
  - `packages/shared/src/index.ts` — export `./pricing.js` + `./schemas/logs.js`.
  - `apps/server/src/middleware/requestId.ts` (mới) — đọc `X-Request-Id` (charset an toàn, ≤ 200 ký tự) hoặc `randomUUID()` → `req.sidekickRequestId` · echo header `X-Request-Id` ở response.
  - `apps/server/src/types/express.d.ts` (mới) — augment Express `Request` với `sidekickRequestId?: string` (**không** dùng `any`).
  - `apps/server/src/services/requestLogService.ts` (mới) — `insertRequestLog()` · `buildContextSnapshot()` · `toRequestLogSummary()` · `listRequestLogs()` (filter + `limit`/`offset`) · `aggregateUsage()` (tổng token + cost + theo ngày) · `pruneRequestLogs()` (xoá dòng cũ hơn `LOG_RETENTION_DAYS`).
  - `apps/server/src/routes/logs.ts` (mới) — `GET /api/logs` (`limit`/`offset`/`provider`/`from`/`to`/`conversationId`) → `{ items, total }` · `GET /api/usage` (`from`/`to`) → `{ totalTokens, totalCostUsd, byDay[] }` — validate Zod ở biên, **chỉ trả metadata**.
  - `apps/eval/src/logs.ts` (mới) — `fetchLogs()` · `fetchUsage()` · `summarizeLogs()` dùng schema shared.
  - **Test** — `packages/shared/tests/pricing.test.ts` (mới, 14) · `apps/server/tests/requestLogService.test.ts` (mới, 26) · `apps/server/tests/requestLogger.test.ts` (mới, 21) · `apps/server/tests/logsRoute.test.ts` (mới, 11) · `apps/server/tests/helpers/fakeRequestLogDb.ts` (mới) · `apps/extension/tests/sseClient.test.ts` (cập nhật, 12) · `apps/extension/tests/useChat.test.ts` + `useChatOperations.test.ts` (cập nhật) · `apps/extension/e2e/requestLog.spec.ts` (mới, 2 kịch bản).
    - **Số test toàn repo:** 1165 → **1243 unit** (shared 243 · server 377 · extension 623) + 69 → **71 E2E**.
    - **Mutation spot-check:** 6/6 mutation bị bắt — `calculateCostUsd` trả `0` · `context_hash` dùng hash của prompt · bỏ nhánh log lượt lỗi · `routes/logs.ts` trả `promptText` · `pruneRequestLogs` sai cutoff · `requestId` middleware bỏ qua header đầu vào.
    - **Migration:** **không** có migration mới (mọi cột đã có sẵn từ M0) · **không** dependency mới · **không** permission mới · **không** đổi manifest.
- **T-M1-19 — Error / loading / empty states + retry + connection status (FR-CHAT-14 + FR-UX-08 + NFR-REL-02/04)**
  - `packages/shared/src/chatErrors.ts` (mới) — `ChatErrorKind` (`network` · `rate-limit` · `auth` · `provider` · `server` · `unknown`) · `classifyChatError(code)` · `isRetryableKind(kind)` (false cho `auth`) · `shouldAutoRetry(kind)` (true cho `network`/`server`/`unknown`) · `defaultRetryAfterSeconds(kind)` (60 cho `rate-limit`) · `AUTO_RETRY_BACKOFF_MS = 800`.
  - `packages/shared/src/events.ts` — `chatErrorEventSchema` += `retryAfterSeconds?: number` (int ≥ 0).
  - `packages/shared/src/schemas/provider.ts` — `providerChunkSchema` += `errorRetryable?: boolean` + `retryAfterSeconds?: number`.
  - `packages/shared/src/index.ts` — export `./chatErrors.js`.
  - `apps/server/src/providers/types.ts` — `errorChunk(code, message, { retryable, retryAfterSeconds })`.
  - `apps/server/src/providers/sse.ts` — `parseRetryAfterSeconds()` (đọc header `Retry-After`, ghim ≤ 600 s) · `isRetryableStatus()` (401/403 → **không** retryable) · `shouldTryFallbackModel()` (429 **vẫn** fallback sang model khác).
  - `apps/server/src/providers/openaiCompatible.ts` + `gemini.ts` — HTTP 429 → gắn `retryAfterSeconds` từ header `Retry-After` · HTTP 401/403 → `errorRetryable: false`.
  - `apps/extension/src/lib/connectionStatus.ts` (mới) — `backoffFor()` (5 s → 15 s → 30 s) · `probeConnection(url)` (timeout 3 s → `connected` · `degraded` · `offline`).
  - `apps/extension/src/sidepanel/hooks/useConnectionStatus.ts` (mới) — probe `GET <bffUrl>/api/health` + backoff · listener `navigator.onLine` (offline tức thời) · trả `{ status, lastCheckedAt, retry }`.
  - `apps/extension/src/sidepanel/components/states/` (mới) — `ErrorState.tsx` (card lỗi inline: icon + nguyên nhân + **1 hành động theo nhóm lỗi** + dismiss ✕ · 429 đếm ngược tương tác rồi mới bật nút "Thử lại") · `ConnectionBadge.tsx` (chip "Đang kết nối" / "Đã kết nối" / "Offline" / "Máy chủ lỗi" — icon + chữ, **không** chỉ dựa vào màu) · `LoadingState.tsx` (skeleton rows khi tải lịch sử hội thoại) · `EmptyState.tsx` (wrapper của `PromptGallery`).
  - **Test** — `packages/shared/tests/chatErrors.test.ts` (mới) · `packages/shared/tests/events.test.ts` (bổ sung `retryAfterSeconds`) · `apps/server/tests/chatErrorEvent.test.ts` (mới) · `apps/extension/tests/chatErrorState.test.tsx` (mới) · `apps/extension/tests/connectionStatus.test.ts` (mới) · `apps/extension/tests/chatRetry.test.ts` (mới) · `apps/extension/e2e/states.spec.ts` (mới, 4 kịch bản).
    - **Số test toàn repo:** 1115 → **1165 unit** (shared 230 · server 319 · extension 616) + 65 → **69 E2E**.
    - **Mutation spot-check:** 8/8 mutation bị bắt — `shouldAutoRetry` bỏ loại trừ `auth` · `useChat` bỏ guard số lần retry · `ErrorState` đếm ngược không giảm · `sse.ts` bỏ mapping `Retry-After` · `ChatWorkspace` bỏ banner offline · `connectionStatus` bỏ backoff · `chatService` hardcode `retryable: true` · `ChatWorkspace` bỏ `LoadingState`.
    - **Migration:** **không** có migration mới · **không** dependency mới · **không** permission mới · **không** đổi manifest.
- **T-M1-12 — Settings: theme · cỡ chữ · chiều rộng · quản lý dữ liệu · endpoint BFF (FR-SETTINGS-01..07 + FR-UX-06 + NFR-SEC-07)**
  - `packages/shared/src/schemas/settings.ts` (mới) — `settingsSchema` (Zod) · `themeModeSchema` (`light`/`dark`/`system`) · `densitySchema` (`compact`/`cozy`/`comfortable`) · `panelWidthSchema` (`narrow`/`default`/`wide`) · `uiLanguageSchema` (`vi`/`en`) · `fontScaleSchema` (enum 4 mức `0.9`/`1`/`1.1`/`1.2`) · `settingsPatchSchema`.
  - `apps/extension/src/lib/settings.ts` (mới) — `SETTINGS_STORAGE_KEY` (`sidekick.settings`) · `SIDEKICK_STORAGE_PREFIX` · `PRESERVED_STORAGE_KEYS` · `DEFAULT_SETTINGS` (telemetry/history **OFF**) · `readSettings()` (fallback **từng field**) · `writeSettings()` (**merge** + validate) · `resetSettings()` · `resolveTheme()` · `fontScaleFor()` · `densityScaleFor()` · `panelMaxWidthFor()` · `exportSettings()` · `importSettings()` · `deleteLocalSidekickData()` (xoá prefix `sidekick.`, **giữ** onboarding + provider).
  - `apps/extension/src/lib/theme.ts` (mới) — `prefersDarkScheme()` · `applyTheme()` (toggle class `.dark` + `data-theme`) · `applyFontScale()` (`--font-scale`) · `applyDensity()` (`--density-scale`) · `applyPanelWidth()` (`--panel-max-width`) · `watchSystemTheme()`.
  - `apps/extension/src/sidepanel/hooks/useSettings.ts` (mới) — đọc `readSettings()` lúc mount · nghe `chrome.storage.onChanged` → đồng bộ · `update(patch)` optimistic · **effect** áp theme/font/density/width lên `<html>` → **áp dụng ngay, không reload** · `watchSystemTheme` khi `theme === 'system'`.
  - `apps/extension/src/sidepanel/components/settings/` (mới) — `SettingsDrawer.tsx` (Radix Dialog trượt từ **phải**, `data-testid="settings-drawer"`) · `ThemeSettings.tsx` · `AppearanceSettings.tsx` · `PrivacySettings.tsx` · `DataSettings.tsx` · `EndpointSettings.tsx` · `LanguageSettings.tsx` · `SettingsControls.tsx` (`RadioGroup` · `ToggleRow` · `SettingsSection`).
  - `apps/server/src/services/conversationService.ts` — `deleteAllConversations(db)` → xoá explicit citations → messages → conversations (cascade ở Postgres vẫn an toàn) → trả số conversation đã xoá.
  - `apps/server/src/routes/conversations.ts` — `router.delete('/conversations')` → `200` + `{ deleted }` (khác `DELETE /conversations/:id` → `204`).
  - **Test** — `packages/shared/tests/settings.test.ts` (mới, 15) · `apps/extension/tests/settings.test.ts` (mới, 22) · `apps/extension/tests/theme.test.ts` (mới, 11) · `apps/extension/tests/settingsData.test.ts` (mới, 6) · `apps/extension/tests/settingsDrawer.test.tsx` (mới, 10) · `apps/extension/e2e/settings.spec.ts` (mới, 4 kịch bản).
    - **Số test toàn repo:** 1085 → **1115 unit** (shared 215 · server 314 · extension 586) + 61 → **65 E2E**.
    - **Mutation spot-check:** 7/7 mutation bị bắt — `resolveTheme()` bỏ nhánh `system` · `applyTheme()` không toggle `.dark` · `writeSettings()` không merge · `deleteLocalSidekickData()` xoá cả `sidekick.onboarding.*` · `importSettings()` không validate · xoá `router.delete('/conversations')` · `applyFontScale()` không set `--font-scale`.
    - **Migration:** **không** có migration mới · **không** dependency mới · **không** permission mới.
- **T-M1-03 — Service worker: toggle panel · context menu · phím tắt (FR-UX-01)**
  - `apps/extension/src/background/panelController.ts` (mới) — `PANEL_OPEN_STATE_KEY` (`sidekick.panelOpen`, `chrome.storage.session`) · `applyOpenOnActionClick()` (native toggle `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`, Chrome 114+) · `isOpenOnActionClick()` · `readPanelOpenState()` / `writePanelOpenState()` · `openSidePanel()` (fallback `chrome.windows.getCurrent()`) · `closeSidePanel()` (feature detection Chrome 141+) · `toggleSidePanel()` → `'opened' | 'closed' | 'noop'`. **Mọi hàm bọc `try/catch`** → không bao giờ throw.
  - `apps/extension/src/background/contextMenus.ts` (mới) — `CONTEXT_MENU_OPEN_ID` (`sidekick-open`, `contexts: ['page']`) · `CONTEXT_MENU_ASK_SELECTION_ID` (`sidekick-ask-selection`, `contexts: ['selection']`) · `registerContextMenus()` (`removeAll()` **trước** `create()` → không lỗi duplicate id khi update extension) · `handleContextMenuClick()` (mục selection → `PendingSelection` → `writePendingSelection()` → panel tự nhận → `tier: 'selection'` → mở panel; text rỗng → bỏ qua).
  - `apps/extension/src/background/commands.ts` (mới) — `COMMAND_TOGGLE_PANEL` (`sidekick-toggle-panel`) · `handleCommand()` → `toggleSidePanel(tab?.windowId)`.
  - `apps/extension/public/manifest.json` — khối `commands`: `sidekick-toggle-panel` · `suggested_key` = `Ctrl+Shift+K` (Windows/Linux) · `Command+Shift+K` (macOS). **Không** thêm permission mới.
  - **Test** — `apps/extension/tests/panelController.test.ts` (mới, 19) · `apps/extension/tests/contextMenus.test.ts` (mới, 7) · `apps/extension/tests/commands.test.ts` (mới, 4) · `apps/extension/e2e/serviceWorker.spec.ts` (mới, 4 kịch bản).
    - **Số test toàn repo:** 1019 → **1049 unit** (shared 200 · server 312 · extension 537) + 57 → **61 E2E**.
    - **Mutation spot-check:** 6/6 mutation bị bắt — `toggleSidePanel()` bỏ `closeSidePanel()` · `handleContextMenuClick()` bỏ `openSidePanel()` · `registerContextMenus()` bỏ `removeAll()` · `applyOpenOnActionClick()` bỏ `setPanelBehavior()` · `handleCommand()` bỏ guard command · `handleContextMenuClick()` bỏ `writePendingSelection()`.
    - **Migration:** **không** có migration mới · **không** dependency mới · **không** có UI mới.

### Changed
- `apps/server/src/config/env.ts` — `LOG_REQUESTS` mặc định `'false'` → **`'true'`** (log chỉ chứa metadata) · **mới** `LOG_FULL_CONTENT` (mặc định `'false'` — lưu thêm `prompt_text`/`response_text`) · **mới** `LOG_RETENTION_DAYS` (mặc định `'90'`).
- `apps/server/src/middleware/requestLogger.ts` — log dạng text (`GET /api/health 200 12ms`) → **1 dòng JSON** mỗi request: `{ ts, level, event: 'http_request', requestId, method, path, status, durationMs }` (**không** log body/key).
- `apps/server/src/middleware/origin.ts` — `allowedHeaders` += `X-Request-Id` (`exposedHeaders` đã có sẵn).
- `apps/server/src/services/chatService.ts` — `createChatStream(deps, request, abortSignal, options?)` nhận `options.requestId` (param 4 **optional**) · log **cả nhánh lỗi** (`MISSING_API_KEY` / `PROVIDER_VISION_UNSUPPORTED` / lỗi stream) với `error` = error code + `latencyMs` · ghi `costUsd` **thật** (từ `calculateCostUsd`) · ghi `toolCalls` (jsonb; `null` khi rỗng) · SSE `usage` mang `costUsd` thật (thay vì `0`) · `keySource` trả về giá trị **đã resolve** (thay vì hardcode `'K1'`).
- `apps/server/src/providers/openaiCompatible.ts` + `gemini.ts` — forward header `X-Request-Id` xuống provider khi có (best-effort correlation).
- `apps/server/src/routes/chat.ts` — echo header `X-Request-Id` + truyền `req.sidekickRequestId` xuống `createChatStream`.
- `apps/server/src/app.ts` — đăng ký `createRequestIdMiddleware()` + `createLogsRouter()`.
- `apps/server/src/index.ts` — dùng `logFullContent` + `logRetentionDays` từ env · hẹn `pruneRequestLogs()` lúc khởi động + **mỗi 24 h**.
- `apps/extension/src/lib/sseClient.ts` — `generateRequestId()` · gửi header `X-Request-Id` · ưu tiên id server echo trong response.
- `apps/extension/src/sidepanel/hooks/useChat.ts` — sinh `requestId` → truyền `streamChat` → lưu vào assistant message khi nhận SSE `meta`.
- `apps/extension/src/sidepanel/store/chatStore.ts` — `ChatMessage` += `requestId?: string`.
- `apps/extension/src/sidepanel/components/MessageBubble.tsx` — dòng meta assistant thêm **short id (6 ký tự)** của `requestId` (`font-mono` · `--text-tertiary` · `title` chứa id đầy đủ).
- `apps/eval/src/cli.ts` — thêm subcommand `pnpm eval:run logs` (in dòng log gần đây + tổng).
- `apps/server/.env` + `apps/server/.env.example` — `LOG_REQUESTS=true` · `LOG_FULL_CONTENT=false` · `LOG_RETENTION_DAYS=90`.
- `apps/server/src/services/chatService.ts` — SSE `error` event **không** còn hardcode `retryable: true` → `chunk.errorRetryable ?? isRetryableKind(classifyChatError(code))` · forward `retryAfterSeconds`.
- `apps/extension/src/lib/sseClient.ts` — `throw new Error("CODE: msg")` → `export class ChatRequestError extends Error { code; status; retryable }` (lỗi network → `SERVICE_UNAVAILABLE`) → caller branch được mà không parse chuỗi.
- `apps/extension/src/sidepanel/store/chatStore.ts` — `ChatMessage` += `serverId?` (uuid từ SSE `meta.messageId`) · `errorCode?` · `errorRetryable?` · `errorRetryAfterSeconds?` · action `setMessageError(id, patch)`.
- `apps/extension/src/sidepanel/hooks/useChat.ts` — lưu `code`/`retryable`/`retryAfterSeconds` khi nhận SSE `error` · retry **tự động 1 lần** backoff 800 ms (chỉ `network`/`server`/`unknown`) · expose `retryMessage(messageId)` (gọi `regenerate` với `serverId`) · `regenerate`/`continueAnswer` dùng **uuid server** thay vì id local.
- `apps/extension/src/sidepanel/components/MessageBubble.tsx` — dòng chữ đỏ thô → `<ErrorState>` (card lỗi + hành động khôi phục).
- `apps/extension/src/sidepanel/components/PanelHeader.tsx` — thêm nút gear (`Settings`, `aria-label="Mở cài đặt"`, `data-testid="settings-button"`) → `onOpenSettings` · render `<ConnectionBadge>` cạnh chip provider.
- `apps/extension/src/sidepanel/ChatWorkspace.tsx` — state `isSettingsOpen` · render `<SettingsDrawer>` cạnh drawer conversation · `onHistoryDeleted` → refresh danh sách conversation · **+** banner offline (khi BFF không phản hồi) · `<LoadingState>` khi `isHydrating` lịch sử hội thoại · wire `retryMessage` + `onOpenSettings`.
- `apps/extension/src/lib/conversationClient.ts` — `deleteAllConversations()` → `fetchJson('/api/conversations', { method: 'DELETE' })` → trả số đã xoá.
- `design/tokens.css` — thêm `--density-scale` · `--space-1..8` = `calc(<px> * var(--density-scale))`.
- `apps/extension/src/sidepanel/index.css` — `#root { max-width: var(--panel-max-width); min-width: var(--panel-min-width); margin-inline: auto; }` · animation `animate-drawer-in-right` (tôn trọng `prefers-reduced-motion`).
- `packages/shared/src/index.ts` — export `./schemas/settings.js`.
- `apps/extension/src/background/serviceWorker.ts` — top-level `void applyOpenOnActionClick()` (native toggle bật lại mỗi lần SW khởi động) · `action.onClicked` thành **fallback** (guard `isOpenOnActionClick()` → không mở 2 lần) · thêm `commands.onCommand` → `handleCommand` · `contextMenus.onClicked` → `handleContextMenuClick` · `sidePanel.onOpened` / `onClosed` → `writePanelOpenState` (feature detection Chrome 141/142).
- `apps/extension/tests/setup.ts` — bổ sung mock `chrome.sidePanel.close` / `getPanelBehavior` / `setPanelBehavior` / `onOpened` / `onClosed` · `chrome.contextMenus.create` / `removeAll` · `chrome.commands.onCommand` · `chrome.action.onClicked` · `chrome.windows.getCurrent` · `chrome.storage.session`.
- `docs/REQUIREMENTS.md` — FR-SETTINGS-01..07 ✅ + **§4.8.1** (AC chi tiết) · FR-UX-06 ✅ · NFR-SEC-07 ✅ · §11.1 traceability.
- `docs/SYSTEM_DESIGN.md` — **§7.14** mới "Settings" (quyết định thiết kế · shape `SidekickSettings` · contract `lib/settings.ts` + `lib/theme.ts` + hook `useSettings` · endpoint `DELETE /api/conversations` · luồng · hiệu năng · kiểm thử) · §4.1 bảng API thêm 1 dòng `DELETE /conversations`.
- `docs/DESIGN_SYSTEM_BRIEF.md` — §3.7 Settings: 8 component mới + props + token + biến CSS + a11y · §6 traceability.
- `docs/IMPLEMENTATION_PLAN.md` — task card T-M1-12 → ✅ *(2026-11-07)* · **§3.1o** "Kết quả verify T-M1-12" · traceability FR-SETTINGS / FR-UX-06.
- `docs/COMPARISON_MATRIX.md` — §E: 4 dòng parity → ✅ (theme sáng/tối A24/B12 · cỡ chữ & bề rộng panel · xoá dữ liệu NFR-SEC-07 · Settings tổng).
- `docs/HANDOFF.md` — M1 **16/25 → 17/25** · task kế tiếp · "Quyết định kỹ thuật mới (T-M1-12)".
- `docs/README.md` · `AGENTS.md` — số task / số test / tóm tắt T-M1-12.
- `docs/REQUIREMENTS.md` — FR-UX-01 ✅ + **§4.9.3** (AC chi tiết: 3 đường mở panel · 2 mục context menu · `Ctrl+Shift+K` · trạng thái `storage.session`).
- `docs/SYSTEM_DESIGN.md` — **§7.13** mới "Toggle panel · context menu · phím tắt" (quyết định thiết kế · contract 3 file · luồng · hiệu năng · kiểm thử) · §8 hiệu năng.
- `docs/DESIGN_SYSTEM_BRIEF.md` — §3.7 `ShortcutsSettings` ghi rõ thuộc T-M1-18 (chưa làm) · §6 traceability FR-UX-01 (không có component mới).
- `docs/IMPLEMENTATION_PLAN.md` — task card T-M1-03 → ✅ · **§3.1n** "Kết quả verify T-M1-03" · traceability FR-UX-01.
- `docs/COMPARISON_MATRIX.md` — §E: 3 dòng parity → ✅ (toolbar icon toggle · context menu "Ask Sidekick" · keyboard shortcut) · A25 / B19 ghi chú T-M1-03.

### Fixed
- Bảng `request_logs` **không có dòng nào** vì `LOG_REQUESTS` mặc định `false` → mặc định đã bật (chỉ ghi metadata).
- `cost_usd` **luôn = 0** trong DB và SSE `usage` → nay tính thật từ bảng giá token (`PROVIDER_PRICING`).
- Lượt chat **thất bại** (thiếu API key, provider không hỗ trợ vision, lỗi stream) **không** được ghi log → nay **mọi** lượt đều có 1 dòng log với error code.
- `request_logs.tool_calls` **luôn = null** → đã wire (shape-test), giá trị `null` khi chưa có tool call (tool thật ở M2).
- `ChatStreamResult.keySource` **hardcode `'K1'`** dù thực tế dùng K2/K3 → nay trả về key source đã resolve.
- Retention 90 ngày của `request_logs` (SYSTEM_DESIGN §5.2) **không được enforce** → nay `pruneRequestLogs()` chạy lúc khởi động + mỗi 24 h.
- Lỗi chat chỉ hiện 1 dòng chữ đỏ **không có đường khôi phục** — nay là `ErrorState` với hành động đúng theo nhóm lỗi (401 → mở Settings · 429 → đếm ngược · 5xx/network → "Thử lại").
- Server báo `retryable: true` cho **mọi** lỗi → lỗi 401 (API key sai) cũng hiện nút "Thử lại" vô ích — nay `retryable` được suy ra từ nhóm lỗi + `errorRetryable` từ provider.
- `regenerate` / `continue` / `retry` gửi **id local** (`assistant-<timestamp>`) trong khi server yêu cầu **uuid** → 400 — nay dùng `serverId` lấy từ SSE `meta.messageId`.
- Mở conversation trong lúc đang tải lịch sử → **empty state nhấp nháy** (PromptGallery hiện rồi mất) — nay hiện skeleton `LoadingState`.
- Sửa lỗi "Cannot create item with duplicate id" khi update extension — context menu giờ `removeAll()` trước `create()` và được đăng ký lại ở `runtime.onStartup`.
- Sửa lỗi `chrome.sidePanel.open()` chỉ mở (không toggle) khi bấm icon toolbar — nay dùng native `openPanelOnActionClick` (Chrome 114+).

### Docs
- Cập nhật `HANDOFF.md` (M1 18/25 → **19/25**) · `docs/README.md` · `AGENTS.md` (số task / số test / tóm tắt T-M1-14 · task kế tiếp → T-M1-15).
- `docs/REQUIREMENTS.md` — FR-CONTEXT-12 ✅ (AC chi tiết: log đầy đủ mọi lượt + `cost_usd` thật + `tool_calls` + read API metadata-only) · §5.2 ghi rõ cột `cost_usd`/`tool_calls`/`context_snapshot` · §7.2 schema note.
- `docs/SYSTEM_DESIGN.md` — **§7.16** mới "Request logging đầy đủ vào `request_logs`" (bảng khoảng trống đã giải quyết · luồng request-id · format log JSON · mô hình chi phí · API đọc log metadata-only · biến môi trường · kiểm thử + mutation).
- `docs/DESIGN_SYSTEM_BRIEF.md` — **§3.10** mới "Request-id chip trong dòng meta của message" (vị trí · 6 ký tự đầu · `title` chứa id đầy đủ · token · a11y) · §6 traceability.
- `docs/IMPLEMENTATION_PLAN.md` — task card T-M1-14 → ✅ *(2026-11-07)* · **§3.1q** "Kết quả verify T-M1-14" · traceability FR-CONTEXT-12 / NFR-REL-01 / NFR-MAINT-04.
- `docs/EVAL_PLAN.md` — **§5.3.1** mới "Nguồn sự thật của metric: bảng `request_logs`" (mapping metric → cột · lệnh đọc · **cảnh báo giá là snapshot** + retention 90 ngày) · §7 cấu trúc repo thêm `src/logs.ts` · §7.1 thêm lệnh `pnpm eval:run logs`.
- `docs/COMPARISON_MATRIX.md` — §E: dòng "Log request đầy đủ vào DB" → ✅ (T-M1-14).
- Cập nhật `HANDOFF.md` (M1 17/25 → **18/25**) · `docs/README.md` · `AGENTS.md` (số task / số test / tóm tắt T-M1-19).
- `docs/REQUIREMENTS.md` — FR-CHAT-14 ✅ + FR-UX-08 ✅ + NFR-REL-02 ✅ + NFR-REL-04 ✅ (AC chi tiết) · §11.1 traceability.
- `docs/SYSTEM_DESIGN.md` — **§7.15** mới "States · retry · connection status" (4 trạng thái · taxonomy lỗi · luồng lỗi · server báo lỗi thật · plumbing extension · probe kết nối · kiểm thử + mutation) · §4.3 shape SSE `error` (+`retryAfterSeconds`).
- `docs/DESIGN_SYSTEM_BRIEF.md` — **§3.9** mới "States — loading / empty / error / offline" (spec `ErrorState` · `ConnectionBadge` · `LoadingState` · `EmptyState` · token · a11y) · §4 bảng state (Error 401 → mở Settings · Error 429 đếm ngược · BFF offline badge + banner) · §6 traceability.
- `docs/IMPLEMENTATION_PLAN.md` — task card T-M1-19 → ✅ *(2026-11-07)* · **§3.1p** "Kết quả verify T-M1-19" · traceability FR-CHAT-14 / FR-UX-08 / NFR-REL-02/04.
- `docs/COMPARISON_MATRIX.md` — §E: thêm dòng parity "Error / loading / empty states + retry + trạng thái kết nối" → ✅ T-M1-19.
- Cập nhật `HANDOFF.md` (M1 15/25 → **16/25**) · `docs/README.md` · `AGENTS.md` (số task / số test / tóm tắt T-M1-03).
- **T-M1-11 — Prompt gợi ý theo trang + Tóm tắt 1-click (FR-UX-03 / FR-UX-04)**
  - `packages/shared/src/pageProfile.ts` (mới) — `PAGE_PROFILES` (`docs` · `article` · `forum` · `video` · `pdf` · `shopping` · `general`) · `classifyPage(url, title)` (host → path → title, match đầu thắng) · `PromptSuggestion` · `suggestionsForPage(profile, pageTitle)` (**4** gợi ý / profile, điền placeholder `{title}`) · `generalSuggestions()` (4 gợi ý chung — FR-UX-04) · `rotateSuggestions(list, offset)` (xoay vòng deterministic).
  - `packages/shared/src/constants.ts` — `SUMMARY_PROMPT` (trùng wording dataset eval `summarize`).
  - `packages/shared/src/index.ts` — export `./pageProfile.js`.
  - `apps/extension/src/lib/activePage.ts` (mới) — `readActivePage()` (`chrome.tabs.query({ active: true, currentWindow: true })`, **không bao giờ throw**).
  - `apps/extension/src/sidepanel/hooks/useActivePage.ts` (mới) — theo dõi trang active · lắng nghe `chrome.tabs.onActivated` + `chrome.tabs.onUpdated` → đổi tab → gallery đổi bộ gợi ý.
  - `apps/extension/src/sidepanel/components/chat/PromptGallery.tsx` (mới) — grid chip gợi ý + nút refresh (`RefreshCw`) + nút "Tóm tắt trang này" + dòng minh bạch "Sẽ tự đính kèm trang này khi bạn chọn gợi ý".
  - `apps/extension/src/sidepanel/components/chat/SummarizeButton.tsx` (mới) — nút chính "Tóm tắt trang này" 1-click.
  - `apps/extension/src/sidepanel/ChatWorkspace.tsx` — thay empty state tĩnh bằng `<PromptGallery />` · `runSuggestion(prompt)` = `await attachCurrentTab()` → `await send(prompt)` · `handleSummarize()` = `runSuggestion(SUMMARY_PROMPT)`.
  - **Test** — `packages/shared/tests/pageProfile.test.ts` (mới, 23) · `apps/extension/tests/activePage.test.ts` (mới, 5) · `apps/extension/tests/promptGallery.test.tsx` (mới, 8) · `apps/extension/e2e/promptGallery.spec.ts` (mới, 5 kịch bản).
    - **Số test toàn repo:** 983 → **1019 unit** (shared 200 · server 312 · extension 507) + 52 → **57 E2E**.
    - **Mutation spot-check:** 5/5 mutation bị bắt — `classifyPage()` trả general cho mọi URL · `suggestionsForPage()` trả mảng rỗng · `fillTitle()` không điền `{title}` · `runSuggestion()` bỏ `await attachCurrentTab()` · `useActivePage` không lắng nghe `tabs.onActivated`.
    - **Migration:** **không** có migration mới · **không** dependency mới.
- **T-M1-10 — Regenerate / Edit-resend / Stop / Continue / Draft / Auto-scroll (FR-CHAT-05 / FR-CHAT-06 / FR-CHAT-07 / FR-CHAT-12 / FR-CHAT-13 + FR-UX-05)**
  - `packages/shared/src/schemas/chat.ts` — `chatOperationSchema` (`send` · `regenerate` · `continue` · `branch`) · `chatRequestSchema` += `operation?` · `assistantMessageId?` (uuid) · `parentTurnId?`.
  - `packages/shared/src/schemas/conversation.ts` — `conversationMessageSchema` += `turnId?` · `variantIndex?` · `active?` · `parentTurnId?` · `aborted?` · `conversationVariantSchema` · `conversationTurnSchema` · `activateVariantSchema` · `activateVariantResponseSchema` · `conversationMessagesResponseSchema` += `path: string[]` + `turns[]`.
  - `packages/shared/src/events.ts` — `chatMetaEventSchema` += `turnId?` → client đồng bộ turn khi stream.
  - `packages/shared/src/constants.ts` — `CONTINUE_INSTRUCTION` ("Tiếp tục câu trả lời trước đó từ đúng chỗ nó bị ngắt. Chỉ viết phần tiếp theo, không lặp lại phần đã có.") · `API_ROUTES.conversationTurnActivate`.
  - `apps/server/src/services/turnService.ts` (mới) — `normalizeMessages()` · `derivePath()` (fallback suy ra từ `createdAt` khi `conversations.meta.path` thiếu → tương thích dữ liệu cũ) · `readConversationPath()` · `rewritePath()` · `loadNormalizedMessages()` · `loadMessage()` · `nextVariantIndex()` · `activeVariantIndex()` · `buildTurns()` · `activeVariantMap()` · `newTurnId()` · `patchMessageMeta()` · `patchMessagesMeta()` · `updateMessageContent()`.
  - `apps/server/src/services/chatService.ts` — `createChatStream()` xử lý `operation`: `send` (turn mới → insert user → `path.push`) · `regenerate` (**không** insert user message → assistant variant `max+1`, variant cũ `active=false`) · `continue` (UPDATE message cũ: `content = partial + text`, `aborted = false`; provider messages = history + 1 user turn `CONTINUE_INSTRUCTION`) · `branch` (turn mới `parentTurnId` → cắt `path` tại turn cha → các turn bị cắt `active=false`) · luôn `yield` SSE `meta` kèm `turnId` · `buildProviderMessages()` hỗ trợ `extraUserInstruction`.
  - `apps/server/src/services/citationService.ts` — `clearCitations()` (xoá citation cũ khi continue ghi đè nội dung).
  - `apps/server/src/services/conversationService.ts` — `getConversationMessages()` trả `messages` (kèm turn fields) + `path` + `turns` · `activateVariant()` đổi variant active trong nhóm.
  - `apps/server/src/routes/conversations.ts` — route mới `POST /api/conversations/:id/turns/:turnId/activate` (body `{ variantIndex }`).
  - `apps/extension/src/lib/chatTurns.ts` (mới, thuần) — `groupTurns()` · `activePathMessages()` · `offPathTurns()` · `applyVariantSwitch()` · `variantLabel()` · `branchPath()` · `buildHistory()`.
  - `apps/extension/src/lib/storage.ts` — draft: `DRAFT_STORAGE_PREFIX` (`sidekick.draft.<scope>`) · `DRAFT_TTL_MS` (30 ngày) · `ACTIVE_SCOPE_STORAGE_KEY` (`sidekick.activeDraftScope`) · `draftKey()` · `readDraft()` · `writeDraft()` · `clearDraft()` · `readActiveDraftScope()` · `writeActiveDraftScope()`.
  - `apps/extension/src/lib/conversationClient.ts` — `activateVariant(conversationId, turnId, variantIndex)`.
  - `apps/extension/src/sidepanel/store/chatStore.ts` — `ChatMessage` += `turnId?` · `variantIndex?` · `active?` · `parentTurnId?` · `aborted?` · state += `path: string[]` · `draft: string` · actions `hydratePath()` · `setPath()` · `activateVariant()` · `setAborted()` · `setDraft()`.
  - `apps/extension/src/sidepanel/hooks/useChat.ts` — dispatcher `streamTurn()` hỗ trợ `send` · `regenerate` · `editAndResend` · `continueAnswer` · `stop` · `activateVariant` · `setConversationPath`.
  - `apps/extension/src/sidepanel/components/chat/MessageActions.tsx` (mới) — assistant: "Tạo lại" (`RefreshCw`) · switcher biến thể "1/2" (dropdown khi turn có >1 variant) · "Tiếp tục" (khi `aborted`) · user: "Sửa" (`Pencil`).
  - `apps/extension/src/sidepanel/components/chat/MessageEditBox.tsx` (mới) — textarea inline + "Gửi lại" / "Hủy"; Enter gửi, Shift+Enter xuống dòng, Esc hủy.
  - `apps/extension/src/sidepanel/components/chat/ScrollToBottomButton.tsx` (mới) — nút nổi "Cuộn xuống" (FR-UX-05), `aria-label` tiếng Việt.
  - `apps/extension/src/sidepanel/components/MessageBubble.tsx` — nối `MessageActions` + `MessageEditBox`.
  - `apps/extension/src/sidepanel/ChatWorkspace.tsx` — render theo **đường đi active** + mục "Phiên bản cũ" (collapsible) · auto-scroll chỉ khi đang ở đáy (ngưỡng 80px) + nút "Cuộn xuống" · tự lưu draft (debounce 300ms) + khôi phục theo scope · `Esc` ưu tiên dừng streaming.
  - **Test** — `packages/shared/tests/chatOperation.test.ts` (mới) · `apps/server/tests/turnService.test.ts` (mới) · `apps/server/tests/chatOperations.test.ts` (mới) · `apps/extension/tests/chatTurns.test.ts` (mới) · `apps/extension/tests/useChatOperations.test.ts` (mới) · `apps/extension/tests/messageActions.test.tsx` (mới) · `apps/extension/tests/draftStorage.test.ts` (mới) · `apps/extension/e2e/chatActions.spec.ts` (mới, 5 kịch bản).
    - **Số test toàn repo:** 904 → **983 unit** (shared 177 · server 312 · extension 494) + 47 → **52 E2E**.
    - **Mutation spot-check:** 5/5 mutation bị bắt — `nextVariantIndex()` đếm cả user message · `activePathMessages()` trả mọi biến thể · `continue` không gép nội dung dở · `branchPath()` không cắt path · `readDraft()` bỏ TTL 30 ngày.
    - **Migration:** **không** có migration mới — dùng sẵn `messages.meta` (jsonb) + `conversations.meta` (jsonb).

### Changed
- `docs/REQUIREMENTS.md` — FR-UX-03/04 ghi "đã implement (T-M1-11)" + **§4.9.2** mới (AC chi tiết) + §11.1 đánh dấu ✅.
- `docs/SYSTEM_DESIGN.md` — **§7.12** mới "Prompt gợi ý theo trang + Tóm tắt 1-click" + §8 hiệu năng (đọc tab active = 1 lần `chrome.tabs.query` ≤ 5 ms).
- `docs/DESIGN_SYSTEM_BRIEF.md` — §3.3 thêm `PromptGallery` + `SummarizeButton` (props · token · a11y) + §4 state table + §6 traceability.
- `docs/IMPLEMENTATION_PLAN.md` — task card T-M1-11 → ✅ + **§3.1m** kết quả verify.
- `docs/COMPARISON_MATRIX.md` — §E: "Nút tóm tắt 1-click" + "Prompt gợi ý theo loại trang" → ✅ T-M1-11.
- `docs/HANDOFF.md` · `AGENTS.md` §6 (M1: 14/25 → **15/25**) + mục tóm tắt T-M1-11.
- `docs/REQUIREMENTS.md` — FR-CHAT-05/06/07/12/13 + FR-UX-05 ghi "đã implement (T-M1-10)".
- `docs/SYSTEM_DESIGN.md` — §4.1 (bảng endpoint + request shape) + §7.11 mới "Turn / variant / branch (T-M1-10)".
- `docs/DESIGN_SYSTEM_BRIEF.md` — §3.3 (+`MessageActions` · `MessageEditBox` · `ScrollToBottomButton` + a11y).
- `docs/IMPLEMENTATION_PLAN.md` — task card T-M1-10 ✅ + §3.1l kết quả verify.
- `docs/COMPARISON_MATRIX.md` — §E checklist "Stop / Regenerate / Edit-resend" → ✅ T-M1-10.
- `docs/HANDOFF.md` · `AGENTS.md` §6 (M1: 13/25 → **14/25**) + mục tóm tắt T-M1-10.

### Fixed
- `apps/extension/src/lib/storage.ts` — draft giữ được sau khi reload panel (scope active lưu ở `sidekick.activeDraftScope`, fallback scope `new`).

### Docs
- `REQUIREMENTS.md` §4.9.2 · `SYSTEM_DESIGN.md` §7.12 · `DESIGN_SYSTEM_BRIEF.md` §3.3 · `IMPLEMENTATION_PLAN.md` §3.1m · `COMPARISON_MATRIX.md` §E · `HANDOFF.md` · `AGENTS.md` §6.
- `REQUIREMENTS.md` §4.2 · `SYSTEM_DESIGN.md` §4.1 + §7.11 · `DESIGN_SYSTEM_BRIEF.md` §3.3 · `IMPLEMENTATION_PLAN.md` · `COMPARISON_MATRIX.md` §E · `HANDOFF.md` · `AGENTS.md` §6.

---

### Added
- **T-M1-09 — Chat CRUD: tạo / đổi tên / xoá / ghim / lưu trữ / search (FR-CHAT-08 / FR-CHAT-09 / FR-CHAT-11)**
  - `packages/shared/src/schemas/conversation.ts` (mới) — `conversationSummarySchema` (id · title · pinned · archived · createdAt · updatedAt · messageCount) · `conversationListResponseSchema` (`items` + `nextCursor`) · `updateConversationSchema` (`{ title?, pinned?, archived? }` · refine "ít nhất 1 trường") · `conversationCitationSchema` · `conversationMessageSchema` (kèm `provider` / `model` / `tokensIn` / `tokensOut` + `citations[]`) · `conversationMessagesResponseSchema`.
  - `packages/shared/src/schemas/chat.ts` — `conversationListQuerySchema` **+`archived`** (transform `true`/`'true'` → boolean) để tách nhóm "Đã lưu trữ".
  - `packages/shared/src/types/entities.ts` — `messageSchema` **+`citations` / `provider` / `model` / `tokensIn` / `tokensOut`** → khôi phục lịch sử không mất thông tin DP-6.
  - `packages/shared/src/constants.ts` — `API_ROUTES.conversationMessages` (template `/api/conversations/:id/messages`).
  - `packages/shared/src/index.ts` — export `./schemas/conversation.js`.
  - `apps/server/src/services/conversationService.ts` (mới) — `listConversations()` (lọc `archived` + `q` trong SQL · `ILIKE` **escape wildcard** `%` `_` `\` · sort `pinned desc, updated_at desc, id desc` · phân trang **keyset** bằng cursor base64url, không OFFSET) · `createConversation()` · `updateConversation()` (bump `updated_at`) · `deleteConversation()` (cascade) · `getConversationMessages()` (join `messages` + `citations`) · `countMessagesByConversation()` (1 query `count` + `groupBy`) · `buildAutoTitle()` (60 ký tự đầu) · `escapeLikePattern()` · `encodeCursor()` / `decodeCursor()` · `compareConversations()`.
  - `apps/server/src/routes/conversations.ts` (mới) — `GET /api/conversations` (`?q=&archived=&limit=&cursor=`) · `POST /api/conversations` (`201`) · `GET /api/conversations/:id/messages` · `PATCH /api/conversations/:id` · `DELETE /api/conversations/:id` (`204`) · id phải là UUID → `VALIDATION_ERROR`; `AppError` map qua `errorHandler` sẵn có.
  - `apps/server/src/app.ts` — đăng ký `createConversationsRouter({ db })` vào `API_BASE_PATH`.
  - `apps/server/src/services/chatService.ts` — `persistUserMessage()` đặt **tiêu đề tự động** từ câu hỏi đầu tiên (thay hardcode "Cuộc trò chuyện mới") · `persistAssistantMessage()` lưu `meta` = provider/model/tokensIn/tokensOut (DP-6) · `touchConversation()` bump `updated_at` sau mỗi lượt chat (conversation vừa hoạt động luôn lên đầu danh sách).
  - `apps/extension/package.json` — **+`@radix-ui/react-dialog`** (drawer + confirm dialog).
  - `apps/extension/src/components/ui/dialog.tsx` (mới) — shadcn/ui Dialog copy từ Radix (Dialog · DialogContent · DialogHeader · DialogFooter · DialogTitle · DialogDescription · DialogOverlay · DialogClose) · dùng token `--surface-overlay` / `--shadow-3` / `--border-default`.
  - `apps/extension/src/lib/conversationClient.ts` (mới) — `listConversations()` · `createConversation()` · `updateConversation()` · `deleteConversation()` · `getConversationMessages()` (dùng `fetchJson` → `ApiError` chuẩn).
  - `apps/extension/src/sidepanel/store/conversationStore.ts` (mới) — Zustand store: `items` · `isLoading` · `error` · `query` · `archivedView` · `nextCursor` · `activeConversationId` · `activeTitle` · actions `refresh()` · `loadMore()` · `create()` · `rename()` · `togglePin()` · `toggleArchive()` · `remove()` — **optimistic update + rollback** khi API lỗi.
  - `apps/extension/src/sidepanel/components/chat/ConversationList.tsx` (mới) — nội dung drawer: nút "Chat mới" · ô search (debounce 250 ms) · 2 tab "Đang dùng" / "Đã lưu trữ" · nhóm "Đã ghim" / "Gần đây" · mỗi dòng có nút ghim / lưu trữ / đổi tên / xoá (aria-label tiếng Việt) · dòng đang active được highlight.
  - `apps/extension/src/sidepanel/components/chat/ConfirmDialog.tsx` (mới) — confirm xoá (FR-CHAT-08 "xoá cả nhóm → có confirm dialog"), nút nguy hiểm dùng variant `danger`.
  - `apps/extension/src/sidepanel/components/PanelHeader.tsx` — +nút `History` mở drawer (`data-testid="conversations-button"`) · +hiển thị tiêu đề conversation hiện tại (`data-testid="conversation-title"`).
  - `apps/extension/src/sidepanel/ChatWorkspace.tsx` — mount drawer (Radix Dialog) · `handleSelectConversation()` tải lịch sử qua `GET /:id/messages` rồi `hydrateConversation()` (kèm citations đã lưu) · `handleCreateConversation(id)` xoá thread và gán conversation vừa tạo.
  - `apps/extension/src/sidepanel/store/chatStore.ts` — +action `hydrateConversation(conversationId, messages)` (nạp lại lịch sử hội thoại).
  - `apps/extension/src/sidepanel/index.css` — +animation `sidekick-drawer-in` / `sidekick-fade-in` (tôn trọng `prefers-reduced-motion`).
  - **Test** — `packages/shared/tests/conversationSchema.test.ts` (mới) · `apps/server/tests/conversationService.test.ts` (mới, 28 test) · `apps/server/tests/conversationsRoute.test.ts` (mới, 13 test) · `apps/server/tests/helpers/fakeConversationDb.ts` (mới — fake Drizzle DB phân tích SQL chunk, **không cần Docker**) · `apps/extension/tests/conversationStore.test.ts` (mới, 15 test) · `apps/extension/tests/conversationClient.test.ts` (mới) · `apps/extension/tests/conversationList.test.tsx` (mới) · `apps/extension/e2e/conversation.spec.ts` (mới, 7 kịch bản).
    - **Số test toàn repo:** 813 → **904 unit** (shared 165 · server 291 · extension 448) + 40 → **47 E2E**.
    - **Mutation spot-check:** 5/5 mutation bị bắt — đảo thứ tự `pinned` (1 test fail) · bỏ `NOT_FOUND` (2 test fail) · bỏ lọc `archived` (1 test fail) · bỏ escape `LIKE` (3 test fail) · bỏ rollback optimistic (1 test fail).

### Changed
- `apps/server/src/services/chatService.ts` — system prompt nay có thêm hướng dẫn trích dẫn (`CITATION_INSTRUCTION`) **chỉ khi** request có context → chat thuần LLM không bị ảnh hưởng (FR-CONTEXT-13).
- `apps/extension/src/sidepanel/components/chat/markdownSchema.ts` — allowlist `span` nay chấp nhận thêm `dataCitationIndex` (ngoài `className` pattern `hljs-*`).

### Docs
- `REQUIREMENTS.md` §4.2 (FR-CHAT-08 / FR-CHAT-09 / FR-CHAT-11) + §11.1 · `SYSTEM_DESIGN.md` §4.1 (bảng endpoint) + §7.10 (mới — Chat CRUD) · `DESIGN_SYSTEM_BRIEF.md` §3.2 (`ConversationList`) + §3.6 (`ConfirmDialog`) · `IMPLEMENTATION_PLAN.md` task card T-M1-09 ✅ + §3.1k · `COMPARISON_MATRIX.md` §A + §B + §E · `HANDOFF.md` · `AGENTS.md` §6 + `docs/README.md`.

---

### Added
- **T-M1-08 — Citation chip + popover (đoạn nguồn) (FR-CONTEXT-10)**
  - `packages/shared/src/citation.ts` (mới) — `CITATION_MARKER_PATTERN` (`/\[(\d{1,2})\]/g`) · `CITATION_INSTRUCTION` (chỉ chèn vào system prompt **khi có context**) · `parseCitationMarkers()` (số phân biệt · sort tăng dần · **không** mutate `lastIndex` của regex global).
  - `packages/shared/src/index.ts` — export `./citation.js`.
  - `apps/server/src/services/citationService.ts` (mới) — `extractCitations(text, sources)` (parse marker `[N]` → **loại số vượt phạm vi** · format snippet `excerpt ?? text.slice(0, 320)`) · `buildSnippet()` · `persistCitations()` (insert bảng `citations`: `messageId`, `idx`, `url`, `title`, `snippet`, `tabId`).
  - `apps/server/src/services/chatService.ts` — `numberedContextItems()` (đánh số **1-based** theo tier `selection` > `attachment` > `currentTab`) · `buildContextPrompt()` render `--- Nguồn [1] ([Đã bôi đen]) ---` · `buildProviderMessages()` chèn `CITATION_INSTRUCTION` · `createChatStream()` **emit SSE `citation` trước `done`** + gọi `persistCitations()`.
  - `apps/extension/src/components/ui/popover.tsx` (mới) — wrapper shadcn/ui trên `@radix-ui/react-popover`.
  - `apps/extension/src/sidepanel/components/chat/citationPlugin.ts` (mới) — remark plugin (thuần mdast) tách text node chứa `[N]` → `<span dataCitationIndex={N}>`; **không** đụng code block / inline code.
  - `apps/extension/src/sidepanel/components/chat/CitationChip.tsx` (mới) — chip inline `<button class="citation-chip" data-testid="citation-chip-{N}">`; **có** metadata → button mở popover · **chưa** có metadata (đang stream) → `<span>`.
  - `apps/extension/src/sidepanel/components/chat/CitationPopover.tsx` (mới) — Radix Popover qua Portal: tiêu đề · domain · đoạn trích (`max-h-[160px]`, scroll) · nút "Mở trang gốc" (`chrome.tabs.create`).
  - `apps/extension/src/sidepanel/components/chat/CitationList.tsx` (mới) — dòng tóm tắt nguồn dưới bubble assistant (`data-testid="citation-list"`).
  - `apps/extension/src/sidepanel/components/chat/markdownSchema.ts` — +`dataCitationIndex` vào allowlist `span` (`[['className', /^hljs-/], 'dataCitationIndex']`) — **không** dùng wildcard `data*`.
  - `apps/extension/src/sidepanel/components/chat/MessageContent.tsx` — +`citationPlugin` vào `remarkPlugins` · `CitationContext` · override `span`: có `dataCitationIndex` → `CitationChip`, còn lại → pass-through (token `.hljs-*`).
  - `apps/extension/src/sidepanel/components/MessageBubble.tsx` — truyền `message.citations` xuống `MessageContent` + render `CitationList`.
  - `apps/extension/src/sidepanel/store/chatStore.ts` — +`ChatCitation` · `ChatMessage.citations` · action `addCitation`.
  - `apps/extension/src/sidepanel/hooks/useChat.ts` — xử lý SSE `case 'citation'` → `addCitation`.
  - `apps/extension/src/sidepanel/index.css` — +`.citation-chip` dùng token `--citation-bg/-border/-link/-hover` (không hardcode màu).
  - **Test** — `packages/shared/tests/citation.test.ts` (mới, 12 test) · `apps/server/tests/citationService.test.ts` (mới, 12 test) · `apps/server/tests/citationStream.test.ts` (mới, 5 test) · `apps/server/tests/contextPrompt.test.ts` (+7 test) · `apps/extension/tests/citationPlugin.test.ts` (mới, 11 test) · `apps/extension/tests/citationChip.test.tsx` (mới, 9 test) · `apps/extension/tests/messageContentCitation.test.tsx` (mới, 9 test) · `apps/extension/tests/chatStore.test.ts` (+4 test) · `apps/extension/tests/useChat.test.ts` (+2 test) · `apps/extension/e2e/citation.spec.ts` (mới, 4 kịch bản).
    - **Số test toàn repo:** 740 → **813 unit** (shared 152 · server 250 · extension 411) + 36 → **40 E2E**.
  - **Mutation spot-check:** 6/6 mutation bị bắt — bỏ `CITATION_INSTRUCTION` (2 test fail) · đảo thứ tự tier (3 test fail) · cho phép số vượt phạm vi (2 test fail) · bỏ `dataCitationIndex` khỏi allowlist (5 test fail) · bỏ `case 'citation'` trong `useChat` (2 unit + 3 E2E fail) · ép mọi `span` thành chip (4 test fail).

### Changed
- `apps/server/src/services/chatService.ts` — system prompt nay có thêm hướng dẫn trích dẫn (`CITATION_INSTRUCTION`) **chỉ khi** request có context → chat thuần LLM không bị ảnh hưởng (FR-CONTEXT-13).
- `apps/extension/src/sidepanel/components/chat/markdownSchema.ts` — allowlist `span` nay chấp nhận thêm `dataCitationIndex` (ngoài `className` pattern `hljs-*`).

### Docs
- `REQUIREMENTS.md` §4.2 (FR-CONTEXT-10) + §11.1 · `SYSTEM_DESIGN.md` §7.9 (mới) + §4.3 · `DESIGN_SYSTEM_BRIEF.md` §3.3 + §3.4 (spec `CitationChip` · `CitationPopover` · `CitationList`) · `IMPLEMENTATION_PLAN.md` task card T-M1-08 ✅ + §3.1j + §3.2 · `COMPARISON_MATRIX.md` §A (A29) + §B (B29) + §D + §E · `EVAL_PLAN.md` §4.1 (R5) + §5.1.1 (mới) + §9 (FC-13) · `HANDOFF.md` · `AGENTS.md` §6 + `docs/README.md`.

### Added
- **T-M1-07 — Markdown render + code block + copy + syntax highlight (FR-CHAT-02 / FR-CHAT-03 / FR-CHAT-04, NFR-SEC-04, NFR-PERF-02)**
  - `apps/extension/package.json` — +`react-markdown@^10.1.0` · `remark-gfm@^4.0.1` · `rehype-sanitize@^6.0.0` · `rehype-highlight@^7.0.2` (`sonner` đã có sẵn từ trước).
  - `apps/extension/src/sidepanel/components/chat/markdownSchema.ts` (mới) — `markdownSchema` (clone `defaultSchema` của `rehype-sanitize` + `span: [['className', /^hljs-/]]` + `code: [['className', /^language-./, 'hljs']]` + `protocols.href: ['http','https','mailto']`) · `LANGUAGE_ALIASES` · `SUPPORTED_LANGUAGES` · `toMarkdownNode()` / `languageFromNode()` / `extractCodeText()`.
  - `apps/extension/src/sidepanel/components/chat/CodeBlock.tsx` (mới) — header (nhãn ngôn ngữ + nút copy) · copy **source thô** qua `navigator.clipboard.writeText` · icon `Copy` → `Check` 1500 ms · `toast.success('Đã sao chép')` / `toast.error('Không sao chép được')` · `CodeBlockContext` phân biệt code block vs inline code.
  - `apps/extension/src/sidepanel/components/chat/MarkdownTable.tsx` (mới) — bọc `<table>` trong `div.overflow-x-auto` (`data-testid="markdown-table-wrapper"`) → bảng rộng scroll ngang, không vỡ layout ở panel 320 px.
  - `apps/extension/src/sidepanel/components/chat/MessageContent.tsx` (mới) — orchestrator pipeline `remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-highlight` → `rehype-sanitize` → React components · `useDeferredValue(content)` · mảng plugin **hằng module-level** (`REHYPE_PLUGINS_STREAMING` / `REHYPE_PLUGINS_DONE`) · override `a` / `pre` / `code` / `table` · `skipHtml`.
  - `apps/extension/src/sidepanel/index.css` — +`.markdown-body` (typography theo token) · +mapping `.hljs-*` → `--code-token-*` (token có sẵn trong `design/tokens.css`, không hardcode hex).
  - **Test** — `apps/extension/tests/markdownSchema.test.ts` (mới, 17 test) · `apps/extension/tests/messageContent.test.tsx` (mới, 25 test) · `apps/extension/tests/messageContentDefer.test.tsx` (mới, 2 test) · `apps/extension/e2e/markdown.spec.ts` (mới, 4 kịch bản).
  - **Số test toàn repo:** 696 → **740 unit** (shared 140 · server 224 · extension 376) + 32 → **36 E2E**.
  - **Mutation spot-check:** 6/6 mutation bị bắt — bỏ `rehype-sanitize` (2 test fail) · bỏ `rel="noopener noreferrer"` (1 test fail) · đổi allowlist `href` (2 test fail) · bỏ defer-highlight khi streaming (1 test fail) · bỏ `useDeferredValue` (2 test fail) · bỏ `overflow-x-auto` ở bảng (1 test fail).

### Changed
- `apps/extension/src/sidepanel/components/MessageBubble.tsx` — message **assistant** nay dùng `<MessageContent content={message.content} isStreaming={message.status === 'streaming'} />` thay `<p className="whitespace-pre-wrap">`; message **user** giữ nguyên text thuần (không parse → giảm bề mặt XSS từ nội dung người dùng).
- `apps/extension/src/sidepanel/App.tsx` — mount `<Toaster position="bottom-center" />` (dùng chung cho onboarding + chat workspace).
- `apps/extension/public/manifest.json` — +permission `clipboardWrite` (dùng thật cho copy code).
- `docs/SYSTEM_DESIGN.md` §7.2 — Markdown pipeline nay là `react-markdown` + `remark-gfm` + `rehype-highlight` + `rehype-sanitize` (trước ghi `shiki`).

### Fixed
- `docs/SYSTEM_DESIGN.md` §7.2 — ghi "shiki" làm engine highlight → **sai**: shiki cần wasm → cần `'wasm-unsafe-eval'` trong CSP, MV3 `script-src 'self'` không cho phép. Đổi sang `rehype-highlight` (highlight.js đồng bộ, 37 ngôn ngữ `common`).

### Docs
- `REQUIREMENTS.md` §4.3 (FR-CHAT-02/03/04) + §4.6 (NFR-SEC-04) + §4.5 (NFR-PERF-02) + §11.1 · `SYSTEM_DESIGN.md` §7.8 (mới) + §7.2 + §7.2.1 + §7.2.2 (mutation vòng 4) · `DESIGN_SYSTEM_BRIEF.md` §3.3 + §3.4 (spec `MessageContent` · `CodeBlock` · `MarkdownTable` + mapping `.hljs-*`) · `IMPLEMENTATION_PLAN.md` task card T-M1-07 ✅ + §3.1i-bis + §3.2 · `COMPARISON_MATRIX.md` §E · `EVAL_PLAN.md` §4.1 (R6) · `HANDOFF.md` §2 · `AGENTS.md` §6 + `docs/README.md`.

### Added
- **T-M1-06 — Hash context + snapshot log + cache theo URL+hash (FR-CONTEXT-01 / FR-CONTEXT-12)**
  - `packages/shared/src/contextHash.ts` (mới) — `hashString(text)` (FNV-1a 32-bit → hex, **thuần** — không `node:crypto` → dùng được cho extension + server) · `hashContextItems(items)` (hash **deterministic**: sort theo `CONTEXT_TIER_ORDER` rồi `id`, nối `id|kind|tier|url|title|sourceKind|text` bằng `\u0000`; `truncated`/`droppedChars`/`tokens` là thuộc tính ngân sách nên **không** tính; rỗng → `''`) · `contextHashKey(url)` (bỏ fragment + query, lowercase host).
  - `packages/shared/src/constants.ts` — thêm `CONTEXT_CACHE_TTL_MS = 30 * 60_000` (30 phút) · `CONTEXT_CACHE_MAX_ENTRIES = 20`.
  - `packages/shared/src/index.ts` — export `contextHash.ts`.
  - `apps/server/src/services/chatService.ts` — `resolveContextItems(request, options)` (**mới**): chạy `applyContextBudget()` **một lần** → nguồn sự thật duy nhất cho cả prompt builder lẫn request log. `buildProviderMessages()` nhận thêm `options.contextBudget` (giữ **nguyên chữ ký** cũ) · `persistRequestLog()` nhận `contextItems` · `context_hash = hashContextItems(contextBudget.items)` (không có context → `null`) · `context_snapshot` jsonb `[{ id, kind, tier, url, title, sourceKind, text, excerpt, truncated }]` — **chỉ khi** `logContextSnapshot` bật · `buildContextSnapshot()` (export) · `hashText()` nay trỏ về `hashString()` (comment cũ ghi "SHA-256 rút gọn" nhưng code là djb2 → đã sửa).
  - `apps/server/src/services/chatService.ts` (`ChatServiceDeps`) — thêm `logContextSnapshot: boolean`.
  - `apps/server/src/config/env.ts` — thêm `LOG_CONTEXT_SNAPSHOT` (`'true'|'false'`, mặc định `'false'`).
  - `apps/server/src/index.ts` — truyền `logContextSnapshot: env.LOG_CONTEXT_SNAPSHOT`.
  - `apps/extension/src/lib/contextCache.ts` (mới) — `readCachedContext(url, now?)` (tự xoá entry hết TTL) · `writeCachedContext(entry)` (ghi đè theo key + **prune** khi vượt `CONTEXT_CACHE_MAX_ENTRIES`) · `clearContextCache()` · `toCacheEntry(context, now?)` · `hasContentChanged(cached, fresh)` — lưu `chrome.storage.local` key `sidekick.contextCache`; **không bao giờ throw** khi lỗi storage.
  - `apps/extension/src/lib/contextAttach.ts` — `attachTab()`: ghi cache khi trích xuất thành công (nội dung không đổi → **không** ghi lại, giữ `capturedAt`) · **fallback** về bản cache khi trang đang lỗi (PDF scan · extractor rỗng · mất mạng).
  - `apps/extension/src/lib/storage.ts` — thêm `CONTEXT_CACHE_STORAGE_KEY = 'sidekick.contextCache'`.
  - **Test** — `packages/shared/tests/contextHash.test.ts` (mới, 17 test) · `apps/server/tests/requestLogContext.test.ts` (mới, 10 test) · `apps/extension/tests/contextCache.test.ts` (mới, 15 test) · `apps/extension/tests/contextAttach.test.ts` (+2 test cache: nội dung không đổi → giữ `capturedAt`; nội dung đổi → `capturedAt` mới) · `apps/extension/e2e/contextCache.spec.ts` (mới, 3 kịch bản).
  - **Số test toàn repo:** 648 → **696 unit** (shared 140 · server 224 · extension 332) + 29 → **32 E2E**.
  - **Mutation spot-check:** 5/5 mutation bị bắt — bỏ `sort` trong `hashContextItems` (1 test fail) · `context_hash` lấy hash của prompt (3 test fail) · bỏ nhánh `logContextSnapshot` (1 test fail) · bỏ check `contentHash` khi ghi cache (1 test fail) · bỏ `prune()` (1 test fail).
  - **Docs** — `REQUIREMENTS.md` §4.2 (FR-CONTEXT-01 · FR-CONTEXT-12 + ghi chú trạng thái) · §11.1 (bảng traceability) · `SYSTEM_DESIGN.md` §7.3.5 (mới) · §7.2.1 (số test) · §7.2.2 (mutation vòng 3) · §5.2 (retention) · `DESIGN_SYSTEM_BRIEF.md` §3.5.1 (**không có UI mới**) · `IMPLEMENTATION_PLAN.md` task card T-M1-06 ✅ + §3.1i + §3.2 · `COMPARISON_MATRIX.md` §C (C5) + §E (2 dòng mới) · `EVAL_PLAN.md` §3.4.1 (`context_hash` là khoá tái lập lượt chat) · `HANDOFF.md` §2 · `AGENTS.md` + `docs/README.md` (số task/test, việc tiếp theo).

### Changed
- `apps/server/src/services/chatService.ts` — **`request_logs.context_hash` đổi nguồn**: trước đây là `hashText(data.promptText)` (hash của **toàn bộ prompt**: system + history + context) → nay là hash của **context thật đã gửi cho provider** (đã cắt ngân sách). Hệ quả: đổi câu hỏi → hash **không** đổi; đổi nội dung context → hash **đổi** (AC của T-M1-06).
- `request_logs.context_snapshot` trước đây **luôn `null`** (cột có sẵn trong schema + migration `0000` nhưng không được ghi) → nay ghi jsonb khi bật setting `LOG_CONTEXT_SNAPSHOT` (mặc định **TẮT** vì snapshot chứa nội dung trang). Cờ **riêng**, **không** gộp với `logFullContent`.
- `apps/server/tests/chatService.test.ts` — thêm `logContextSnapshot: false` vào các `ChatServiceDeps` fixture.

### Fixed
- `apps/server/src/services/chatService.ts` — comment của `hashText()` ghi sai "SHA-256 rút gọn" trong khi code là djb2 → sửa thành FNV-1a 32-bit và trỏ về hàm dùng chung `hashString()`.

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
  - **Số test toàn repo:** 547 → **648 unit** (shared 123 · server 214 · extension 311) + 23 → **29 E2E**.
  - **Mutation spot-check:** 5/5 mutation bị bắt — Ollama `requiresKey` → `true` (2 test fail) · `maskKey` trả 8 ký tự (7 test fail) · bỏ ghi `completed` khi bấm "Bỏ qua" (3 test fail) · bỏ `preferredProvider` khỏi chain (1 test fail) · bỏ `provider` ưu tiên khỏi request chat (1 test fail).

### Changed
- `apps/server/src/services/chatService.ts` — `request.provider` giờ **đặt đầu** chuỗi provider rồi nối tiếp fallback chain (trước đó nó *thay* chain → mất fallback, vi phạm FR-PROVIDER-04). Không có `request.provider` → hành vi không đổi.
- `apps/extension/src/sidepanel/hooks/useChat.ts` — gửi `provider` ưu tiên (đọc từ `sidekick.preferredProvider`) trong `ChatRequest` → provider user chọn ở onboarding thực sự được dùng cho các lượt chat sau.
- `apps/extension/src/sidepanel/App.tsx` — tách 2 tầng: `App.tsx` chọn giữa `<Onboarding />` và `<ChatWorkspace />`; nội dung chat chuyển nguyên trạng sang `sidepanel/ChatWorkspace.tsx`.
- `apps/server/src/providers/ollama.ts` — `supportsVision()` theo tiền tố model (`llama3.2-vision` · `llava` · `bakllava` · `qwen2-vl` · `qwen2.5-vl` · `minicpm-v` · `moondream` · `gemma3`) thay vì `false`.
  - **Docs** — `REQUIREMENTS.md` §4.9.1 (AC chi tiết FR-UX-02) · `SYSTEM_DESIGN.md` §4.1 (5 endpoint provider) · §4.4.2 (preferred-first) · §4.4.3 (Ollama) · §7.6 (hợp đồng onboarding) · `DESIGN_SYSTEM_BRIEF.md` §3.8 (component onboarding + a11y) · `IMPLEMENTATION_PLAN.md` §3.1h (kết quả T-M1-25) · `COMPARISON_MATRIX.md` §E (tick onboarding + no-login) · `EVAL_PLAN.md` §4.2.1 (onboarding nằm ngoài rubric eval) · `AGENTS.md` + `docs/README.md` (cập nhật số task/test, việc tiếp theo).

### Fixed
- `apps/extension/src/sidepanel/components/onboarding/StepPermissions.tsx` — sửa lỗi lint `no-useless-assignment` (khởi tạo `id` trước `try`).
- `apps/server/src/services/providerService.ts` + `apps/server/tests/helpers/fakeProviderKeyDb.ts` — sửa 2 lỗi lint (`no-useless-assignment` · `no-unused-vars`) chỉ lộ ra khi chạy `eslint` từ **thư mục gốc** repo.

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
