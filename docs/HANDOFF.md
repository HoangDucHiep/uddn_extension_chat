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
| Docs | ✅ Đầy đủ 11 file (`docs/`) + `AGENTS.md` ở root |
| Code | ✅ **M1 (Parity) ĐÓNG** — 23/25 task (T-M1-15 + T-M1-16 ⏸ tạm dừng) — 4 workspace, **1848 unit test + 108 E2E** · **M2 đang làm** (T-M2-02 ✅ · T-M2-03 ✅ · T-M2-03b ✅ · T-M2-04 ✅ · T-M2-05 ✅ · T-M2-06 ✅ · T-M2-21 ✅ · **T-M2-07 ✅** · **T-M2-09 ✅** · **T-M2-08 ✅** · kiểm chứng live Chrome **15/15** mục §11b) |
| Git | ✅ Đã init (`main`) · tag `v0.1` (M0) · tag **`v0.2`** (M1 đóng 2026-11-09) |
| Milestone hiện tại | **M2 — Advanced & Eval** (M0 ✅ · M1 ✅) |
| Task tiếp theo | **T-M2-12 → 17** (eval — deliverable bắt buộc `docs/EVAL_REPORT.md`) — RAG (T-M2-10/11) đã **hoãn** 2026-11-11 |

### Đang làm dở

_(Không có — M1 đóng xong 2026-11-09, tag `v0.2`)_

### M2 — tiến độ (2026-11-11) — **10/23 task ✅**

| Nhóm / Task | Trạng thái | Ghi chú |
|---|---|---|
| **Nhóm Provider** — T-M2-02 · T-M2-03 · T-M2-03b | ✅ **xong** | [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.22 (model picker + fallback chain) · §7.23 (token/cost UI) · §7.24 (budget cap — enforce **phía server**, bảng `budget_settings`) |
| **Nhóm Skills** — T-M2-04 · T-M2-05 · T-M2-06 · T-M2-21 | ✅ **xong** | [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.25 (menu `/` + CRUD) · §7.25.8 (import/export JSON) · §7.25.9 (library browser lọc theo tag) · §7.25.10 (**9** skill built-in + điều kiện tab, migration `0005_skill_tab_condition.sql`) |
| T-M2-01 Multi-provider (OpenAI/Anthropic) | ⏸ **đẩy lại** | Quyết định user 2026-11-10: **không thêm provider mới** → giữ nguyên `PROVIDER_IDS` (`mock · groq · openrouter · gemini · ollama`). Phần "model list động" đã xong trong T-M2-02 |
| **Nhóm Tools/MCP/RAG** — T-M2-07 → T-M2-11 | 🟡 **3/5 xong + RAG ⏸** | **T-M2-07 ✅** tool registry + builtin calculator + agent loop · **T-M2-09 ✅** tool call UI + approval gate · **T-M2-08 ✅** MCP client (stdio) + server manager + UI Settings · **T-M2-10 + T-M2-11 (RAG) ⏸ hoãn 2026-11-11** (quyết định user) — xem "Quyết định mới" bên dưới |
| **Nhóm Eval** — T-M2-12 → T-M2-17 | ⬜ **chưa bắt đầu — khối TIẾP THEO (ưu tiên 1)** | Nền có sẵn: contract `evalTaskSchema` + `EVAL_GROUPS` 8 nhóm + CLI `apps/eval` · `request_logs` đủ metric đo (T-M1-14) · `tool_calls` jsonb đã có dữ liệu thật (T-M2-07) · `citations.snippet` hỗ trợ đo `citation_precision`. Dataset `apps/eval/dataset/tasks.json` đang **rỗng `[]`** · `docs/EVAL_REPORT.md` **chưa tồn tại** (deliverable bắt buộc) |
| **Nhóm Could** — T-M2-18 · T-M2-19 · T-M2-20 · T-M2-22 | ⬜ **chưa bắt đầu** | Agentic action · context policy theo domain · web search tool · vision mở rộng — **cắt được** nếu thiếu thời gian (xem §10) |

> **Bảng kết quả chi tiết của M2** (trạng thái task · verify · commit · ảnh hưởng gate parity · trạng thái nền nhóm còn lại) nằm ở [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) **§4.1** — đọc ở đó thay vì tra lại từng file.

### Quyết định mới (2026-11-11) — **hoãn RAG** + chuyển ưu tiên sang Eval

> **Quyết định của user (2026-11-11):** RAG (T-M2-10/11) **không bị xoá** khỏi M2 mà chuyển sang **⏸ hoãn** (cùng cách T-M2-01 đã bị đẩy) → ưu tiên M2 chuyển sang **Eval (T-M2-12 → 17)**.

**Lý do hoãn RAG:**

| # | Lý do |
|---|---|
| 1 | RAG **không** đóng dòng §E nào của checklist parity Edge/Gemini → gate vẫn **34/35 = 97.1%** |
| 2 | `EVAL_GROUPS` (8 nhóm) **không** có nhóm nào đo RAG → `EVAL_REPORT.md` **không** đổi |
| 3 | Điều kiện M2 *"≥ 4 tính năng 🟢"* ([`REQUIREMENTS.md`](REQUIREMENTS.md) §9.2) **đã đạt**: multi-provider (T-M2-02) · self-host (Docker + Postgres) · MCP (T-M2-08) · log/cost (T-M1-14 + T-M2-03) → **không cần** RAG để đạt |
| 4 | Công sức (bảng `rag_documents` + embedder + chunking + retriever + indexer + UI toggle) lớn hơn lợi ích trong phạm vi đồ án |
| 5 | [`REQUIREMENTS.md`](REQUIREMENTS.md) §9.3 vốn đã cho phép cắt RAG với lý do *"Đã có log + export transcript thay thế một phần"* → quyết định này **chốt** luôn phương án đó |

**Nền đã có sẵn nếu mở lại:** `pgvector/pgvector:pg16` chạy sẵn trong `docker-compose.yml` (extension `vector`) · cột `citations.score` đã có · pipeline citation (`CitationChip` · `parseCitationMarkers`) đã hoàn chỉnh.

**Cách trình bày (không overclaim):** **không** nói Sidekick "có RAG" — nói *"RAG là hạng mục đã đánh giá và hoãn vì lợi ích chưa vượt công sức trong phạm vi đồ án; đã đánh giá theo §9.3"*. Trong `EVAL_REPORT.md` ghi **N/A** kèm lý do (không tính điểm 0).

**Docs đã đồng bộ (2026-11-11):** `docs/COMPARISON_MATRIX.md` (§C7 ⏸ · §B15 N/A · §D dòng "RAG local" · §E.1.8 mới) · `docs/REQUIREMENTS.md` (FR-TOOLS-05 ⏸ · bảng coverage FR · §9.2 · §9.3) · `docs/IMPLEMENTATION_PLAN.md` (bảng task M2 · §4.1 · §4.1.4 · §4.1.5 · §8 · §10) · `AGENTS.md` (§6) · `docs/CHANGELOG.md` · `docs/README.md`.

### Chuẩn bị cho Eval (T-M2-12 → 17) — bảng làm việc cho session sau

| Task | Nội dung | File đích |
|---|---|---|
| T-M2-12 | Dataset ≥ 48 task × 8 nhóm + snapshot trang + `must_include_facts` | `apps/eval/dataset/tasks.json` (đang rỗng `[]`) + `apps/eval/dataset/snapshots/*` |
| T-M2-13 | Harness runner gọi `POST /api/chat` của BFF, đo TTFT/latency/token/cost | `apps/eval/runners/ours.ts` + `apps/eval/metrics/aggregate.ts` |
| T-M2-14 | Judge prompt + runner (temperature 0) + `blind_map.json` | `apps/eval/judge/{prompt.ts,run_judge.ts}` |
| T-M2-15 | Transcript thủ công Edge + Gemini (n=3) | `apps/eval/results/manual/**` — **cần người thật** |
| T-M2-16 | Chấm tay Tầng B (2 người) → ρ (human vs judge) + κ (human vs human) | `apps/eval/results/human_rubric.csv` — **cần người thật** |
| T-M2-17 | Báo cáo `EVAL_REPORT.md` + radar chart | `docs/EVAL_REPORT.md` — **deliverable bắt buộc** |

**Nền đã có sẵn (không phải làm lại):** contract dataset `packages/shared/src/schemas/eval.ts` (`evalTaskSchema` + `EVAL_GROUPS` 8 nhóm) → `apps/eval` validate bằng đúng schema đó · loader + filter `apps/eval/src/dataset.ts` (`loadDataset` + `filterTasks`) · CLI `apps/eval/src/cli.ts` (hiện có subcommand `logs`) · metric server đã ghi: `request_logs` (`ttft_ms` · `latency_ms` · `tokens_in/out` · `cost_usd` · `tool_calls` jsonb) + bảng `tool_calls` (T-M2-07) + `citations.snippet` (T-M1-08 → hỗ trợ đo `citation_precision`).

**Rủi ro cần xử lý:**
- [`EVAL_PLAN.md`](EVAL_PLAN.md) §10 yêu cầu `must_include_facts` cho ≥ 80% task và ≥ 40% tiếng Việt → dataset **không** được sinh hàng loạt bằng script, phải có đáp án tham chiếu thật.
- T-M2-15/16 **cần người thật** → phát **song song** với T-M2-12 → 14 (phần tự động) để không bị nghẽn lead-time.

### Quyết định mới (2026-11-10) — thứ tự ưu tiên M2

| Quyết định | Lý do |
|---|---|
| **Hoàn tất nhóm Skills (T-M2-05 → 06 → 21) trước**, rồi mới sang Tools/MCP/RAG | 3 task Skills là **mở rộng trên code đã có** (CRUD + `tags` + `scope` sẵn trong schema) → nhỏ hơn hẳn nhóm greenfield · đóng được dòng §E "Skills" + B8/C10/C14 → claim trong báo cáo khớp thực tế |
| ~~**Eval (T-M2-12 → 17) để sau**~~ → **đã đảo lại 2026-11-11** | Eval đo chất lượng sản phẩm → chạy trên feature chưa ổn định thì phải chạy lại · T-M2-15/16 cần người thật → nên chạy **song song** khi feature đã ổn định. **→ 2026-11-11:** RAG đã hoãn → feature đã ổn định → Eval lên **ưu tiên 1** (deliverable bắt buộc) |
| FR-SKILL-06 → làm **đầy đủ** (skill khai báo điều kiện tab → khi chạy tự đính kèm tab hiện tại / tab được chọn) | Đối chiếu trực tiếp B6 của Chrome Gemini ("chạy trên tab hiện tại + tab được chọn") |
| Vị trí import/export skill → **trong drawer Kỹ năng** | Gần chỗ user đang quản lý skill · không nhân bản UI pattern mới |
| Import skill trùng tên → **bỏ qua** + toast tổng kết | Đơn giản, không hỏi lại user · giữ nguyên skill cũ |

**Tóm tắt T-M2-02 (FR-PROVIDER-03/04):**

- **Danh sách model động:** `GET /api/providers/:id/models` → `ProviderAdapter.discoverModels?(apiKey)` (`openaiCompatible.ts` gửi `Authorization` · `gemini.ts` gửi `x-goog-api-key`) → trả `{ providerId, models, source: 'live' | 'fallback' }`. Trước đây `GET /models` **không** có key → provider trả 401 → luôn rơi về danh sách tĩnh.
- **Fallback chain runtime** (`apps/server/src/services/chatService.ts`): lặp chuỗi ứng viên; fallback **chỉ** khi lỗi `retryable` **và** `streamedToken === false` (đã stream dở → không fallback để tránh nội dung trùng lặp) · 401/403 → **không** fallback · provider không có key / không hỗ trợ vision → **bỏ qua** · khi chuyển provider → **tính lại** context budget + prompt.
- **SSE `provider_switch`** `{ from, to, reason, model }` → extension đổi chip provider + **toast** "Đã chuyển sang provider X".
- **Log:** cột mới `request_logs.fallback_from` (migration `apps/server/drizzle/0002_certain_vector.sql`).
- **UI:** `ModelPicker` (Radix Popover) ở header · lựa chọn lưu `chrome.storage.local` key `sidekick.modelSelection` → persist qua reload, gửi kèm mỗi lượt chat.

**Tóm tắt T-M2-03 (FR-PROVIDER-05):**

- `UsageBadge` dưới bubble assistant: token vào/ra + `~ $0.0123` (4 chữ số thập phân) · provider local (`mock`/`ollama`) → chỉ hiện token.
- Section **"Chi phí & sử dụng"** trong Settings: `GET /api/usage` → tổng token + tổng chi phí + bảng **theo ngày** (`byDay[]`) · khoảng `today/7d/30d/all` (mặc định `7d`, đổi khoảng → gọi lại API).
- Chi phí do **server** tính từ `PROVIDER_PRICING` → extension chỉ hiển thị → **không** lệch với giá thật.

**Ảnh hưởng lên gate parity:** checklist §E `COMPARISON_MATRIX.md` **32/35 = 91.4%** → **33/35 = 94.3%** (đóng dòng "Token/cost hiển thị") — xem §E.1.3.

**Tóm tắt T-M2-03b (FR-PROVIDER-06 — budget cap):**

- **Enforce phía server**: cấu hình hạn mức lưu trong **Postgres** (bảng `budget_settings`, singleton `id = 'default'`) → server là nguồn chặn sự thật; client **không** tự so sánh.
- **Kỳ**: `daily` (từ 00:00 hôm nay) · `monthly` (từ 00:00 ngày 1) theo **giờ local của máy chạy BFF** (BFF chạy local cùng máy → khớp "hôm nay" của user).
- **2 mức**: `warnThresholdPercent` (mặc định 80) → cảnh báo; vượt 100% → `exceeded`; `hardBlock` (tuỳ chọn, mặc định bật) → **chặn** lượt chat mới.
- **Chặn = 0 chi phí**: kiểm tra budget **trước** `prepareTurn` → không tạo turn, **không gọi provider** → SSE `budget` → `error(BUDGET_EXCEEDED, 402, retryable:false)` → `done(finishReason:'error')`; lượt bị chặn vẫn ghi 1 dòng `request_logs` (cost 0).
- **API**: `GET /api/budget` · `PUT /api/budget` (validate Zod ở biên).
- **SSE event `budget`** `{ state, spentUsd, limitUsd, percentUsed, period }` — emit trước `meta` và thêm 1 lần sau lượt (đã cộng `costUsd`).
- **UI**: section "Ngân sách chi phí" trong Settings + `BudgetBanner` dưới header (`warning` → `--warning`, `exceeded` → `--danger`) + `ErrorState` case `budget` (ẩn "Thử lại", hiện "Mở cài đặt hạn mức").
- **Không ảnh hưởng gate parity** → checklist §E giữ nguyên **33/35 = 94.3%** (dòng C6 chỉ ghi thêm, không thêm dòng §E).

**Kiểm chứng live (2026-11-10, BFF + Docker + `.env` có K1):** `GET /api/budget` → `state: "disabled"` · `PUT` hạn mức `0.01` USD → `state: "exceeded"` (đã dùng `0.0399`) → `POST /api/chat` → SSE `budget` (`exceeded`) → `error` `BUDGET_EXCEEDED` (`retryable: false`) → `done(finishReason: "error")` · `request_logs` ghi 1 dòng `error = BUDGET_EXCEEDED`, `cost_usd = 0` → **không** gọi provider · kỳ `daily` → `periodStart` = 00:00 hôm nay theo giờ local · `PUT` sai (`limitUsd = -1`) → **400 `VALIDATION_ERROR`**.

**Số liệu test sau T-M2-02/03/03b (2026-11-10):** shared 263 · server 414 · extension 762 · eval 11 = **1450 unit** + **94 E2E** (25 file). `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ · `pnpm build` ✅ (`dist/content.js` 17.27 kB) · `pnpm test:e2e` ✅ (94/94).

**Tóm tắt T-M2-04 (FR-SKILL-01/02/03 — Skills):**

- **Server resolve skill** (quyết định thiết kế chính): client gửi `skillId` trong `POST /api/chat` → server nối `prompt_template` vào system prompt + `model` của skill **ghi đè** model của request → client **không** cần biết nội dung template.
- **Placeholder `{input}` 2 lớp** (tránh lặp nội dung): `buildSkillInstruction(template)` **loại bỏ** `{input}` → system prompt · `applySkillTemplate(template, câu hỏi)` → **user turn cuối cùng** → câu hỏi xuất hiện **1 lần**. *(Đã sửa trong lúc audit: `applySkillTemplate` trước đó **chưa** được gọi ở server → prompt mẫu có `{input}` bị model nhận dạng rỗng.)*
- **Token `/ten-skill` bị loại** khỏi câu hỏi: client strip (`useSkillCommand.strip`) + server strip lần 2 (`stripSkillToken`, chỉ đúng tên skill vừa resolve → **không** xoá nhầm URL). *(Lần 2 cũng **chưa** được gọi ở server → đã bổ sung.)*
- **Nơi lưu**: Postgres (bảng `skills`, migration `apps/server/drizzle/0004_worthless_earthquake.sql`) cho skill của **user** + registry **trong code** (`apps/server/src/skills/builtin.ts`) cho built-in → **không** cần migration seed.
- **Seed built-in tối thiểu 3 skill** (`tom-tat` · `giai-thich-don-gian` · `dich`, uuid cố định) — thư viện ≥ 8 skill nằm ở **T-M2-21**.
- **Menu `/`**: popover `SkillMenu` trên textarea · lọc **prefix** · `Enter` chọn · `Tab` autocomplete · `Escape` đóng · token `/` chỉ bắt ở **word boundary** → paste URL **không** mở nhầm menu · chỉ **1** popover mở tại một thời điểm (loại trừ với mention `@`).
- **CRUD**: drawer `SkillManager` trượt **trái** (mở từ nút icon `Sparkles` ở header) · 2 nhóm **Có sẵn** / **Của tôi** · dùng nhanh · sửa (`SkillFormDialog`) · nhân bản (`${name}-copy`) · xoá (có `ConfirmDialog`) · xoá/sửa built-in bị server **từ chối** (`FORBIDDEN`).
- **Tạo skill từ message**: action **"Lưu thành kỹ năng"** trên **user message** → prefill form với nội dung message.
- **API**: `GET/POST/PATCH/DELETE /api/skills` (validate Zod ở biên → `400 VALIDATION_ERROR`; tên trùng → `CONFLICT`).
- **Ảnh hưởng gate parity (cập nhật cuối):** dòng §E "Skills `/` + tạo/sửa/xoá skill + library có sẵn + trang duyệt skill library" → **✅ ĐÓNG** ở **T-M2-21** → checklist §E **33/35 = 94.3%** → **34/35 = 97.1%** (xem `COMPARISON_MATRIX.md` §E.1.5).

**Tóm tắt T-M2-05 (FR-SKILL-05 — import/export JSON):**

- **Định dạng file:** `version: 1` + `exportedAt` (ISO 8601) + `skills[]` → `sidekick-skills-<yyyyMMdd-HHmm>.json`.
- Export **chỉ** scope `user` (built-in nằm trong registry trong code → export ra rồi import lại sẽ đụng tên) · import **bỏ** `id`/`scope`/timestamps → server tự sinh id mới → không ghi đè skill máy khác.
- Skill **trùng tên** → **bỏ qua** + toast tổng kết (tối đa 100 skill / lần import).
- **Không** cần endpoint mới — export dùng `GET /api/skills?scope=user`, import dùng `POST /api/skills` (server trả `CONFLICT` → client bỏ qua).
- UI: nút **"Xuất JSON"** / **"Nhập JSON"** trong drawer Kỹ năng (`downloadTextFile` có sẵn → **không** cần permission `chrome.downloads`).

**Tóm tắt T-M2-06 (FR-SKILL-07 — skill library browser):**

- Lọc **phía server** (`GET /api/skills?q=...&tags=a,b`) → không tải toàn bộ skill về client. Chế độ khớp tag = **`any`** · `q` khớp **tên hoặc mô tả**.
- Contract: `skillListQuerySchema.tags` nhận **2 dạng** (`?tags=a&tags=b` hoặc `?tags=a,b`).
- UI: tab **"Thư viện"** trong drawer Kỹ năng (`SkillLibrary`) · ô tìm kiếm · chip tag toggle (`aria-pressed`) · click card → **chạy ngay** (chen `/ten-skill` + đóng drawer + focus composer) · trạng thái `loading`/`empty`/`emptyFiltered`/`error`.

**Tóm tắt T-M2-21 (FR-SKILL-04/06 — thư viện built-in + điều kiện tab):**

- **9 skill built-in** (`tom-tat` · `giai-thich-don-gian` · `dich` · `so-sanh` · `trich-xuat-du-lieu` · `viet-email` · `sinh-quiz` · `kiem-tra-hieu` · `so-sanh-nhieu-tab`) — uuid cố định `a1000000-0000-4000-8000-0000000000NN` · mỗi skill ≥ 1 tag (dùng cho chip lọc T-M2-06) · **không** cần migration seed.
- **Điều kiện tab** (FR-SKILL-06): cột `skills.tab_condition` **jsonb** (migration `0005_skill_tab_condition.sql`) · contract `SkillTabCondition` + `hasTabCondition()`.
- UI: 2 checkbox trong `SkillFormDialog` ("Chạy trên tab hiện tại" · "Chạy trên tab được chọn") · badge `SkillConditionBadge` ở menu `/` + thư viện · popover chọn tab `SkillTabPicker` (dùng lại `useTabs`).
- **Hành vi:** chọn skill có điều kiện → `useCurrentTab` tự đính kèm trang hiện tại · `useSelectedTabs` mở popover chọn tab → tab được chọn được đính kèm. Skill **không** có điều kiện → **không** tự đính kèm (giữ nguyên FR-CONTEXT-13).
- **Đóng dòng §E "Skills"** → **34/35 = 97.1%** (§E.1.5) · **B8** ✅ · **B26** ✅ · **C10** ✅ · **C14** ✅.

**Tóm tắt T-M2-07 (FR-TOOLS-01/02/06 — tool registry + calculator + agent loop):**

- **Tool registry** (`apps/server/src/tools/registry.ts`): đăng ký tool theo tên · `requiresApproval` · `toDefinitions()` map sang OpenAI-compatible `tools` payload · ghi đè khi trùng tên.
- **Builtin calculator** (`apps/server/src/tools/calculatorTool.ts`): tokenizer + shunting-yard → RPN → đánh giá biểu thức · hỗ trợ `+ - * / ^ ( )` và hàm cơ bản · chặn chia 0 · giới hạn độ dài biểu thức · chặn ký tự lạ · **read-only → không cần duyệt**.
- **Tool executor** (`apps/server/src/tools/executor.ts`): chạy tool → `ToolResult` · tool throw → `ok: false` + message · tool không tồn tại → lỗi chuẩn · cắt output quá dài.
- **Agent loop** (`apps/server/src/services/toolAgentLoop.ts`): vòng lặp `tool_call` → `tool_result` → token · ghi bảng `tool_calls` · **giới hạn `MAX_TOOL_ROUNDS`** → dừng + cảnh báo · **approval gate**: tool `requiresApproval: true` → **không** chạy tool, emit SSE `tool_approval` chờ user duyệt.
- **Adapters**: `openaiCompatible.ts` gom partial JSON theo `index` · `finish_reason: 'tool_calls'` → `finishReason: 'tool'` · `mock.ts` trả tool call ở vòng 1 rồi text ở vòng 2.
- **Provider scope:** `groq` · `openrouter` · `ollama` (OpenAI-compatible) + `mock` — **Gemini tạm chưa** (tool-calling format khác).
- **DB:** bảng `tool_calls` đã có sẵn từ M0 → **không** migration mới.

**Tóm tắt T-M2-08 (FR-TOOLS-01/02 — MCP client stdio + server manager):**

- **Protocol** (`apps/server/src/tools/mcp/protocol.ts`): JSON-RPC 2.0 thuần trên stdio (newline-delimited JSON) · `encodeMessage` / `parseMessages` / `createRequest` / `createResult` / `createError` — **không** import Zod (giữ nhẹ, test được ngoài DB).
- **Client** (`apps/server/src/tools/mcp/client.ts`): spawn child process → `initialize` (`protocolVersion: '2024-11-05'` + `clientInfo`) → `notifications/initialized` → `tools/list` · `tools/call` · timeout **10 s** (`MCP_LIMITS.REQUEST_TIMEOUT_MS`) · stderr giữ làm chẩn đoán · `disconnect` **idempotent**.
- **Manager** (`apps/server/src/tools/mcp/manager.ts`): đối chiếu config trong DB với process đang chạy · namespace tool `mcp__<serverName>__<toolName>` (hợp lệ với tên function call OpenAI `[a-zA-Z0-9_-]{1,64}`) · mặc định `requiresApproval = !autoApprove` · tool cũ bị **gỡ theo prefix** khi server bị sửa/xoá · **1 server lỗi không chặn** server khác.
- **DB:** bảng `mcp_servers` (`apps/server/src/db/schema.ts` + migration `apps/server/drizzle/0006_mcp_servers.sql`) — lưu `command`/`args`/`env`/`enabled`/`auto_approve`/`last_connected_at`/`last_error`.
- **API:** `GET/POST/PATCH/DELETE /api/mcp/servers` · `POST /api/mcp/servers/:id/reconnect` · `GET /api/mcp/tools`.
- **Agent loop:** `chatService.ts` **refresh** manager từ DB trước khi `resolveToolDefinitions()` → lỗi MCP chỉ được log, **không** làm hỏng luồng chat.
- **UI (T-M2-08 phần extension):** `McpSettings.tsx` — section "Máy chủ MCP" trong Settings · badge trạng thái · số tool · lỗi · form thêm server (args mỗi dòng 1 arg · env `KEY=VALUE`) · nút kết nối lại · xoá (confirm) · client `lib/mcpClient.ts` · i18n đủ key VI/EN.
- **Script mẫu:** `apps/server/scripts/sample-mcp-server.mjs` (tool `echo` + `add`) để demo tay và test offline.
- **Giới hạn:** chỉ transport **stdio** (HTTP/SSE → task sau) · `gemini` chưa hỗ trợ tool.

**Số liệu test sau T-M2-08 (2026-11-11):** shared 329 · server 632 · extension 876 · eval 11 = **1848 unit** + **108 E2E** (28 file). `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ · `pnpm build:ext` ✅. E2E mcp **4/4** ✅ (mock provider offline).

**Tóm tắt T-M2-09 (FR-TOOLS-02/04 — tool call UI + approval gate):**

- **UI:** `ToolCallBlock` trong bubble assistant (sau nội dung, trước nút hành động) · collapsible (mặc định thu gọn) · badge trạng thái (`ok`/`error`/`denied`/`running`/`pending`) · args + output trong `<pre>`.
- **Approval gate:** badge "Cần bạn duyệt" + nút **Duyệt** / **Từ chối** → `POST /api/tools/:callId/approve` (`/deny`) → toast.
- **State:** `ChatToolCall` + `addToolCall` / `updateToolCall` trong `chatStore` · SSE `tool_call` · `tool_result` · `tool_approval` xử lý trong `useChat`.
- **Lịch sử:** server join bảng `tool_calls` → `ConversationMessage.toolCalls` → extension map sang `ChatMessage.toolCalls` → block hiện lại khi mở lại conversation.
- **API mới:** `GET /api/tools` · `POST /api/tools/:callId/approve` · `POST /api/tools/:callId/deny`.

**Số liệu test sau T-M2-07 + T-M2-09 (2026-11-11):** shared 329 · server 575 · extension 860 · eval 11 = **1775 unit** + **104 E2E** (27 file). `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ · `pnpm build:ext` ✅ (`dist/content.js` **17.27 kB** — code tool **không** lọt vào content script). E2E tools **4/4** ✅ (mock provider offline).

**Số liệu test sau T-M2-04 (2026-11-10):** shared 284 · server 458 · extension 812 · eval 11 = **1565 unit** + **100 E2E** (26 file). `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ · `pnpm build` ✅ (`dist/content.js` **17.27 kB** — code skill **không** lọt vào content script) · E2E skills **6/6** ✅.

**Kiểm chứng live trên Chrome thật (2026-11-10):** `pnpm manual:checklist` (script mới — `scripts/manual-checklist.mjs`) load extension **unpacked** vào Chrome (profile tạm) → **15/15 mục** của `MANUAL_TEST_GUIDE.md` §11b **pass**:
- **Model động:** `openrouter` → **428 model** (`source: "live"`) · lọc tìm kiếm `428 → 7` · lựa chọn lưu đúng `chrome.storage.local`.
- **Fallback live:** BFF phụ (port `8791`, `DEFAULT_PROVIDER=ollama` — Ollama không chạy → lỗi network retryable) → SSE `provider_switch` **`ollama → groq`** → `request_logs`: `provider="groq" fallback_from="ollama"`.
- **Chi phí:** badge `↑ 124 ↓ 212 token · $0.0002` · Settings tổng `65,190` token / `$0.0374` · bảng theo ngày 4 dòng · khoảng "Hôm nay" `60,838` ≠ "Tất cả" `65,190` (lọc đúng).
- Ảnh chụp lưu ở `artifacts/manual-test/` (git-ignore).

**Bộ chọn khoảng thời gian trong Settings (bổ sung T-M2-03):** section "Chi phí & sử dụng" có 4 nút `Hôm nay / 7 ngày / 30 ngày / Tất cả` (mặc định `7d`) → `GET /api/usage?from=…` (`from` = ISO 8601, canh đầu ngày theo giờ local). Khoảng `all` → không gửi `from`. Đổi khoảng → gọi lại API ngay (không cần bấm "Làm mới").

**Lưu ý vận hành:** Postgres chạy trong container `sidekick-db` → **Docker Desktop phải chạy** trước khi `pnpm dev:server`, nếu không `/api/usage` + `/api/logs` trả **500** (health báo `db: "down"`). Đã ghi trong `MANUAL_TEST_GUIDE.md` §12.

**Quan sát về độ ổn định của E2E (2026-11-10):** E2E gọi **provider thật** (Groq/OpenRouter) → tỉ lệ lỗi phụ thuộc **quota provider**, không phải logic repo. 1 lần chạy bị **4 failed / 87 passed** và kéo dài **52 phút** vì Groq trả **413 TPM** → fallback sang OpenRouter (chậm hơn) → timeout. Chạy lại ngay: **91/91 pass trong 3.9 phút**. Khi thấy E2E chậm bất thường → kiểm tra `request_logs` xem có lỗi `413` / rate-limit không trước khi nghi ngờ hồi quy. **Không chạy 2 suite E2E song song** — chúng dùng chung quota provider và sẽ tranh nhau (2 lần chạy song song đã cho 4 + 5 fail).

**Lưu ý vận hành script `pnpm manual:checklist`:** script khởi động BFF phụ ở port `8791` và **phải** dọn sau khi chạy. Đã có bug `child.kill()` không giết tiến trình con `tsx` trên Windows → giữ port `8791` lại; đã sửa bằng `killProcessTree()` (`taskkill /T /F`). Nếu chạy tay và bị báo `port 8791 đã dùng` → `taskkill /PID <pid> /T /F`.

> **Flake đã biết:** lần chạy E2E đầu tiên có `e2e/contextCache.spec.ts > trang đang lỗi → fallback về nội dung đã cache` fail (`expect(request?.context?.items).toHaveLength(1)` → `received value must have a length property`) — chạy lại **riêng** file đó thì **3/3 pass**, chạy lại **cả suite** thì **91/91 pass** → **flake do tải song song**, không phải hồi quy code. Nếu gặp lại: chạy lại `pnpm test:e2e` trước khi sửa code.

**Endpoint đã kiểm chứng live** (BFF + Docker + `.env` có K1):

```
GET /api/providers/groq/models       → source=live  count=11
GET /api/providers/openrouter/models → source=live  count=427
GET /api/providers/gemini/models      → source=live  count=47
```

### Kết quả đóng M1 (2026-11-09)

- **3 task cuối của M1:** T-M1-13 export conversation (`.md` / `.json` — commit `0a8d9d6`) · E2E chứng minh parity "panel giữ nguyên khi chuyển tab" (commit `07fb7ce`) · đồng bộ contract eval với `EVAL_PLAN.md` (commit `03a1d69`).
- **Gate M1 ĐẠT:** checklist §E `COMPARISON_MATRIX.md` **32/35 = 91.4%** · dòng "Must" ở §A/§B **21/23 = 91.3%** (cả 2 ≥ 90%).
- **3 dòng §E còn mở** — đều có task kế tiếp, không phải thiếu sót: Skills `/` + library → **T-M2-04/06/21** (Chrome Gemini cần đăng nhập Google cho Skills; Sidekick cố ý không phụ thuộc tài khoản hãng) · token/cost **UI** → **T-M2-03** (phần log đã đầy đủ ở M1) · Direct/BYOK fallback → **T-M1-15/16** (⏸ tạm dừng).
- **Giới hạn đã ghi rõ:** vế "≥ 8/10 trang thật" của gate là **dataset eval M2** (hiện rỗng `[]`) → cover bằng **15 fixture HTML** + E2E trang thật ở M1, **không** tuyên bố đã đạt 8/10 trang thật.
- **Test tại lúc đóng M1:** shared 243 · server 377 · extension 706 · eval 11 = **1337 unit** + **88 E2E** (23 file). `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ · `pnpm build` ✅ · `pnpm test:e2e` ✅ (88/88).
- **Lưu ý chạy E2E:** cần **Docker Desktop đang chạy** + BFF lên (`pnpm dev:server`) → 4 kịch bản `citation` · `markdown` · `sidepanel` · `vision` gọi BFF thật. Docker tắt → 4 test fail (không phải hồi quy code).- Chi tiết: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) §3.1u · [`COMPARISON_MATRIX.md`](COMPARISON_MATRIX.md) §E.1 / §E.1.1 / §E.1.2 · [`REQUIREMENTS.md`](REQUIREMENTS.md) §9.

### Hướng dẫn test tay cho người dùng

- **`docs/MANUAL_TEST_GUIDE.md`** (mới, 2026-11-08) — hướng dẫn **cài extension + chạy hạ tầng local + test tay từng tính năng M1** (18 mục checklist) + bảng "xử lý sự cố" + bảng "đã có / chưa có".
- Đăng ký trong `docs/README.md` (bảng tài liệu) + `docs/CHANGELOG.md`.

### Việc đã xong gần đây (fix bundle content script — sau T-M1-20)

- **Hồi quy bundle `dist/content.js`** — phình từ **13.87 kB** → **151 kB** (T-M1-17) → **~46 kB** (T-M1-20) → nay **17.27 kB** (gzip 6.65 kB).
  - **Nguyên nhân 1 (T-M1-17)** — `lib/i18n.ts` → `lib/settings.ts` → `@sidekick/shared` (barrel `index`) → toàn bộ bundle **Zod** (~100 kB).
  - **Nguyên nhân 2 (T-M1-20)** — `lib/i18n.ts` → `i18n/index.ts` → `i18n/vi.ts` + `i18n/en.ts` (dictionary **đầy đủ** ~34 kB).
  - **Cách sửa** — tách **2 tầng dictionary**:
    - `i18n/format.ts` (mới) — `formatMessage()` + `resolveLanguage()`, **không** import dictionary.
    - `i18n/outsidePanel.vi.ts` (mới) — **nguồn sự thật** của **4** khoá ngoài panel (`content.selectionButton` · `content.selectionButtonLabel` · `background.menu.open` · `background.menu.askSelection`).
    - `i18n/outsidePanel.en.ts` (mới) — bản EN (kiểu ràng buộc key) · `i18n/outsidePanel.ts` (mới) — `createOutsidePanelTranslator()` · `i18n/surface.ts` (mới) — union `OutsidePanelKey`.
    - `lib/i18nSurface.ts` (mới) — `getSurfaceTranslator()` cho content script + service worker.
    - `lib/storageKeys.ts` (mới) — khoá storage + `readStoredUiLanguage()` đọc **thuộc tính** trực tiếp, **không** validate bằng Zod.
    - `i18n/vi.ts` + `en.ts` — spread dictionary rút gọn vào dictionary đầy đủ → **nguồn sự thật** vẫn 1 chỗ.
    - `content/contentScript.ts` + `background/contextMenus.ts` — dùng `getSurfaceTranslator()`.
  - **Guard hồi quy** — `apps/extension/tests/contentBundleGuard.test.ts` (mới, **10 test**): duyệt **đệ quy đồ thị phụ thuộc** của `src/content/contentScript.ts` → chặn `@sidekick/shared` (barrel) · dictionary đầy đủ · `react` · `zod`; kèm assert `dist/content.js` **≤ 40 kB** + không chứa marker Zod.
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (**1311 unit** = shared 243 · server 377 · extension 691) · build ✅ (`dist/content.js` 17.27 kB).
- Bằng chứng đầy đủ: `docs/SYSTEM_DESIGN.md` §7.5.1 + §7.5.2 · `docs/CHANGELOG.md`.

### Quyết định kỹ thuật mới (fix bundle content script)

| Quyết định | Lý do |
|---|---|
| Tách **2 tầng dictionary** (đầy đủ / rút gọn 4 khoá) thay vì 1 | Content script chạy ở **mọi** trang → bundle phình ảnh hưởng tốc độ load trang; ngoài panel chỉ cần **4** khoá |
| `lib/storageKeys.ts` tách riêng, **không** validate bằng Zod | Zod là thứ làm bundle phình; đọc **thuộc tính** trực tiếp + kiểm tra `vi`/`en` bằng so sánh chuỗi là đủ |
| `i18n/vi.ts` + `en.ts` **spread** dictionary rút gọn vào | Giữ **1 nguồn sự thật** cho danh sách khoá — không phải khai báo lại 4 khoá ở 2 nơi |
| Guard dựa trên **đồ thị phụ thuộc**, không grep từng file | Bản grep **lọt lưới**: đổi `contentScript.ts` sang import `../lib/i18n.js` vẫn xanh, dù kéo theo dictionary đầy full — đã kiểm chứng bằng mutation spot-check |
| `import type` **không** bị guard báo động | Bị **xoá khi build** → không ảnh hưởng bundle; báo động giả làm guard mất uy tín |
| Resolver của guard phải bỏ đuôi `.js` | Quy ước import nội bộ: `from '../lib/i18nSurface.js'` → file nguồn là `.ts` |

### Việc đã xong gần đây (T-M1-20 — Responsive 320–640px + a11y pass cơ bản)

- **T-M1-20 (FR-UX-06/07/09/10 + NFR-A11Y-01..05)** — side panel nay **không tràn ngang** ở 320–640px và đạt a11y cơ bản (WCAG 2.2 AA).
  - **Responsive** — `#root` dùng `min-width: min(var(--panel-min-width), 100%)` (trước: cứng `320px` → tràn khi panel < 320px) · drawer Settings `w-[min(360px,92vw)] max-w-full` · drawer conversation + confirm dialog `max-w-full` · chip/nguồn `max-w-[min(180px,100%)]` · `min-w-0` cho bubble + textarea · `overflow-x-hidden` cho thread.
  - **Focus ring** — 12 chỗ `focus-visible:outline-none focus-visible:ring-[var(--focus-ring)]` → chuẩn hoá `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]` (1 token, đồng bộ `Button`/`Input`/`Textarea`).
  - **Live region (NFR-A11Y-05)** — `role="article"` + `aria-live="polite"` + `aria-atomic="false"` + `aria-relevant="additions text"` **chỉ** trên `MessageContent` khi đang stream; thread `role="log"` **không** đặt `aria-live` → screen reader không đọc lại lịch sử cũ. Dòng "Đang tạo câu trả lời..." → `role="status"`.
  - **Skip-link** — `<SkipLink />` trong `App.tsx` → anchor `#sidekick-composer-input` (`id` đặt trên `<Textarea>`), `sr-only focus:not-sr-only`.
  - **Tap target ≥ 24px** (WCAG 2.2 §2.5.8) — icon-button `p-[2px]` (~18px) ở `ContextChips` · `ContextNotice` · `PromptGallery` · `AttachmentTray` · nút đóng `Dialog` → `h-6 w-6`.
  - **`role="tab"`** — tab nhóm conversation có `id` + `aria-controls="conversation-panel"` + roving `tabIndex`; panel có `role="tabpanel"`.
  - **i18n dọn sót** — `composer.hint` · `chat.oldVersions` · `chat.threadLabel` + nhãn đóng Dialog → `t()`. `useI18n` **chuyển** từ `sidepanel/hooks/` → `src/i18n/useI18n.ts` (file cũ re-export) để `components/ui/dialog.tsx` dịch được mà không import ngược tầng.
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (extension **681** unit = 672 + 9 test mới) · build ✅ · E2E `e2e/responsive.spec.ts` (5 kịch bản 320/480/640px) ✅.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1t · `docs/SYSTEM_DESIGN.md` §7.19 · `docs/DESIGN_SYSTEM_BRIEF.md` §5.

### Quyết định kỹ thuật mới (T-M1-20)

| Quyết định | Lý do |
|---|---|
| Live region đặt trên **`MessageContent`**, **không** đặt trên thread | Thread chứa cả lịch sử cũ → `aria-live` ở đó khiến screen reader đọc lại **toàn bộ** chat mỗi lần stream. Pattern đúng: chỉ đánh dấu phần **vừa** thay đổi, `aria-atomic="false"` |
| Focus ring dùng **outline 1 token**, không dùng `box-shadow` (`--focus-ring`) | `--focus-ring` là shadow 2 vòng → phải `outline: none` để tránh chồng; outline chỉ cần **1** token `--border-focus` → đồng bộ toàn bộ component, không còn `outline: none` trần |
| "Responsive" của side panel = **không tràn ngang**, không phải breakpoint | Side panel là 1 cột do user kéo → không có viewport ngang như web app → mọi bề rộng cứng phải `min(..., 100%)` |
| `useI18n` đặt ở **`src/i18n/`** (không phải `sidepanel/hooks/`) | `components/ui/dialog.tsx` là component dùng chung → không được import ngược từ tầng `sidepanel/` (vi phạm layering) |
| Test a11y kiểm **source-level** (quét class trong file) cho focus ring + tap target | jsdom không tính kích thước hiển thị → chỉ assert được bằng cách đọc class → bắt được hồi quy "đổi lại về `outline-none`" |
| Không thêm dependency / permission / migration | Task là **UI + CSS** — không cần chạm schema DB hay manifest |

### Việc đã xong gần đây (T-M1-18 — keyboard shortcuts cấu hình được)

- **T-M1-18 (FR-UX-01)** — Settings có section "Phím tắt" với **2 lớp**:
  - **Lớp 1 — native của Chrome** — đọc shortcut đang gán bằng `chrome.commands.getAll()` + nút mở `chrome://extensions/shortcuts` (Chrome **không** cho extension tự đổi shortcut gốc).
  - **Lớp 2 — nhanh của Sidekick** — lưu `chrome.storage.local` key `sidekick.shortcuts` · bấm "Đổi" → ô bắt phím · nút "Về mặc định" · tổ hợp bị **deny-list** (28 tổ hợp dành riêng của trình duyệt) thì báo lỗi `reserved`; tổ hợp sai → lỗi `invalid`.
  - **Kiến trúc** — `lib/shortcuts.ts` (thuần: `normalizeShortcut` · `isReservedShortcut` · `parseShortcut` · `shortcutFromKeyboardEvent` · `matchesShortcut` · `formatShortcutLabel` · `RESERVED_CHROME_SHORTCUTS` · `DEFAULT_SHORTCUTS` · `SHORTCUT_COMMANDS`) · `lib/shortcutStorage.ts` (`readShortcuts` · `writeShortcut` · `clearShortcut` · `resolveShortcut`) · `lib/shortcutProtocol.ts` (hằng + type guard, **không** Zod) · `lib/shortcutBridge.ts` (SW → `chrome.sidePanel.open()`) · `content/shortcutListener.ts` (bắt `keydown` trong content script, bundle IIFE **không** chứa React) · `sidepanel/components/settings/ShortcutsSettings.tsx`.
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (extension **672** unit = 643 + 29 test mới) · build ✅ · E2E `e2e/shortcuts.spec.ts` (3 kịch bản) ✅.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1s · `docs/SYSTEM_DESIGN.md` §7.18 · `docs/DESIGN_SYSTEM_BRIEF.md` §3.7.1.

### Quyết định kỹ thuật mới (T-M1-18)

| Quyết định | Lý do |
|---|---|
| **Không** dùng `chrome.commands.update()` / `reset()` | **Chrome MV3 không có** 2 API này (chỉ Firefox WebExtensions mới có) — đã probe trong Chromium: `chrome.commands` chỉ có `['onCommand', 'getAll']`. Giả lập API không tồn tại → UI "chết" khi chạy thật |
| **2 lớp** thay vì 1 | Lớp native cho shortcut mở/toggle panel (Chrome quản lý) · lớp nhanh cho lệnh chạy trong panel/trang — cả 2 đều **thực sự chạy được** |
| Deny-list **28** tổ hợp dành riêng của trình duyệt | Tránh user gán phím đã bị Chrome chiếm (`Ctrl+T`, `Ctrl+W`, `Ctrl+N`, …) → gán xong không ăn |
| Chuẩn hoá tổ hợp **trước** khi lưu | `Ctrl+shift+k` và `Ctrl+Shift+K` phải là 1 giá trị → so sánh deterministic |
| `shortcutProtocol.ts` **không** dùng Zod | Content script phải là IIFE nhỏ — tránh kéo Zod vào bundle trang |
| Lưu `chrome.storage.local` (không `session`) | Người dùng cấu hình phím tắt là cài đặt lâu dài → phải còn sau khi đóng browser |

### Quyết định mới trong phiên này (2026-11-08) — BYOK tạm dừng

| Quyết định | Lý do |
|---|---|
| **T-M1-15 (K3 direct) + T-M1-16 (K2 BYOK UI) → ⏸ tạm dừng** | User quyết định bỏ BYOK khỏi sản phẩm (ưu tiên demo đơn giản, 1 nguồn key K1) |
| **Gỡ ô nhập API key khỏi onboarding** (bước 2) → thay bằng thông báo hướng dẫn | Không còn luồng nhập key trong sản phẩm |
| **Giữ nguyên** server `provider_keys` (endpoint + bảng + mã hoá AES-256-GCM) | Đã hoạt động + đã test; xoá sẽ tốn công và rủi ro hồi quy; mở lại = thêm lại UI, **không** migration |
| Ở M1 chỉ có **K1** (team key trong `.env` BFF) + Ollama local (không cần key) | Đủ cho demo/eval; Ollama là fallback khi không có key |

- Bằng chứng: `docs/REQUIREMENTS.md` §4.6.1 · `docs/SYSTEM_DESIGN.md` ADR-9/ADR-12 · `docs/IMPLEMENTATION_PLAN.md` §3 · `docs/COMPARISON_MATRIX.md` §C + §E.

### Việc đã xong gần đây (T-M1-17 — i18n VI/EN)

- **T-M1-17 (FR-SETTINGS-06)** — toàn bộ side panel đã dịch VI/EN. Chọn ngôn ngữ trong Settings → UI đổi **ngay**, **không reload**; persist qua `chrome.storage.local`.
  - **Kiến trúc** — `apps/extension/src/i18n/vi.ts` (`viDictionary` là **nguồn sự thật** của danh sách key → `TranslationKey = keyof typeof viDictionary`) · `i18n/en.ts` (`enDictionary: Dictionary` → **thiếu/thừa key = lỗi `pnpm typecheck`**) · `i18n/index.ts` (`getDictionary` · `resolveLanguage` · `formatMessage` với placeholder `{name}` · `createTranslator`) · `i18n/context.ts` (**không JSX** → content script + SW không import React) · `lib/i18n.ts` (`readUiLanguage` · `translatorFor` · `getTranslator`) · `sidepanel/hooks/useI18n.ts` · `sidepanel/components/I18nProvider.tsx`.
  - **Wiring** — `useSettings()` **nâng lên `App.tsx`** → `settings` + `onSettingsChange` xuống `ChatWorkspace` → `SettingsDrawer`; `<I18nProvider language={settings.uiLanguage}>` bọc **cả** onboarding lẫn chat. `SettingsDrawer` **fallback** về `useSettings()` khi không truyền props → test render độc lập vẫn chạy.
  - **Ngoài panel** — 2 nhãn context menu lấy từ `getTranslator()`; `serviceWorker.ts` nghe `chrome.storage.onChanged` → gọi lại `registerContextMenus()` (idempotent) → nhãn đổi theo ngôn ngữ, **không cần reload trình duyệt**. Nút nổi content script: `localizeSelectionButton()` đọc storage → cập nhật text/aria-label trong Shadow DOM.
  - **Không dịch (có chủ đích)** — gợi ý trang + `SUMMARY_PROMPT` trong `packages/shared/src/pageProfile.ts` (prompt đánh giá phải nhất quán cho eval) · thông điệp lỗi trả về từ server (thuộc phía BFF).
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (**1263 unit** = shared 243 · server 377 · extension **643**) · build ✅ (**kiểm chứng `dist/content.js` không chứa React**) · E2E mới `e2e/i18n.spec.ts` (2 kịch bản).
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1r · `docs/SYSTEM_DESIGN.md` §7.17 · `docs/DESIGN_SYSTEM_BRIEF.md` §3.11.

### Quyết định kỹ thuật mới (T-M1-17)

| Quyết định | Lý do |
|---|---|
| **Không** thư viện i18n (`i18next` / `intl-messageformat`) | Giữ bundle nhỏ + không dependency mới; chỉ cần placeholder `{name}` → `formatMessage()` tự làm |
| `vi.ts` là **nguồn sự thật** của danh sách key | `en.ts` khai kiểu `Dictionary` → thiếu/thừa key bị `pnpm typecheck` bắt ngay (nhanh hơn test runtime) |
| `useSettings()` **nâng lên `App.tsx`** | `I18nProvider` phải bọc **cả** onboarding lẫn chat để đổi ngôn ngữ đồng bộ; drawer nằm trong chat nên không thể tự đọc settings (vòng lặp state) |
| `i18n/context.ts` tách riêng khỏi `i18n/index.ts` | Content script + service worker phải là IIFE nhỏ → **không** kéo React vào bundle |
| Dictionary mặc định = `vi` | Component render đúng nghĩa khi thiếu provider; test cũ assert literal tiếng Việt **không** phải sửa |
| `SettingsDrawer` fallback về `useSettings()` | Không phá test render độc lập (`settingsDrawer.test.tsx`) |
| Không dịch prompt trong `packages/shared` | Prompt đánh giá phải nhất quán giữa các lần chạy eval |

### Quyết định kỹ thuật mới (T-M1-14)

- **T-M1-14 (NFR-MAINT-04 + FR-CONTEXT-12 + NFR-REL-01)** — bảng `request_logs` **không còn là bảng chết**: **mọi** lượt chat (thành công **và** thất bại) đều ghi 1 dòng, `cost_usd` **thật**, `tool_calls` đã wire, `request_id` xuyên suốt client → BFF → provider, log HTTP dạng **JSON**, retention 90 ngày **được enforce**, và có **API đọc metadata** cho eval harness.
  - **Shared (mới)** — `packages/shared/src/pricing.ts`: `PROVIDER_PRICING` (USD / 1M token) · `resolveModelPricing()` · `calculateCostUsd()` (làm tròn 6 chữ số — khớp `numeric(12,6)`) · `packages/shared/src/schemas/logs.ts`: `requestLogSummarySchema` (**metadata only**) · `logsResponseSchema` · `usageResponseSchema` · `logsQuerySchema` · `usageQuerySchema`. `providerStreamRequestSchema` += `requestId?` · `API_ROUTES.logs` / `API_ROUTES.usage`.
  - **Server (mới)** — `middleware/requestId.ts` (đọc `X-Request-Id` · sanitize charset · fallback `randomUUID()` · echo header · `req.sidekickRequestId` qua Express type augmentation) · `services/requestLogService.ts` (`insertRequestLog` · `buildContextSnapshot` · `toRequestLogSummary` · `listRequestLogs` · `aggregateUsage` · `pruneRequestLogs`) · `routes/logs.ts` (`GET /api/logs` · `GET /api/usage`, Zod ở biên, **chỉ metadata**).
  - **Server (sửa)** — `middleware/requestLogger.ts` → **1 dòng JSON** mỗi request `{ ts, level, event: 'http_request', requestId, method, path, status, durationMs }` · `middleware/origin.ts` += `X-Request-Id` · `config/env.ts`: `LOG_REQUESTS` mặc định **`true`** + **mới** `LOG_FULL_CONTENT` (mặc định `false`) + **mới** `LOG_RETENTION_DAYS` (mặc định `90`) · `services/chatService.ts`: nhận `options.requestId` · log **cả nhánh lỗi** · ghi `costUsd` thật + `toolCalls` · SSE `usage` mang cost thật · `keySource` trả về giá trị đã resolve · `providers/{openaiCompatible,gemini}.ts` forward `X-Request-Id` · `index.ts` hẹn prune lúc startup + mỗi 24 h.
  - **Extension (sửa)** — `lib/sseClient.ts` `generateRequestId()` + header `X-Request-Id` (ưu tiên id server echo) · `hooks/useChat.ts` sinh id + lưu vào assistant message khi nhận SSE `meta` · `store/chatStore.ts` `ChatMessage` += `requestId?` · `components/MessageBubble.tsx` hiện **6 ký tự đầu** của id ở dòng meta (design token, không hardcode màu).
  - **Eval (mới)** — `apps/eval/src/logs.ts` (`fetchLogs` · `fetchUsage` · `summarizeLogs`) + subcommand `pnpm eval:run logs`.
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (**1243 unit** = shared 243 · server 377 · extension 623) · build ✅ · db:migrate ✅ (**không** migration mới, **không** dependency mới, **không** permission mới) · **E2E 71/71** ✅ (+2 kịch bản `e2e/requestLog.spec.ts`) · **mutation spot-check 6/6 bị bắt** · kiểm chứng live: `POST /api/chat` với `X-Request-Id: req-live-test-003` → dòng Postgres khớp tuyệt đối (`requestId` · `tokensIn` · `tokensOut` · `ttftMs` · `latencyMs` · `costUsd`).
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1q · `docs/SYSTEM_DESIGN.md` §7.16 · `docs/DESIGN_SYSTEM_BRIEF.md` §3.10 · `docs/EVAL_PLAN.md` §5.3.1.

### Quyết định kỹ thuật mới (T-M1-14)

| Quyết định | Lý do |
|---|---|
| **Không** migration DB | Mọi cột (`cost_usd` · `tool_calls` · `context_hash` · `context_snapshot`) đã có sẵn từ M0 → task này là code + contract |
| `LOG_REQUESTS` mặc định `true` | Log mặc định chỉ chứa **metadata** (không nội dung người dùng) → an toàn; nội dung đầy đủ vẫn **TẮT** qua `LOG_FULL_CONTENT=false` |
| `X-Request-Id` do **client** sinh | NFR-MAINT-04 đòi id xuyên suốt client → BFF → provider → DB → eval. Client sinh uuid → server nhận & sanitize (charset an toàn, ≤ 200 ký tự) → nếu không hợp lệ thì `randomUUID()` (chống log injection) |
| `cost_usd` tính từ **bảng giá snapshot** (`PROVIDER_PRICING`) | Không gọi API giá của provider → chi phí là **ước lượng ổn định** cho eval; **phải** ghi rõ giá đã dùng trong `EVAL_REPORT.md` (xem `EVAL_PLAN.md` §5.3.1) |
| Endpoint log chỉ trả **metadata** | `prompt_text` / `response_text` / `context_snapshot` **không** bao giờ ra khỏi server → an toàn khi chia sẻ log eval |
| Retention 90 ngày thực thi thật (startup + 24 h) | `SYSTEM_DESIGN.md` §5.2 trước đó chỉ là lời hứa, không có code prune |
| `tool_calls` đã wire nhưng M1 **không** phát sinh tool call | Tool/MCP thật ở M2 (T-M2-07..11) → giá trị `null`; vẫn shape-test để sẵn sàng |
| Chip **request-id** trong dòng meta (6 ký tự) | Trust-by-transparency, cùng slot chip provider/model → user báo lỗi thì đối chiếu được với log DB; **không** hiện cost (thuộc T-M2-03 `UsageBadge`) |
| `GET /api/logs` dùng `limit`/`offset` (không keyset) | Dataset eval M2 có thể cần cursor → ghi rõ hạn chế trong `IMPLEMENTATION_PLAN.md` §3.1q |

### Việc đã xong gần đây (T-M1-19 — Error / loading / empty states + retry + connection status)

- **T-M1-19 (FR-CHAT-14 + FR-UX-08 + NFR-REL-02 + NFR-REL-04)** — side panel nay có **4 trạng thái có UI riêng** trong `sidepanel/components/states/`: `LoadingState` (skeleton) · `EmptyState` (wrapper `PromptGallery`) · `ErrorState` (card lỗi inline) · `ConnectionBadge` (chip trạng thái kết nối ở header) + banner offline.
  - **Shared (mới)** — `packages/shared/src/chatErrors.ts`: `ChatErrorKind` (`network` · `rate-limit` · `auth` · `provider` · `server` · `unknown`) · `classifyChatError(code)` · `isRetryableKind` · `shouldAutoRetry` · `defaultRetryAfterSeconds` · `AUTO_RETRY_BACKOFF_MS = 800`. Export từ `index.ts`.
  - **Server (sửa)** — `providers/sse.ts` thêm `parseRetryAfterSeconds()` + `isRetryableStatus()` + `shouldTryFallbackModel()` · `openaiCompatible.ts`/`gemini.ts` đọc header `Retry-After` (429) và set `errorRetryable: false` (401/403) · `chatService.ts` **không** còn hardcode `retryable: true` → `chunk.errorRetryable ?? isRetryableKind(classifyChatError(code))`. SSE `error` event thêm `retryAfterSeconds?`.
  - **Extension (sửa)** — `sseClient.ts` có `ChatRequestError { code, status, retryable }` · `chatStore` lưu `serverId` + `errorCode` + `errorRetryable` + `errorRetryAfterSeconds` · `useChat` retry **tự động 1 lần** backoff 800 ms + expose `retryMessage(messageId)` · `regenerate`/`continueAnswer` dùng **uuid server** (`serverId`) thay vì id local.
  - **Extension (mới)** — `lib/connectionStatus.ts` (`backoffFor()` 5s→15s→30s · `probeConnection()`) · `hooks/useConnectionStatus.ts` (probe `GET /api/health` + `navigator.onLine`) · `components/states/*` (4 component) · `PanelHeader` render `ConnectionBadge` · `ChatWorkspace` render banner offline + `LoadingState` khi `isHydrating`.
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (**1165 unit** = shared 230 · server 319 · extension 616) · build ✅ · db:migrate ✅ (**không** migration mới, **không** dependency mới, **không** permission mới) · **E2E 69/69** ✅ (+4 kịch bản `e2e/states.spec.ts`) · **mutation spot-check 8/8 bị bắt**.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1p · `docs/SYSTEM_DESIGN.md` §7.15 · `docs/DESIGN_SYSTEM_BRIEF.md` §3.9.

### Quyết định kỹ thuật mới (T-M1-19)

| Quyết định | Lý do |
|---|---|
| Taxonomy lỗi đặt ở `packages/shared/src/chatErrors.ts` | Server + extension + eval cùng dùng 1 nguồn sự thật; `classifyChatError` là hàm **thuần** → test được không cần mock mạng |
| Retry tự động **chỉ 1 lần** backoff 800 ms | NFR-REL-02; retry vô hạn sẽ spam provider khi BFF chết. **Không** retry `auth` (key sai → retry vô ích) · **không** retry `rate-limit` (phải chờ hạn) · **không** retry `provider` (model sai thì retry cũng sai) |
| Server **không** hardcode `retryable` | `retryable = chunk.errorRetryable ?? isRetryableKind(classifyChatError(code))` → 401 không còn hiện nút "Thử lại" vô ích |
| Phân biệt `shouldTryFallbackModel` (server) vs `isRetryableStatus` (user) | 429 server **vẫn** nên thử model khác, nhưng user **không** nên retry ngay |
| `serverId` (uuid từ SSE `meta.messageId`) bắt buộc cho `regenerate`/`continue`/`retry` | Client sinh id local `assistant-<timestamp>` nhưng server yêu cầu uuid → trước đây gửi sai → 400 |
| Probe `GET /api/health` thay vì suy đoán từ lỗi chat | Badge phản ánh đúng tình trạng BFF, kể cả khi user chưa chat lần nào |
| Backoff probe 5 s → 15 s → 30 s | Không spam BFF khi nó chết; probe thành công → reset về 5 s |
| Lỗi trong thread dùng **card inline**, không dùng toast `sonner` | Giữ nguyên ngữ cảnh lượt chat (DP-2) — user thấy lỗi của lượt nào, ngay tại lượt đó |
| Không thêm dependency / permission / migration | Task là **UI + plumbing** — không cần chạm schema DB hay manifest |

### Việc đã xong gần đây (T-M1-12 — Settings: theme · cỡ chữ · chiều rộng · quản lý dữ liệu · endpoint BFF)

- **T-M1-12 (FR-SETTINGS-01..07 + FR-UX-06 + NFR-SEC-07)** — side panel nay có **drawer Cài đặt** (Radix Dialog trượt từ **phải**, mở bằng nút gear trong header): theme sáng/tối/theo-OS · cỡ chữ 4 mức · mật độ 3 mức · bề rộng panel 3 mức · telemetry & history (OFF mặc định) · xoá lịch sử chat · xoá dữ liệu cục bộ · import/export settings JSON · đổi endpoint BFF (có validate).
  - **Shared (mới)** — `packages/shared/src/schemas/settings.ts`: `settingsSchema` (Zod) + 5 schema con (`fontScaleSchema` là **enum** 4 mức → chặn giá trị lạ từ storage).
  - **Extension (mới)** — `lib/settings.ts` (`SETTINGS_STORAGE_KEY` = `sidekick.settings` · `readSettings()` fallback **từng field** · `writeSettings()` **merge** + validate · `deleteLocalSidekickData()` xoá prefix `sidekick.` nhưng **giữ** `sidekick.onboarding.completed` + `sidekick.preferredProvider`) · `lib/theme.ts` (`applyTheme` · `applyFontScale` · `applyDensity` · `applyPanelWidth` · `watchSystemTheme`) · `hooks/useSettings.ts` (đọc storage + nghe `chrome.storage.onChanged` → đồng bộ · `update()` optimistic · **effect** áp biến CSS lên `<html>` → áp dụng **ngay, không reload**).
  - **UI (mới)** — `components/settings/`: `SettingsDrawer` · `ThemeSettings` · `AppearanceSettings` · `PrivacySettings` · `DataSettings` · `EndpointSettings` · `LanguageSettings` · `SettingsControls` (`RadioGroup` · `ToggleRow` · `SettingsSection`). Sửa `PanelHeader.tsx` (nút gear) + `ChatWorkspace.tsx` (state `isSettingsOpen`).
  - **Server (mới)** — `deleteAllConversations(db)` + `router.delete('/conversations')` → `200` + `{ deleted }` (**không** migration mới).
  - **Token/CSS** — `design/tokens.css` thêm `--density-scale` (`--space-*` = `calc(<px> * var(--density-scale))`) · `index.css` `#root { max-width: var(--panel-max-width) }` + animation `animate-drawer-in-right`.
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (**1115 unit** = shared 215 · server 314 · extension 586) · build ✅ · db:migrate ✅ (**không** migration mới, **không** dependency mới, **không** permission mới) · **E2E 65/65** ✅ (+4 kịch bản `e2e/settings.spec.ts`) · **mutation spot-check 7/7 bị bắt**.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1o · `docs/SYSTEM_DESIGN.md` §7.14.

### Quyết định kỹ thuật mới (T-M1-12)

| Quyết định | Lý do |
|---|---|
| Settings ở **drawer** (Radix Dialog trượt từ **phải**), không phải màn hình thay thế chat | Giữ nguyên context chat (DP-2: thread ≥ 90%); user chỉnh setting rồi đóng vẫn thấy đúng thread. Pattern đã có sẵn: `ConversationList` trong `Dialog` (T-M1-09) |
| **Không** dùng Zustand store cho settings | Settings đọc/ghi `chrome.storage.local` → cần đồng bộ giữa panel + service worker → hook `useSettings()` + `chrome.storage.onChanged` (pattern `useOnboarding`) → 1 nguồn sự thật, không stale |
| Theme áp bằng class `.dark` + `data-theme` | `design/tokens.css` đã có sẵn block `.dark` → **không** hardcode màu mới, chỉ bật/tắt. `system` → `matchMedia('(prefers-color-scheme: dark)')` + listener `change` |
| Cỡ chữ / mật độ / bề rộng qua **biến CSS** (`--font-scale` · `--density-scale` · `--panel-max-width`) | Token đã có sẵn → **không sửa component nào**, chỉ set biến trên `<html>` → áp dụng tức thì, không reload |
| Bề rộng panel chỉ đặt `max-width` | Chrome side panel do user kéo → extension **không** cưỡng chế được → ghi rõ giới hạn trong UI (không hứa sai) |
| Xoá lịch sử chat bằng **1 endpoint** `DELETE /api/conversations` | Đã có `DELETE /conversations/:id`; loop client sẽ chậm + dễ sót → 1 endpoint server, cascade xoá messages/citations |
| Xoá dữ liệu local theo **prefix** `sidekick.` | 1 lệnh `get(null)` + filter → xoá hết cache context + draft + pending selection + settings. **Giữ** `sidekick.onboarding.*` + `sidekick.preferredProvider` → không bắt user làm lại onboarding |
| Endpoint BFF **validate** qua `GET <url>/api/health` trước khi lưu | AC FR-SETTINGS-05. Validate ở tầng UI, **không** đụng `apiClient` (giữ hành vi hiện tại) |
| Telemetry/history chỉ **lưu cờ** (OFF mặc định) | Hành vi telemetry thật thuộc T-M2-19 → UI ghi rõ "chưa dùng trong phiên bản này" để **không nói dối** user |
| FR-SETTINGS-06 chỉ **lưu lựa chọn** VI/EN | Dịch toàn bộ UI là T-M1-17 → tránh scope creep, không sửa text nào |
| Radio/toggle viết tay bằng `<input type="radio">` native | Không thêm dependency UI mới; a11y tốt, điều hướng bàn phím mặc định đúng |

### Việc đã xong gần đây (T-M1-03 — Service worker: toggle panel · context menu · phím tắt)

- **T-M1-03 (FR-UX-01)** — side panel giờ mở được qua **3 đường**: bấm icon toolbar (**toggle** mở/đóng) · **context menu** (2 mục) · **phím tắt `Ctrl+Shift+K`**.
  - **Background (mới)** — `background/panelController.ts` (`applyOpenOnActionClick()` · `isOpenOnActionClick()` · `read/writePanelOpenState()` · `openSidePanel()` · `closeSidePanel()` · `toggleSidePanel()` → `'opened'|'closed'|'noop'` · **mọi hàm bọc `try/catch`**) · `background/contextMenus.ts` (`registerContextMenus()` · `handleContextMenuClick()`) · `background/commands.ts` (`handleCommand()`).
  - **Service worker** — top-level `void applyOpenOnActionClick()` (native toggle, Chrome 114+) · `action.onClicked` chỉ là **fallback** (guard `isOpenOnActionClick()`) · `commands.onCommand` · `contextMenus.onClicked` · `sidePanel.onOpened`/`onClosed` → ghi `sidekick.panelOpen` vào `chrome.storage.session`.
  - **Manifest** — khối `commands`: `sidekick-toggle-panel` · `Ctrl+Shift+K` (Windows/Linux) · `Command+Shift+K` (macOS). **Không** thêm permission.
  - **Sửa lỗi** — context menu cũ tạo trong `onInstalled` → lỗi "duplicate id" khi update extension; nay `removeAll()` → `create()` × 2 + đăng ký lại ở `onStartup`.
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (**1049 unit** = shared 200 · server 312 · extension 537) · build ✅ · db:migrate ✅ (**không** migration mới, **không** dependency mới, **không** UI mới) · **E2E 61/61** ✅ (+4 kịch bản `e2e/serviceWorker.spec.ts`) · **mutation spot-check 6/6 bị bắt**.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1n · `docs/SYSTEM_DESIGN.md` §7.13.

### Quyết định kỹ thuật mới (T-M1-03)

| Quyết định | Lý do |
|---|---|
| Toolbar toggle dùng **native** `setPanelBehavior({ openPanelOnActionClick: true })` | Chrome tự quản lý mở/đóng → không cần tự track state cho thao tác click icon. API có từ **Chrome 114** (không phải 141) → khớp `minimum_chrome_version` |
| `action.onClicked` giữ làm **fallback** (guard `getPanelBehavior()`) | Chrome cũ / `setPanelBehavior` lỗi → mở panel bằng `open()`. Guard để **không** mở 2 lần (khi behavior đã bật, Chrome **không** dispatch `action.onClicked`) |
| Phím tắt = **custom command** + tự xử lý toggle (không dùng `_execute_action`) | `_execute_action` bị native `openPanelOnActionClick` nuốt → không kiểm soát được hành vi toggle. Tự xử lý → 1 nguồn sự thật, test được |
| Trạng thái panel lưu `chrome.storage.session` + event `onOpened`/`onClosed` | `storage.session` sống suốt phiên browser → **không** mất khi SW bị kill (~30s). `onOpened` (Chrome 141) / `onClosed` (142) → feature detection |
| Đóng panel bằng **feature detection** `typeof chrome.sidePanel.close === 'function'` | Chrome < 141 không đóng được → phím tắt chỉ mở. Rõ ràng hơn là đọc `chrome.runtime.getManifest` |
| Context menu **2 mục** + `removeAll()` trước `create()` | AC ghi "context menu 'Ask Sidekick'". Mục selection tái dùng **đường B** của T-M1-02 (`info.selectionText` → `PendingSelection` → `writePendingSelection()` → panel tự nhận → `tier: 'selection'`). `removeAll()` sửa lỗi duplicate id |
| Tách logic khỏi service worker (3 file riêng) | SW chỉ nên là **wiring**; logic test được trong jsdom với mock `chrome.*` → mutation spot-check hiệu quả |
| **Không** có UI mới trong task này | Đổi phím tắt là T-M1-18 (`settings/ShortcutsSettings.tsx`); T-M1-03 chỉ chốt phím mặc định + contract để T-M1-18 mở rộng |

### Việc đã xong gần đây (T-M1-11 — Prompt gợi ý theo trang + Tóm tắt 1-click)

- **T-M1-11 (FR-UX-03 / FR-UX-04)** — empty state của side panel nay hiện **`PromptGallery`**: **≥ 3 gợi ý đổi theo loại trang** (docs / bài báo / forum / video / PDF / mua sắm), nút **↻ làm mới** xoay vòng bộ gợi ý, và nút **"Tóm tắt trang này"** 1-click.
  - **Contract** — `packages/shared/src/pageProfile.ts` (mới): `PAGE_PROFILES` (7 loại) · `classifyPage(url, title)` (host → path → title, match đầu thắng) · `PromptSuggestion` · `suggestionsForPage(profile, pageTitle)` (**4** gợi ý / profile, điền placeholder `{title}`) · `generalSuggestions()` (4 gợi ý chung — FR-UX-04) · `rotateSuggestions(list, offset)` (xoay vòng deterministic). `constants.ts` +`SUMMARY_PROMPT` (trùng wording dataset eval `summarize`). `index.ts` export `./pageProfile.js`.
  - **Extension** — `lib/activePage.ts` (mới — `readActivePage()`, **không bao giờ throw**) · `hooks/useActivePage.ts` (mới — lắng nghe `chrome.tabs.onActivated` + `onUpdated`) · `chat/PromptGallery.tsx` (mới) · `chat/SummarizeButton.tsx` (mới) · `ChatWorkspace.tsx` (thay empty state tĩnh · `runSuggestion()` = `await attachCurrentTab()` → `await send(prompt)` · `handleSummarize()` = `runSuggestion(SUMMARY_PROMPT)`).
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (**1019 unit** = shared 200 · server 312 · extension 507) · build ✅ · db:migrate ✅ (**không** có migration mới, **không** dependency mới) · **E2E 57/57** ✅ (+5 kịch bản `e2e/promptGallery.spec.ts`) · **mutation spot-check 5/5 bị bắt**.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1m · `docs/SYSTEM_DESIGN.md` §7.12.

### Quyết định kỹ thuật mới (T-M1-11)

| Quyết định | Lý do |
|---|---|
| Bộ luật phân loại trang đặt ở **`packages/shared/src/pageProfile.ts`** | Dùng được cho extension (UI) · server (eval harness) · `apps/eval` → 1 nguồn sự thật, không lệch. `pageKind.ts` phục vụ **routing trích xuất** (`html`/`pdf`/`youtube`) — phân loại **UX** là khái niệm khác → 2 file riêng, không trộn |
| Phân loại theo **host → path → title**, ưu tiên host | Host định nghĩa rõ, ổn định; URL bài viết đổi theo bài. Path/title là fallback cho site không có trong danh sách |
| **Bấm gợi ý = hành động chủ động** → tự `attachCurrentTab()` trước khi gửi | Không có context thì "Tóm tắt trang này" sẽ bịa nội dung → vi phạm FR-CONTEXT-13. Bấm nút = user chủ động yêu cầu dùng context → tương thích mô hình "context chỉ khi user đính kèm" |
| Click gợi ý → **gửi thẳng** (không điền composer trước) | Parity Edge/Gemini (bấm suggestion = chạy luôn); gợi ý viết dạng prompt độc lập, hoàn chỉnh |
| Xoay vòng **deterministic** (offset + 1), không random | Test ổn định, không flaky |
| `SUMMARY_PROMPT` đặt ở **`packages/shared/src/constants.ts`** | Trùng wording dataset eval `summarize` ([`EVAL_PLAN.md`](EVAL_PLAN.md) §3) → đo được, không lệch giữa UI và eval |
| Nút "Tóm tắt trang này" **chỉ hiện** khi trang đọc được (`http`/`https`) | Không có tab đọc được → dùng 4 gợi ý chung (FR-UX-04), không hiện nút tóm tắt (tránh bấm rồi không có context) |
| Dòng minh bạch "Sẽ tự đính kèm trang này khi bạn chọn gợi ý" | DP-3 — user biết chính xác context gì sẽ được gửi |

### Việc đã xong gần đây (T-M1-10 — Regenerate / Edit-resend / Stop / Continue / Draft / Scroll)

- **T-M1-10 (FR-CHAT-05 / FR-CHAT-06 / FR-CHAT-07 / FR-CHAT-12 / FR-CHAT-13 + FR-UX-05)** — chat giờ có đầy đủ nhóm thao tác trên tin nhắn: **"Tạo lại"** tạo *biến thể* (switcher "1/2") · **"Sửa"** trên tin nhắn user → gửi lại tạo **branch** (nhánh cũ giữ trong DB, hiển thị ở mục "Phiên bản cũ") · **"Dừng"** giữ nội dung dở + hiện nút **"Tiếp tục"** (continue ghi đè message cũ) · **Enter** gửi / **Shift+Enter** xuống dòng / **Esc** dừng streaming · **tự lưu draft** · **auto-scroll** chỉ khi đang ở đáy + nút nổi "Cuộn xuống".
  - **Mô hình dữ liệu (lưu phía server, KHÔNG migration mới)** — `messages.meta` jsonb: `turnId` · `variantIndex` · `active` · `parentTurnId` · `aborted`; `conversations.meta.path` jsonb: mảng `turnId` = **đường đi hoạt động**. Turn không nằm trong `path` = nhánh cũ (vẫn giữ trong DB).
  - **Contract** — `schemas/chat.ts` (+`chatOperationSchema` = `send`·`regenerate`·`continue`·`branch` · `operation?` · `assistantMessageId?` · `parentTurnId?`) · `schemas/conversation.ts` (+`turnId`/`variantIndex`/`active`/`parentTurnId`/`aborted` vào message · `conversationTurnSchema` · `conversationVariantSchema` · `activateVariantSchema` · response += `path[]` + `turns[]`) · `events.ts` (+`turnId` vào `chatMetaEventSchema`) · `constants.ts` (+`CONTINUE_INSTRUCTION` · `API_ROUTES.conversationTurnActivate`).
  - **Server** — `services/turnService.ts` (mới): `normalizeMessages()` · `derivePath()` (fallback suy ra từ `createdAt` khi `path` thiếu → tương thích dữ liệu cũ) · `readConversationPath()` · `rewritePath()` · `loadNormalizedMessages()` · `nextVariantIndex()` · `activeVariantIndex()` · `buildTurns()` · `activeVariantMap()` · `patchMessageMeta()` · `updateMessageContent()`. `chatService.ts`: `createChatStream()` xử lý 4 operation (`regenerate` **không** insert user message; `continue` UPDATE message cũ `content = partial + text`; `branch` cắt `path` tại turn cha) · `buildProviderMessages()` hỗ trợ `extraUserInstruction`. `conversationService.ts` trả `path` + `turns` + `activateVariant()`. `routes/conversations.ts` + route `POST /api/conversations/:id/turns/:turnId/activate`.
  - **Extension** — `lib/chatTurns.ts` (mới, thuần) · `lib/storage.ts` (+draft: `sidekick.draft.<scope>` · TTL 30 ngày · `sidekick.activeDraftScope`) · `lib/conversationClient.ts` (+`activateVariant`) · `store/chatStore.ts` (+`turnId`/`variantIndex`/`active`/`parentTurnId`/`aborted` + `path` + `draft` + actions) · `hooks/useChat.ts` (dispatcher `streamTurn()`) · `chat/MessageActions.tsx` (mới) · `chat/MessageEditBox.tsx` (mới) · `chat/ScrollToBottomButton.tsx` (mới) · `MessageBubble.tsx` · `ChatWorkspace.tsx` (render theo active path + "Phiên bản cũ" · auto-scroll ngưỡng 80px · draft debounce 300 ms).
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (**983 unit** = shared 177 · server 312 · extension 494) · build ✅ · db:migrate ✅ (**không** có migration mới — `messages.meta` + `conversations.meta` jsonb đã có sẵn) · **E2E 52/52** ✅ (+5 kịch bản `e2e/chatActions.spec.ts`) · **mutation spot-check 5/5 bị bắt**.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1l · `docs/SYSTEM_DESIGN.md` §7.11.

### Quyết định kỹ thuật mới (T-M1-10)

| Quyết định | Lý do |
|---|---|
| Lưu trạng thái turn/variant/path **phía server** (`messages.meta` + `conversations.meta.path`) | Reload panel → SW bị kill → state client mất; server là nguồn chân lý, đồng thời **không cần migration mới** (jsonb đã có sẵn từ `0000`) |
| `variantIndex` **0-based**, user message = `0`, assistant biến thể đầu = `0` | `nextVariantIndex()` lọc `role !== 'user'` → biến thể assistant đầu tiên là 0, không nhảy số |
| `derivePath()` fallback suy ra từ `createdAt` khi `conversations.meta.path` thiếu | Dữ liệu cũ (trước T-M1-10) không có `path` → vẫn load được lịch sử, không cần backfill |
| `regenerate` **không** insert lại user message | Tránh lặp câu hỏi trong lịch sử — biến thể chỉ thay **phần trả lời** |
| `continue` **UPDATE** message cũ, không tạo message mới | Nội dung dở + phần mới là **một** câu trả lời liên tục; tạo message mới sẽ vỡ thread và mất citation cũ (→ `clearCitations()` khi ghi đè) |
| `CONTINUE_INSTRUCTION` yêu cầu "chỉ viết phần tiếp theo, không lặp lại" | Provider hay lặp lại phần đã có → prompt chặn rõ ràng |
| `branch` cắt `path` tại turn cha, turn cũ chuyển `active=false` nhưng **giữ trong DB** | Không mất lịch sử; hiển thị ở mục "Phiên bản cũ" (collapsible, chỉ đọc) |
| `operation` là `.optional()` trong zod, default `'send'` **ở server** | Payload cũ (không có `operation`) vẫn hợp lệ → không phá client cũ; `.default()` trong schema làm lỗi type khi test payload thiếu field |
| Auto-scroll **chỉ** khi đang ở đáy (ngưỡng 80px) | Không tự cuộn khi user đang đọc giữa thread (FR-UX-05) → nút "Cuộn xuống" là đường thoát |
| Draft lưu theo **scope** (`conversationId` hoặc `new`) + `sidekick.activeDraftScope` | Reload panel làm mất `conversationId` → không có scope lưu thì draft của conversation không khôi phục được |
| Không thêm `@testing-library/user-event` | Dùng `fireEvent` → tránh thêm dependency UI mới chưa được duyệt (rule coding-standards) |

### Việc đã xong gần đây (T-M1-09 — Chat CRUD)

- **T-M1-09 (FR-CHAT-08 / FR-CHAT-09 / FR-CHAT-11)** — side panel nay có **drawer quản lý cuộc trò chuyện**: tạo · đổi tên · xoá (có confirm dialog) · ghim · lưu trữ · search theo tên. Chọn 1 conversation → tải lại lịch sử hội thoại **kèm citations đã lưu**.
  - **Contract** — `packages/shared/src/schemas/conversation.ts` (mới): `conversationSummarySchema` · `conversationListResponseSchema` · `updateConversationSchema` · `conversationCitationSchema` · `conversationMessageSchema` · `conversationMessagesResponseSchema`. `schemas/chat.ts` +`archived` trong query. `types/entities.ts` +`citations`/`provider`/`model`/`tokensIn`/`tokensOut` cho `messageSchema`. `constants.ts` +`API_ROUTES.conversationMessages`.
  - **Server** — `apps/server/src/services/conversationService.ts` (mới): `listConversations()` (lọc `archived` + `q` trong SQL · `ILIKE` escape wildcard · sort `pinned desc, updated_at desc, id desc` · **phân trang keyset** bằng cursor base64url) · `createConversation()` · `updateConversation()` (bump `updated_at`) · `deleteConversation()` (cascade) · `getConversationMessages()` · `countMessagesByConversation()` · `buildAutoTitle()` · `escapeLikePattern()` · `encodeCursor()`/`decodeCursor()`. `routes/conversations.ts` (mới): `GET`/`POST` `/conversations` · `GET /:id/messages` · `PATCH /:id` · `DELETE /:id` (204) · id phải là UUID → `VALIDATION_ERROR`. `chatService.ts`: tiêu đề tự động từ câu hỏi đầu tiên · lưu `meta` provider/model/token · bump `updated_at` mỗi lượt chat.
  - **Extension** — `components/ui/dialog.tsx` (mới, shadcn trên `@radix-ui/react-dialog` — **1 dependency mới**) · `lib/conversationClient.ts` (mới) · `store/conversationStore.ts` (mới, Zustand, optimistic + rollback) · `chat/ConversationList.tsx` (mới — drawer: search debounce 250 ms · tab "Đang dùng"/"Đã lưu trữ" · nhóm "Đã ghim"/"Gần đây") · `chat/ConfirmDialog.tsx` (mới) · `components/PanelHeader.tsx` (+nút History + tiêu đề conversation) · `ChatWorkspace.tsx` (mount drawer + `handleSelectConversation` + `handleCreateConversation`) · `store/chatStore.ts` (+`hydrateConversation`) · `index.css` (+animation drawer, tôn trọng `prefers-reduced-motion`).
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (**904 unit** = shared 165 · server 291 · extension 448) · build ✅ (`dist/content.js` vẫn IIFE 1 file) · db:migrate ✅ (**không** có migration mới — cột `pinned`/`archived`/`title`/`updated_at` đã có sẵn từ `0000`) · **E2E 47/47** ✅ (+7 kịch bản `e2e/conversation.spec.ts`) · **mutation spot-check 5/5 bị bắt**.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1k · `docs/SYSTEM_DESIGN.md` §7.10.

### Quyết định kỹ thuật mới (T-M1-09)

| Quyết định | Lý do |
|---|---|
| **Ghim ở cấp conversation** (`conversations.pinned`), không ghim tin nhắn | Cột `pinned` **đã có sẵn** từ migration `0000` → **không cần migration mới**. FR-CHAT-11 hiểu là "ghim cuộc trò chuyện lên đầu danh sách"; ghim tin nhắn để task sau |
| **Drawer = Radix Dialog trượt từ trái**, không sidebar thu hẹp | DP-2 "chat-centric" (thread ≥ 90% không gian) + DP-1 (panel 320–640 px) — thu hẹp panel sẽ phá layout. Radix qua Portal → không bị `overflow` của thread cắt |
| **Phân trang keyset** (cursor base64url), không OFFSET | Danh sách đổi liên tục (mỗi lượt chat bump `updated_at`) → OFFSET dễ lặp/sót dòng |
| **Tiêu đề tự động** chỉ set khi *tạo mới* (`ON CONFLICT DO NOTHING`) | Tên user đặt tay không bị ghi đè bằng câu hỏi đầu tiên |
| **`GET /:id/messages`** thay cho `GET /:id` | Hydrate thread chỉ cần **1 request** (conversation + messages + citations) |
| **Escape wildcard** trong `ILIKE` (`%` `_` `\`) | User gõ `%` không nên tìm ra **tất cả** conversation |
| **Optimistic update + rollback** trong store | CRUD phản ánh trong UI **ngay** (AC) nhưng không giữ trạng thái sai khi API lỗi |
| **Fake Drizzle DB** trong test (`tests/helpers/fakeConversationDb.ts`) | Unit test server **không cần Docker** — phân tích SQL chunk thay vì hardcode chuỗi SQL |

### Việc đã xong gần đây (T-M1-08 — Citation chip + popover)

- **T-M1-08 (FR-CONTEXT-10)** — câu trả lời có context nay hiện **chip `[N]`** inline → bấm vào mở **popover đoạn nguồn** (tiêu đề · domain · đoạn trích) + nút "Mở trang gốc"; dưới bubble assistant có **dòng tóm tắt nguồn** (`CitationList`).
  - **Contract** — `packages/shared/src/citation.ts` (mới): `CITATION_MARKER_PATTERN` (`/\[(\d{1,2})\]/g`) · `CITATION_INSTRUCTION` (chỉ chèn vào system prompt **khi có context**) · `parseCitationMarkers()` (số phân biệt · sort tăng dần · **không** mutate `lastIndex` của regex global).
  - **Server** — `apps/server/src/services/citationService.ts` (mới): `extractCitations()` (parse marker `[N]` → **loại số vượt phạm vi**) · `buildSnippet()` (`excerpt ?? text.slice(0, 320)`) · `persistCitations()` (bảng `citations`: `messageId`, `idx`, `url`, `title`, `snippet`, `tabId`) · `chatService.ts`: `numberedContextItems()` (đánh số **1-based** theo tier `selection` > `attachment` > `currentTab`) · `buildContextPrompt()` render `--- Nguồn [1] ([Đã bôi đen]) ---` · `buildProviderMessages()` chèn `CITATION_INSTRUCTION` · `createChatStream()` **emit SSE `citation` trước `done`**.
  - **Extension** — `components/ui/popover.tsx` (mới, shadcn trên `@radix-ui/react-popover`) · `chat/citationPlugin.ts` (mới, remark plugin thuần mdast: tách text node chứa `[N]` → `<span dataCitationIndex={N}>`, **không** đụng code block / inline code) · `chat/markdownSchema.ts` (+`dataCitationIndex` vào allowlist `span`, **không** dùng wildcard `data*`) · `chat/MessageContent.tsx` (+plugin + `CitationContext` + override `span`: có `dataCitationIndex` → `CitationChip`, còn lại → pass-through token `.hljs-*`) · `chat/CitationChip.tsx` · `chat/CitationPopover.tsx` · `chat/CitationList.tsx` · `store/chatStore.ts` (+`ChatCitation` · `addCitation`) · `hooks/useChat.ts` (SSE `case 'citation'`) · `MessageBubble.tsx` · `index.css` (+`.citation-chip` dùng token `--citation-*`).
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (**813 unit** = shared 152 · server 250 · extension 411) · build ✅ (`dist/content.js` vẫn IIFE 1 file) · db:migrate ✅ (**không** có migration mới — bảng `citations` đã có sẵn trong `0000`) · **E2E 40/40** ✅ (+4 kịch bản `e2e/citation.spec.ts`) · **mutation spot-check 6/6 bị bắt**.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1j · `docs/SYSTEM_DESIGN.md` §7.9.

### Quyết định kỹ thuật mới (T-M1-08)

| Quyết định | Lý do |
|---|---|
| **Marker `[N]` do LLM sinh**, không suy đoán vị trí câu | Heuristic "câu nào dựa trên nguồn nào" không chính xác; marker rõ ràng + server **loại số vượt phạm vi** (LLM bịa `[9]` khi chỉ có 3 nguồn) → chính xác hơn |
| `CITATION_INSTRUCTION` chỉ chèn **khi có context** | Chat thuần LLM (FR-CONTEXT-13) không bị ảnh hưởng; không tốn token thừa |
| Đánh số nguồn ở **server** (`numberedContextItems`) theo tier | Client không được tự quyết định số → server là nguồn chân lý (giống `applyContextBudget`); extension chỉ render |
| Marker parse ở `packages/shared` | Cả server (parse output) và extension (render) cùng hiểu 1 định dạng → 1 nguồn sự thật |
| Persist `snippet` vào bảng `citations` | Cho phép **verify trích dẫn bằng máy** → metric `citation_precision` (đo được "đúng **đoạn**", không chỉ "có trích dẫn") — xem `EVAL_PLAN.md` §5.1.1 |
| Remark plugin thay vì regex trên chuỗi HTML | Regex sau render → dễ vỡ với HTML escape; AST cho chính xác + **không** đụng code block / inline code |
| `dataCitationIndex` được allowlist **tường minh**, không dùng wildcard `data*` | `rehype-sanitize` — wildcard sẽ mở cửa cho mọi attribute `data-*` → tăng bề mặt XSS |
| Chip **chưa** có metadata → render `<span>`, không phải button | Đang stream thì chưa có event `citation` → không tạo "chip chết" không bấm được |
| Popover dùng Radix qua **Portal** | Thread chat có `overflow` → popover bị cắt nếu render inline |
| Không dùng wildcard `data*` trong sanitize | Giữ allowlist thẩm (NFR-SEC-04) |

### Việc đã xong gần đây (T-M1-07 — Markdown render + code block + copy + syntax highlight)

- **T-M1-07 (FR-CHAT-02 / FR-CHAT-03 / FR-CHAT-04, NFR-SEC-04, NFR-PERF-02)** — nội dung assistant nay render Markdown đầy đủ trong side panel: GFM (heading · list · bảng · strikethrough · task list), code block có **nhãn ngôn ngữ + syntax highlight + copy 1-click**, bảng rộng scroll ngang.
  - **Deps** — `react-markdown@^10.1.0` · `remark-gfm@^4.0.1` · `rehype-sanitize@^6.0.0` · `rehype-highlight@^7.0.2` (`sonner` đã có sẵn từ trước).
  - **Schema** — `sidepanel/components/chat/markdownSchema.ts` (mới): `markdownSchema` (clone `defaultSchema` + `span: [['className', /^hljs-/]]` + `code: [['className', /^language-./, 'hljs']]` + `protocols.href: ['http','https','mailto']`) · `LANGUAGE_ALIASES` · `SUPPORTED_LANGUAGES` · `toMarkdownNode()` / `languageFromNode()` / `extractCodeText()`.
  - **Component** — `chat/CodeBlock.tsx` (mới: header nhãn ngôn ngữ + nút copy, copy **source thô**, icon `Copy`→`Check` 1500 ms, `toast.success('Đã sao chép')`, `CodeBlockContext` phân biệt code block vs inline code) · `chat/MarkdownTable.tsx` (mới: `div.overflow-x-auto` bọc bảng) · `chat/MessageContent.tsx` (mới: orchestrator pipeline + `useDeferredValue` + mảng plugin hằng module-level).
  - **Tích hợp** — `MessageBubble.tsx` (assistant → `MessageContent`, user giữ text thuần) · `App.tsx` (mount `<Toaster>`) · `manifest.json` (+`clipboardWrite`) · `index.css` (+`.markdown-body` + mapping `.hljs-*` → `--code-token-*`).
  - **Verify** — typecheck ✅ · lint ✅ · test ✅ (**740 unit** = shared 140 · server 224 · extension 376) · build ✅ (`dist/content.js` vẫn IIFE 1 file) · db:migrate ✅ (không có migration mới) · **E2E 36/36** ✅ (+4 kịch bản `e2e/markdown.spec.ts`) · **mutation spot-check 6/6 bị bắt**.
- Bằng chứng đầy đủ: `docs/IMPLEMENTATION_PLAN.md` §3.1i-bis · `docs/SYSTEM_DESIGN.md` §7.8.

### Quyết định kỹ thuật mới (T-M1-07)

| Quyết định | Lý do |
|---|---|
| `rehype-highlight` (highlight.js đồng bộ) thay `shiki` | Shiki cần wasm → cần `'wasm-unsafe-eval'` trong CSP, MV3 `script-src 'self'` không cho; highlight.js `common` = 37 ngôn ngữ ≥ 15 yêu cầu của FR-CHAT-03 |
| Highlight **defer khi streaming** (`isStreaming` → chỉ `[rehypeSanitize]`) | `rehype-highlight` chạy lại toàn bộ cây mỗi token → O(n²); highlight 1 lần khi stream xong → không nhấp nháy unhighlighted, không jank |
| `useDeferredValue(content)` | React 18 ưu tiên render markdown (parse chậm) sau frame hiện tại → giữ fps khi streaming (NFR-PERF-02) |
| Mảng plugin **hằng module-level** (`REHYPE_PLUGINS_STREAMING` / `REHYPE_PLUGINS_DONE`) | Tạo inline mỗi render → `react-markdown` re-parse oan |
| `rehype-sanitize` truyền schema dạng **tuple** `[rehypeSanitize, markdownSchema]` | `rehype-sanitize` trong unified nhận schema là tham số thứ 2 của tuple; truyền `{ schema }` → rơi về `defaultSchema` → mất hết class `hljs-*` |
| `protocols.href` giới hạn `['http','https','mailto']` (bỏ `irc`/`xmpp` mặc định) | Chặn `javascript:` + giảm bề mặt tấn công (NFR-SEC-04) |
| `skipHtml` trên `ReactMarkdown` | Bỏ raw HTML node → chặn XSS + chặn attribute injection |
| Chỉ **assistant** render Markdown; user giữ text thuần | User nhập text thô → không cần parse; giảm bề mặt XSS từ nội dung người dùng |
| Copy **source thô** (trích từ AST) chứ không copy HTML | Copy HTML → paste vào editor ra markup; `extractCodeText()` gom text node đệ quy nên vẫn đúng sau khi `rehype-highlight` chèn span |
| `CodeBlockContext` thay vì dò DOM / parent traversal | Phân biệt code block vs inline code ổn định, không phụ thuộc cấu trúc DOM |
| Toast `sonner` + icon inline đổi `Copy`→`Check` | Toast khớp AC "Đã sao chép"; icon cho phản hồi **tại đúng block** (parity Edge Copilot) |
| `rehype-highlight` **không** vào content script | Content script build riêng (IIFE) → `dist/content.js` giữ nguyên ~13.9 kB |

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
- ~~**T-M1-13 (export) đã defer**~~ — **đã xong 2026-11-09** (menu export .md/.json + copy Markdown).

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
