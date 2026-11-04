# Documentation Index — Sidekick AI (Chrome Extension Chat Sidebar)

**Dự án:** Extension chat-bot sidebar cho trình duyệt, cạnh tranh với Edge Copilot Sidebar và Chrome Gemini Sidebar.
**Giai đoạn hiện tại:** **M0 (Foundation) đã implement xong** (tag `v0.1`) · đang làm **M1 (Parity)** — 5/25 task (T-M1-01, T-M1-04 ✅ hấp thụ, T-M1-21, T-M1-22, T-M1-23 ✅).
**Entry point cho agent:** [`../AGENTS.md`](../AGENTS.md) · [`HANDOFF.md`](HANDOFF.md)

---

## Cấu trúc tài liệu

| Tài liệu | Vai trò | Nội dung | Đọc khi nào |
|---|---|---|---|
| [`REQUIREMENTS.md`](REQUIREMENTS.md) | **Nguồn sự thật cho sản phẩm** | Mục tiêu, parity summary, 14 user stories, 83 FR, 29 NFR, kiến trúc, data model, rủi ro, roadmap M0–M4, **bảng FR ↔ Task (§11.1)** | Khi cần biết "cần làm gì" và "vì sao" |
| [`COMPARISON_MATRIX.md`](COMPARISON_MATRIX.md) | **Đối chiếu & gap** | 28 tính năng Edge (A1–A28), 28 tính năng Chrome Gemini (B1–B28), 15 tính năng độc quyền (C1–C15), nguồn trích dẫn, checklist parity M1 & M4 | Nghiên cứu thêm feature, hoặc nghiên cứu thêm feature để bổ sung |
| [`EVAL_PLAN.md`](EVAL_PLAN.md) | **Chứng minh chất lượng** | Dataset 48 task (5+1 nhóm), rubric 8 tiêu chí, judge prompt, metrics, quy trình thu thập transcript Edge/Gemini, 11 fairness controls, timeline | **Yêu cầu bắt buộc của giảng viên** — đọc kỹ |
| [`DESIGN_SYSTEM_BRIEF.md`](DESIGN_SYSTEM_BRIEF.md) | **Ràng buộc UI** | 7 design principles, design tokens, component inventory, state chuẩn hoá, checklist WCAG 2.2 AA, traceability ↔ FR | Khi làm UI hoặc thêm component mới |
| [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) | **Cách code** | Kiến trúc tổng thể, 12 ADR, cấu trúc thư mục, hợp đồng API (30 endpoint), giao thức SSE (8 event), data model Drizzle, bảo mật, chiến lược test, rủi ro kỹ thuật | Khi viết API, schema, hoặc backend |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | **Kế hoạch thực thi** | 82 task có mã `T-Mx-xx` theo M0–M4, DoD, timeline 13 tuần, phân công 3 thành viên, kịch bản thiếu thời gian, **bảng FR → Task rút gọn (§3.2)** | Khi bắt đầu task, cập nhật trạng thái task |
| [`HANDOFF.md`](HANDOFF.md) | **Chuyển phiên chat** | Checklist bắt đầu chat mới (≤ 5 phút), trạng thái hiện tại, quyết định đã chốt, mẹo tiết kiệm token | **Đọc đầu tiên khi mở chat mới** |
| [`CHANGELOG.md`](CHANGELOG.md) | **Lịch sử thay đổi** | Mọi thay đổi docs + code, mới → cũ | Xem gần đây đã làm gì |

---

## Thứ tự đọc đề xuất

```mermaid
flowchart LR
    H["HANDOFF.md<br/>Bắt đầu chat mới"] --> A["REQUIREMENTS.md<br/>Mục tiêu & yêu cầu"]
    A --> B["COMPARISON_MATRIX.md<br/>Đối chiếu & gap"]
    A --> S["SYSTEM_DESIGN.md<br/>Cách code"]
    A --> D["DESIGN_SYSTEM_BRIEF.md<br/>Chuẩn bị UI"]
    A --> P["IMPLEMENTATION_PLAN.md<br/>Task M0 → M4"]
    A --> C["EVAL_PLAN.md<br/>Cách chứng minh"]
    B --> P
    S --> P
    D --> P
    C --> P
    P --> I["Implementation<br/>(M0 → M1 → M2 → M3 → M4?)"]
```

**Cách nhanh nhất (khi bắt đầu chat mới):**
`HANDOFF.md` → `AGENTS.md` → task trong `IMPLEMENTATION_PLAN.md` → mở `SYSTEM_DESIGN.md` § liên quan.

---

## Quyết định kiến trúc đã chốt

| Hạng mục | Quyết định |
|---|---|
| Nền tảng | Chrome Extension Manifest V3 (Side Panel API, Chrome ≥ 114) |
| Frontend | React 18 + TypeScript + Vite + **Tailwind CSS + shadcn/ui** (Radix, copy code vào repo) |
| Client state | Zustand |
| Backend | BFF proxy chạy local qua **Docker Compose** (Node 20 + Express + TS) |
| Database | **PostgreSQL 16 + Drizzle ORM + pgvector** |
| Repo | **Monorepo pnpm workspace**: `apps/extension` · `apps/server` · `apps/eval` · `packages/shared` |
| LLM | Multi-provider adapter (Gemini, OpenAI, Anthropic, OpenRouter, Groq, Ollama); free tier trước |
| Chế độ dự phòng | 3 nguồn key: **K1** team key (`.env`) · **K2** BYOK qua BFF (mã hoá trong Postgres) · **K3** BYOK direct (`chrome.storage.local`, khi BFF tắt) — xem `REQUIREMENTS.md` §4.6.1 |
| Phạm vi | Full parity 2 hệ thống + tính năng nâng cao (MCP, RAG, Skills, multi-provider, log). **Workflow automation = M4, implement cuối cùng** |
| Đánh giá | Offline benchmark (LLM-as-judge) **+** live manual test (rubric con người) |
| Streaming | Trực tiếp Side Panel → BFF (không qua service worker — MV3 SW bị kill ~30s) |

Chi tiết lý do & hệ quả: [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §2 (12 ADR).

---

## Tóm tắt các điểm khác biệt so với 2 hệ thống có sẵn

1. **Multi-provider + BYOK** — không phụ thuộc model của hãng.
2. **Self-hostable** — toàn bộ server chạy local, dữ liệu không rời máy.
3. **MCP-native** — mở rộng tool bất kỳ qua Model Context Protocol.
4. **Traceable** — log request đầy đủ, phục vụ audit và eval.
5. **Cost visibility** — token & chi phí theo từng lượt.
6. **Privacy theo domain** — không chỉ bật/tắt toàn cục.
7. **Công cụ eval tích hợp** — đo được, so sánh được, tái lập được.
8. **Workflow automation** — scheduler chạy nền trong sidebar, self-hosted, không cần license (M4, ngoài đường găng). Ở Edge/Gemini, tính năng này bị đẩy ra khỏi sidebar sang M365 Copilot Tasks / Gemini Apps.

---

## Ưu tiên triển khai

> **Workflow (M4) là tính năng implement cuối cùng**, chỉ bắt đầu khi M0–M3 đã ổn định và đã có báo cáo eval. Nếu thiếu thời gian, bỏ hẳn M4 mà **không** mất điểm ở các tiêu chí đã đạt. Chi tiết: [`REQUIREMENTS.md`](REQUIREMENTS.md) §9.3 (thứ tự cắt) và §9.4 (điều kiện bắt đầu).

---

## Quy trình bắt buộc: cập nhật docs sau mỗi thay đổi

> Nguồn chính: [`../AGENTS.md`](../AGENTS.md) §5 và `.cursor/rules/docs-sync.mdc`.

1. Code xong → cập nhật `docs/` tương ứng (bảng ánh xạ trong `docs-sync.mdc` §1).
2. Thêm 1 entry vào [`CHANGELOG.md`](CHANGELOG.md).
3. Task dang dở → cập nhật [`HANDOFF.md`](HANDOFF.md) §2.
4. Commit.

**Task chưa cập nhật docs = chưa Done.**

---

## Trạng thái tài liệu

| Tài liệu | Phiên bản | Ngày | Trạng thái |
|---|---|---|---|
| REQUIREMENTS.md | v1.2 | 2026-11-04 | ✅ Đã cập nhật — FR-CONTEXT-05/06 đã implement (T-M1-21/22) |
| COMPARISON_MATRIX.md | v1.2 | 2026-11-04 | ✅ Đã cập nhật — PDF/YouTube đạt parity (§D, §E tick ✅) |
| EVAL_PLAN.md | v1.1 | 2026-11-04 | ✅ Đã cập nhật — thêm nhóm `doc_extract` + `video_transcript` (dataset 48 task) |
| DESIGN_SYSTEM_BRIEF.md | v1.1 | 2026-11-04 | ✅ Đã cập nhật — component `ContextNotice` (§3.4) |
| SYSTEM_DESIGN.md | v1.2 | 2026-11-04 | ✅ Đã cập nhật — §7.3.1 nhánh PDF/YouTube đã implement + 2 endpoint |
| IMPLEMENTATION_PLAN.md | v1.2 | 2026-11-04 | ✅ Đã cập nhật — T-M1-21/22 ✅ + §3.1b bảng verify |
| HANDOFF.md | v1.2 | 2026-11-04 | ✅ Đã cập nhật — kết quả T-M1-21/22 + quyết định kỹ thuật |
| CHANGELOG.md | v1.2 | 2026-11-04 | ✅ Đang theo dõi |

## Trạng thái milestone

| Milestone | Nội dung | Trạng thái |
|---|---|---|
| **M0 — Foundation** (2 tuần) | Monorepo, shared types, Docker/Postgres, Drizzle, BFF skeleton, provider Gemini, SSE, side panel shell | ✅ Xong (tag `v0.1`) |
| **M1 — Parity** (3 tuần) | Content extraction (HTML + PDF + YouTube transcript), context đính kèm chủ động + ngân sách token, `@` multi-tab, selection, citations, markdown/code, conversation CRUD, settings, upload ảnh, onboarding, logging, K2/K3 | 🚧 Đang làm — 5/25 task (T-M1-01, T-M1-04 ✅ hấp thụ, T-M1-21, T-M1-22, T-M1-23 ✅) |
| **M2 — Advanced & Eval** (3 tuần) | Multi-provider, skills, tool registry + MCP, RAG, token/cost UI, **EVAL_REPORT** | ⬜ Chưa bắt đầu |
| **M3 — Polish & Deliverable** (1 tuần) | Design system, states, a11y audit, i18n, demo video, slide, README, backup DB, ADR | ⬜ Chưa bắt đầu |
| **M4 — Workflow** (tuỳ chọn, 2 tuần) | Scheduler, workflow CRUD, run log, import/export, notification | ⬜ Ngoài đường găng |

Chi tiết task: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).

---

## Điều kiện cần để bắt đầu implement M1

- [x] Giảng viên duyệt hướng tiếp cận (requirements + eval plan)
- [x] Chốt stack UI (Tailwind + shadcn/ui) và data layer (Drizzle + Postgres)
- [x] Chốt cấu trúc repo (monorepo pnpm) và versioning (git local)
- [ ] Chốt provider dùng để đối chiếu công bằng với Chrome Gemini (`REQUIREMENTS.md` §10, Q1)
- [ ] Chốt ngân sách API key cho eval (§10, Q3)
- [ ] Xác nhận có/không làm user study (§10, Q4)
