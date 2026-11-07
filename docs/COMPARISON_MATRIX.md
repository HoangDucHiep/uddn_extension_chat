# Feature Comparison Matrix — Edge Copilot vs Chrome Gemini vs Sidekick AI

**Version:** v1.0 · **Ngày:** 2026-11-03 · **Nguồn:** tài liệu chính thức Microsoft Support, Google Chrome Help, Chrome DevDocs (đã tổng hợp ở §0)

Ký hiệu: ✅ Có đầy đủ · ⚠️ Có nhưng có hạn chế / khác biệt · ➖ Không có · 🟢 Điểm mạnh độc quyền của Sidekick AI

Cột ưu tiên: **M** = Must (M1) · **S** = Should (M2) · **C** = Could (M2/M3) · **—** = Không triển khai

---

## 0. Ghi chú nguồn

| Hệ thống | Nguồn chính |
|---|---|
| Microsoft Copilot in Edge | [Getting started with Copilot in Microsoft Edge](https://support.microsoft.com/en-US/microsoft-copilot/getting-started-with-copilot-in-microsoft-edge) · [How context clues work](https://support.microsoft.com/en-US/microsoft-copilot/how-context-clues-work-copilot-edge) · [Your AI browser](https://www.microsoft.com/en-us/edge/copilot/ai-powered) · [Meet Copilot Mode in Edge](https://blogs.windows.com/msedgedev/2025/10/23/meet-copilot-mode-in-edge-your-ai-browser/) |
| Gemini in Chrome | [Use Gemini in Chrome](https://support.google.com/chrome/answer/16283624) · [Customize your Gemini in Chrome](https://support.google.com/chrome/answer/16988996) · [Skills in Chrome](https://blog.google/products-and-platforms/products/chrome/skills-in-chrome/) · [Gemini 3 & Auto Browse](https://blog.google/products-and-platforms/products/chrome/gemini-3-auto-browse/) · [AI in Chrome](https://www.google.com/chrome/ai-innovations/) |
| Copilot Actions (Edge) | [Copilot Actions in Edge](https://support.microsoft.com/en-gb/topic/copilot-actions-in-edge-5ed5e17e-42df-40a3-984a-20420eba86e2) — nguồn cho **A27** |
| Gemini Tasks & Schedules | [Tasks in Gemini Apps](https://support.google.com/gemini/answer/17094507) · [Schedule recurring prompts](https://support.google.com/gemini/answer/17094710) — nguồn cho **B28** |
| Side Panel API | [chrome.sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) · [Modern Web Guidance — side panel](https://github.com/googlechrome/modern-web-guidance/blob/main/skills/chrome-extensions/references/extensions/side-panel.md) |

**Lưu ý về tính công bằng:** Cả Edge Copilot và Chrome Gemini đều là tính năng **built-in**, không phải extension. Chúng không có API công khai, không cho xuất transcript, và phụ thuộc tài khoản Microsoft 365 / Google (một số tính năng bị gate theo gói thuê bao). Bảng này ghi nhận **tính năng có sẵn ở điều kiện consumer thông thường**; các tính năng gate theo gói cao cấp được đánh dấu.

---

## A. Microsoft Copilot Sidebar (Edge)

| # | Tính năng | Chi tiết / hạn chế | Ưu tiên ta |
|---|---|---|---|
| A1 | Side panel cố định cạnh tab | Mở bằng toolbar button, giữ nguyên khi đổi tab | M |
| A2 | Context Clues | Dùng URL, page title, page content/screenshots, browsing history. **Bật/tắt toàn cục** ở Settings › Copilot and AI | M |
| A3 | Chia sẻ dữ liệu duyệt web | **Không** lưu vào lịch sử chat — chỉ prompt + response được lưu | M (chọn lọc hơn) |
| A4 | Prompt gợi ý theo trang | Dựa trên title + URL của trang hiện tại | M |
| A5 | Page Summary 1-click | Nút "Create a Summary" | M |
| A6 | "Expand on this topic" | Mở rộng câu trả lời hiện tại | S |
| A7 | Multi-tab reasoning | So sánh recipe giữa nhiều tab, lên lịch bếp tối ưu | S |
| A8 | Hỏi theo vùng được bôi đen | Bấm icon Copilot trên content → chat mở với ngữ cảnh vùng chọn | M |
| A9 | Copilot Vision (screen share) | Cho Copilot xem màn hình. **Chỉ M365 subscriber** | C |
| A10 | Voice dictation | Microphone → speech-to-text. **Chỉ M365 subscriber** | C |
| A11 | Copilot Voice (voice chat) | Hội thoại nói. **Chỉ M365 subscriber** | C |
| A12 | Vision (phân tích ảnh) | Phân tích nội dung ảnh | S |
| A13 | Image Creator | Tạo ảnh | C |
| A14 | Copilot Actions | Thực hiện hành động thay bạn | C |
| A15 | @Copilot | Gắn @ vào ngữ cảnh | M |
| A16 | Copilot Mode | Reasoning xuyên nhiều tab, dynamic pane | C |
| A17 | Trợ lý "so sánh nhiều tab" | So sánh sản phẩm/recipe từ nhiều tab | S |
| A18 | Browsing history opt-in | Dùng lịch sử duyệt để trả lời ("chiếc hoodie xanh tuần trước") | S |
| A19 | Tạo podcast / study guide / quiz từ trang | Sinh nội dung học tập | C |
| A20 | Tóm tắt video / PDF | Tóm tắt nội dung video và PDF | M |
| A21 | Copilot Daily | Nội dung/digest hằng ngày | C |
| A22 | Chọn model | Không cho chọn model (chỉ model của Copilot) | 🟢 FR-PROVIDER-03 |
| A23 | API / BYOK | Không có | 🟢 FR-PROVIDER-02 |
| A24 | Chọn vị trí panel (trái/phải) | Do người dùng đặt trong Chrome settings (dùng chung `getLayout()`) | M (tự cấu hình) |
| A25 | Keyboard shortcut mở Copilot | Không có shortcut mặc định (chỉ qua menu) | 🟢 FR-UX-01 — ✅ T-M1-03 (`Ctrl+Shift+K` toggle panel; đổi được → T-M1-18) |
| A26 | Yêu cầu đăng nhập | Bắt buộc đăng nhập tài khoản Microsoft; một số tính năng cần **M365 subscription** | 🟢 FR-PROVIDER-02 (không cần tài khoản hãng) |
| A27 | Copilot Actions (Edge) | Tác vụ web **một lần** có giám sát (đặt nhà hàng, sửa trang, huỷ newsletter). Có bước xác nhận cho hành động rủi ro (mua hàng, gửi email). **Preview, trong Copilot Mode** | C |
| A28 | Lịch chạy tự động | **Không có trong Edge.** Chỉ ở **M365 Copilot Tasks** (chạy ngay hoặc theo lịch, giới hạn 10 scheduled prompts) — cần **Copilot license**, sản phẩm khác, không nằm trong sidebar | 🟢 FR-WORKFLOW-03 (M4) |
| A29 | Trích dẫn nguồn (citations) | Câu trả lời dựa trên nội dung trang hiện tại hiện **số nguồn** kèm trích dẫn → bấm vào xem đoạn nguồn | M (chi tiết hơn: chip + popover đoạn nguồn) |
| A30 | Quản lý nhiều cuộc trò chuyện | Lịch sử chat trong Copilot sidebar: mở lại chat cũ, đổi tên, xoá | 🟢 FR-CHAT-08/09/11 (T-M1-09 — drawer quản lý chat + search + ghim + lưu trữ) |

---

## B. Gemini in Chrome (Sidebar)

| # | Tính năng | Chi tiết / hạn chế | Ưu tiên ta |
|---|---|---|---|
| B1 | Side panel cố định cạnh tab | Mở bằng nút "Ask Gemini" hoặc shortcut | M |
| B2 | Share tab hiện tại | **Mặc định share** nội dung tab hiện tại khi bắt đầu chat mới | M |
| B3 | Tắt share tab hiện tại | Người dùng chủ động tắt được | M |
| B4 | Multi-tab share | Tối đa **10 tab** gần đây qua `@` hoặc nút "Add tabs"; tab đã share có dấu check, tab đang dùng có gạch chân phát sáng | M (không giới hạn) |
| B5 | Select content để hỏi | Bôi đen text / chọn ảnh / chọn sản phẩm → hỏi về đúng nội dung đó | M |
| B6 | Skills (`/`) | Lưu prompt tái sử dụng, gọi bằng `/`; có thể remix từ library có sẵn; chạy trên tab hiện tại + tab được chọn | M |
| B7 | Tạo Skill mới | Từ 1 prompt trong chat history | M |
| B8 | Library Skill có sẵn | Sẵn nhiều skill mẫu (protein max, check job fit, explain simply…) | S |
| B9 | Summarize | Tóm tắt trang, bài viết, thread | M |
| B10 | Tóm tắt video YouTube | Dùng transcript video | M |
| B11 | Nano Banana | Tạo/sửa ảnh ngay trong tab | C |
| B12 | Auto Browse | Agentic: tự duyệt web, làm việc hộ. **Preview, chỉ AI Pro/Ultra** | C |
| B13 | Connected apps | Tích hợp Gmail, YouTube, Flights, Google apps | C (qua MCP) |
| B14 | Gemini Live (voice) | Voice chat, share tab trong Live | C |
| B15 | Personal Intelligence | Hiểu lịch sử Gemini app để cá nhân hoá. **Chỉ một số vùng** | S (RAG local) |
| B16 | History recall | Nhớ tab đã mở tuần trước | S |
| B17 | Upload ảnh | Gửi ảnh kèm câu hỏi | M |
| B18 | Multi-conversation | Nhiều cuộc trò chuyện cùng lúc | M |
| B19 | Keyboard shortcuts | Windows: `Alt+G` mở/toggle, `Alt+Shift+G` switch, `Ctrl+Alt+G` selection mode; macOS `Ctrl+G`/`Ctrl+⌘+G`/`Ctrl+Shift+G`; ChromeOS `Search+G` | M (tự cấu hình) — ✅ T-M1-03 (`Ctrl+Shift+K` toggle panel; đổi được → T-M1-18) |
| B20 | Connected apps / Skills cần sign-in Google | Ràng buộc vào hệ sinh thái Google | 🟢 FR-PROVIDER-02 |
| B21 | Chọn model | Không cho chọn model (chỉ model của Gemini) | 🟢 FR-PROVIDER-03 |
| B22 | API / BYOK | Không có | 🟢 FR-PROVIDER-02 |
| B23 | Chạy ngoài Chrome | Không | 🟢 (thiết kế không cấm Firefox) |
| B24 | Log / export transcript | Không có API; người dùng phải copy tay | 🟢 FR-CHAT-10, NFR-MAINT-04 |
| B25 | Self-host | Không | 🟢 FR-PROVIDER-07 |
| B26 | Skill library browser (`chrome://skills/browse`) | Trang xem sẵn skill mẫu, lọc theo loại/tên | S |
| B27 | Yêu cầu đăng nhập | Bắt buộc đăng nhập Google Account; Skills cần **Chrome ≥ 147**, ngôn ngữ **en-US**, ChromeOS/Mac/Windows; không dùng được trên managed/Enterprise account (trừ khi admin bật) | 🟢 Không cần tài khoản hãng; chạy offline được |
| B28 | Tasks / Schedules (chạy nền theo lịch) | **Không có trong sidebar.** Nằm ở **Gemini Apps** (`gemini.google.com`) — không phải Gemini in Chrome. Hỗ trợ time-based (once/hourly/daily/weekly/monthly/yearly), Gmail monitor, topic monitor. Skill = cách làm, Schedule = khi nào chạy | 🟢 FR-WORKFLOW-03/04 (M4) |
| B29 | Trích dẫn nguồn (citations) | Câu trả lời từ nội dung tab được share hiện **số tham chiếu** → bấm xem nguồn | M (chi tiết hơn: chip + popover đoạn nguồn) |
| B30 | Multi-conversation | Nhiều cuộc trò chuyện cùng lúc (B18) — mở lại, đổi tên, xoá chat cũ | 🟢 FR-CHAT-08/09/11 (T-M1-09 — drawer quản lý chat + search + ghim + lưu trữ) |

---

## C. Tính năng độc quyền của Sidekick AI (không hệ thống nào có)

| # | Tính năng | Requirement | Giá trị đối chiếu |
|---|---|---|---|
| C1 | **Multi-provider + model picker** (OpenAI, Gemini, Anthropic, OpenRouter, Groq, Ollama) | FR-PROVIDER-01/03 | Đánh trực tiếp A22, B21 |
| C2 | **BYOK** — tự mang API key, key mã hoá phía server | FR-PROVIDER-02 | Đánh trực tiếp A23, B22 |
| C3 | **Self-host BFF** qua Docker Compose, chạy hoàn toàn local | §6, FR-PROVIDER-07 | Đánh trực tiếp B25 |
| C4 | **MCP-native tool integration** | FR-TOOLS-01/02 | Đánh trực tiếp B13 (thay thế bằng chuẩn mở) |
| C5 | **Log request đầy đủ có cấu trúc** (prompt, context hash, token, cost, latency, tool call) | NFR-MAINT-04, §7.2 | Đánh trực tiếp B24; **đây là nền tảng cho eval** — T-M1-06 đã sửa `context_hash` thành hash của **context thật đã gửi** (trước đó là hash toàn bộ prompt) + thêm `context_snapshot` theo setting |
| C6 | **Token & cost visibility** theo lượt + budget cap | FR-PROVIDER-05/06 | Không có ở A/B |
| C7 | **RAG local** trên lịch sử chat + tài liệu, có trích dẫn | FR-TOOLS-05 | Minh bạch hơn B15 (Personal Intelligence) |
| C8 | **Allowlist/denylist context theo domain** | FR-CONTEXT-08 | Mạnh hơn A2 (chỉ bật/tắt toàn cục) |
| C9 | **Công cụ eval tích hợp** (dataset, judge, dashboard) | `EVAL_PLAN.md` | Không có ở A/B |
| C10 | **Skill import/export JSON** | FR-SKILL-05 | Mở hơn B6 (phụ thuộc tài khoản Google) |
| C11 | **Direct/BYOK fallback mode** khi BFF không chạy | NFR-REL-03, FR-PROVIDER-08/09 | Resilience — không hệ thống nào cần |
| C11b | **3 nguồn key** (team key / BYOK qua BFF / BYOK direct) — linh hoạt cho demo lẫn production | FR-PROVIDER-08/09, §4.6.1 | Quota tách theo người dùng, không bị lock-in |
| C12 | **Agentic action có bước xác nhận + diff** | FR-TOOLS-04 | An toàn hơn A14/B12 (chưa thấy yêu cầu xác nhận chi tiết) |
| C13 | **Không cần tài khoản hãng** (không Microsoft / không Google), chạy được trên managed/Enterprise browser | FR-PROVIDER-02, FR-PROVIDER-07 | Đánh trực tiếp A26, B27 |
| C14 | **Skill library browser nội bộ** (xem/lọc skill) | FR-SKILL-07 | Tương đương `chrome://skills/browse` nhưng không phụ thuộc Google |
| C15 | **Scheduler chạy nền trong sidebar, self-hosted, không cần license** | FR-WORKFLOW-03, §4.7 | Đánh trực tiếp A28, B28 — cả hai đều đẩy tính năng này ra khỏi sidebar sang sản phẩm khác (M365 Copilot Tasks / Gemini Apps) |

---

## D. Bảng tổng hợp theo nhóm tính năng

| Nhóm | Edge Copilot | Chrome Gemini | Sidekick AI | Gap còn lại sau M1 |
|---|---|---|---|---|
| Lõi chat (streaming, markdown, code) | ✅ | ✅ | ✅ | — |
| Context trang | ✅ | ✅ (mặc định bật) | ✅ (**đính kèm chủ động** — T-M1-23) | — |
| Context PDF / video (transcript) | ✅ (A20) | ✅ (B10) | ✅ (T-M1-21/22) | — |
| Multi-tab | ✅ không giới hạn | ✅ tối đa 10 | ✅ không giới hạn | — |
| Selection → hỏi | ✅ | ✅ | ✅ (T-M1-02) | — |
| Trích dẫn nguồn (chip + popover) | ✅ | ✅ | ✅ (T-M1-08 — chi tiết hơn: popover xem **đoạn nguồn**) | — |
| Summarize 1-click | ✅ | ✅ | ✅ | — |
| Prompt gợi ý theo trang | ✅ | ✅ | ✅ | — |
| Lịch sử / nhiều conversation | ✅ | ✅ | ✅ (T-M1-09 — drawer quản lý chat: tạo/đổi tên/xoá/ghim/lưu trữ/search) | — |
| Skills | ➖ | ✅ | ✅ | — |
| Voice | ✅ (M365) | ✅ | ➖ | C |
| Vision / screen share | ✅ (M365) | ➖ | ⚠️ | C |
| Image gen | ✅ | ✅ | ➖ | C |
| Agentic browse | ✅ Actions | ✅ Auto Browse (Pro/Ultra) | ⚠️ | C |
| Connected apps | ✅ M365 | ✅ Google | ➖ (MCP) | C |
| Multi-model / BYOK | ➖ | ➖ | 🟢 | — |
| Self-host / offline | ➖ | ➖ | 🟢 | — |
| MCP | ➖ | ➖ | 🟢 | — |
| Log & eval | ➖ | ➖ | 🟢 | — |
| Cost visibility | ➖ | ➖ | 🟢 | — |
| Per-domain privacy | ⚠️ | ➖ | 🟢 | — |
| Scheduler chạy nền theo lịch | ❌ (chỉ ở M365 Tasks, cần license) | ❌ (chỉ ở Gemini Apps, ngoài sidebar) | 🟢 (M4 — ưu tiên thấp nhất) | — |

> **Ưu tiên cột "Ưu tiên ta":** `M` = Must (M1) · `S` = Should (M2) · `C` = Could (M2/M3) · `—` = không triển khai.
> Workflow/scheduler (A28, B28, C15) được đánh dấu **M4 — implement sau cùng**, vì không nằm trong yêu cầu bắt buộc của giảng viên và là phần đầu tiên bị cắt nếu thiếu thời gian (xem [`REQUIREMENTS.md`](REQUIREMENTS.md) §9.3).

> **Khác biệt cơ chế context (T-M1-23) — cần nói rõ khi trình bày:**
> Edge Copilot và Chrome Gemini **mặc định share tab** (bấm vào icon là dùng ngay). Sidekick AI chọn mô hình **đính kèm chủ động**: tab hiện tại **không** tự vào context; user phải bấm "Thêm trang này" (hoặc `@` / bôi đen / upload file) thì nguồn đó mới được gửi lên. Toggle bật/tắt context **mặc định TẮT** và được lưu lại.
> - **Đánh đổi:** mất 1 điểm "tiện — không cần thao tác" so với Edge/Gemini; đổi lại có 1 điểm "minh bạch + riêng tư" mà Edge/Gemini **không** có (chip luôn hiện đang chia sẻ gì · không gửi gì khi không chủ động yêu cầu · có meter "đã dùng X/Y token").
> - **Ảnh hưởng eval:** nhóm task `general_qa` (chat không cần trang) đo đúng đường này — xem [`EVAL_PLAN.md`](EVAL_PLAN.md) §7 (FC-9). Không so sánh "share tab mặc định" của Edge/Gemini với "đính kèm chủ động" của Sidekick như cùng một hành vi.

---

## E. Khoảng trống cần đóng (checklist parity)

Dùng làm acceptance checklist cho M1.

- [x] Side panel mở được từ toolbar icon (không `default_popup`) — ✅ M0 · **✅ T-M1-03** (native toggle `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` — Chrome 114+ → click icon **mở/đóng**; `action.onClicked` chỉ là fallback cho Chrome cũ)
- [x] Context menu "Ask Sidekick" — ✅ T-M1-03 (2 mục: "Mở Sidekick AI" (`contexts: ['page']`) · "Hỏi Sidekick với đoạn đã chọn" (`contexts: ['selection']` → đoạn chọn vào context `tier: 'selection'`) · đăng ký lại an toàn qua `removeAll()` → `create()` → không lỗi duplicate id khi update extension)
- [x] Keyboard shortcut mở/toggle panel — ✅ T-M1-03 (`Ctrl+Shift+K` · macOS `Command+Shift+K` · custom command `sidekick-toggle-panel` tự xử lý toggle · trạng thái track bằng `chrome.storage.session` + `sidePanel.onOpened`/`onClosed`) — *đổi phím tắt cấu hình được → T-M1-18*
- [ ] Panel giữ nguyên khi chuyển tab
- [ ] Stream token-by-token, hiện dần — ✅ M0
- [ ] Markdown + bảng + code block + copy + syntax highlight — ✅ T-M1-07 (`react-markdown` + `remark-gfm` → bảng/strikethrough/task list · `rehype-highlight` (highlight.js đồng bộ, 37 ngôn ngữ) · code block có nhãn ngôn ngữ + nút 1-click copy → toast "Đã sao chép" · bảng rộng scroll ngang · `rehype-sanitize` allowlist thẩm chặn XSS · link `target="_blank" rel="noopener noreferrer"`)
- [ ] Đọc nội dung trang hiện tại, bật/tắt được — đọc: ✅ T-M1-01 · bật/tắt: ✅ T-M1-04 (hấp thụ bởi T-M1-23)
- [ ] Đọc nội dung file PDF (text-based) — ✅ T-M1-21
- [ ] Lấy transcript video YouTube — ✅ T-M1-22
- [ ] Ngân sách context + cắt bớt thông minh ("đã dùng X/Y token") — ✅ T-M1-23
- [ ] Chat được mà không cần đính kèm trang/tài liệu nào (chat thuần LLM) — ✅ T-M1-23 (FR-CONTEXT-13) · *giới hạn: web search bật ở M2 — FR-TOOLS-03*
- [ ] Upload ảnh kèm câu hỏi — ✅ T-M1-24 (paste · drag-drop · file picker · preview + xoá từng ảnh · giới hạn 5 MB/4 ảnh · lưu Postgres → multi-turn · Gemini `inline_data` + Groq/OpenRouter `image_url` · provider không hỗ trợ → tự fallback) — *đối chiếu B17*
- [ ] `@` đính kèm tab (nhiều tab), hiện chip trạng thái — ✅ T-M1-05 (popover favicon + title + domain · dấu ✓ tab đã đính kèm · gạch tab đang active · lọc theo query)
- [ ] Bôi đen → hỏi (selection context) — ✅ T-M1-02 (nút nổi "Hỏi Sidekick" cạnh vùng chọn + nút "Dính đoạn đã chọn" trong panel · tier `selection` cao nhất · panel đóng thì đoạn chờ lưu storage, mở sau tự nhận)
- [ ] Trích dẫn nguồn: chip `[N]` trong câu trả lời → popover hiện **đoạn nguồn** + mở tab gốc — ✅ T-M1-08 (server đánh số nguồn theo tier `selection` > `attachment` > `currentTab` · LLM trả marker `[N]` → server parse, **loại số vượt phạm vi** · SSE `citation` trước `done` + lưu bảng `citations` · extension: remark plugin `citationPlugin` gắn `dataCitationIndex` → `CitationChip` + `CitationPopover` (Radix) + `CitationList` tóm tắt nguồn)
- [ ] Context tái lập lượt chat (log `context_hash` khớp context đã gửi + snapshot theo setting) — ✅ T-M1-06 (hash deterministic của context **đã cắt ngân sách** · `context_snapshot` jsonb **mặc định TẮT** qua `LOG_CONTEXT_SNAPSHOT` · không gộp với cờ lưu prompt đầy đủ)
- [ ] Không trích xuất lại trang đã đọc + fallback khi trang lỗi — ✅ T-M1-06 (cache theo URL+hash trong `chrome.storage.local` · TTL 30 phút · tối đa 20 entry · **không có UI mới**)
- [x] Nút tóm tắt 1-click — ✅ T-M1-11 (nút "Tóm tắt trang này" trong empty state · bấm 1 lần → tự đính kèm trang hiện tại rồi gửi `SUMMARY_PROMPT` · wording trùng dataset eval `summarize`)
- [x] Prompt gợi ý theo loại trang — ✅ T-M1-11 (bộ luật phân loại ở `packages/shared/src/pageProfile.ts`: docs / article / forum / video / pdf / shopping / general · mỗi profile **4** gợi ý có `{title}` · nút refresh xoay vòng deterministic trong cùng profile · đổi tab → đổi bộ gợi ý · không có tab đọc được → 4 gợi ý chung FR-UX-04)
- [ ] Nhiều conversation: tạo / đổi tên / xoá / ghim — ✅ T-M1-09 (drawer `ConversationList` (Radix Dialog trượt từ trái) · tạo / đổi tên / xoá (có confirm dialog) / ghim / lưu trữ / search theo tên · **phạm vi: ghim ở cấp conversation**, ghim tin nhắn để task sau)
- [ ] Stop / Regenerate / Edit-resend — ✅ T-M1-10 (regenerate tạo **biến thể** (switcher "1/2") lưu phía server `messages.meta` → không mất khi reload · edit-resend tạo **branch** (nhánh cũ giữ trong DB, hiển thị ở "Phiên bản cũ") · stop giữ nội dung dở + nút "Tiếp tục" (continue UPDATE message cũ) · Enter gửi / Shift+Enter xuống dòng / Esc dừng · tự lưu draft · auto-scroll chỉ khi ở đáy + nút "Cuộn xuống")
- [ ] Export conversation (Markdown / JSON) — ⬜ T-M1-13
- [ ] Skills `/` + tạo/sửa/xoá skill + library có sẵn + trang duyệt skill library — ⬜ T-M2-04/06/21
- [ ] Onboarding lần đầu 3 bước — ✅ T-M1-25 (bước 1 giải thích quyền · bước 2 chọn provider + nhập API key (BYOK K2) hoặc dùng Ollama không cần key · bước 3 thử câu hỏi bằng SSE thật · skippable ở mọi bước · mở lại được từ nút "Hướng dẫn" trong header)
- [ ] Không bắt buộc đăng nhập tài khoản Microsoft/Google (BYOK hoặc local model) — ✅ T-M1-25 (BYOK K2 qua onboarding + Ollama local không cần key)
- [ ] Settings: theme, cỡ chữ, chiều rộng, provider/key, quản lý dữ liệu, i18n VI/EN — ⬜ T-M1-12/16/17
- [ ] Token/cost hiển thị — ⬜ T-M2-03
- [ ] Keyboard shortcuts cấu hình được — ⬜ T-M1-18
- [ ] Log request đầy đủ vào DB — ⬜ T-M1-14
- [ ] Direct/BYOK fallback khi BFF down — ⬜ T-M1-15

### E.2 Checklist M4 — Workflow (ngoài đường găng, chỉ làm sau khi M0–M3 xong)

- [ ] Workflow CRUD: tạo / sửa / xoá / bật-tắt / nhân bản
- [ ] Trigger thủ công "chạy ngay" chạy được 1 workflow thật
- [ ] Trigger theo lịch (cron/interval) fire đúng giờ khi panel **đang đóng**
- [ ] Kết quả nằm trong 1 conversation riêng, có gắn workflow id
- [ ] Lịch sử run: từng bước, output, token, chi phí, lỗi
- [ ] Import/export workflow JSON
- [ ] Notification khi run xong
- [ ] Dry-run không thực thi hành động có tác dụng phụ
- [ ] Giới hạn an toàn: ≤ 10 bước, quota chạy/ngày
- [ ] ≥ 3 workflow mẫu tích hợp chạy được

---

## F. Nguồn bổ sung cần đọc khi triển khai

- Side Panel API quirks: `browser.sidePanel` alias chỉ từ Chrome 148; `close({tabId})` từ Chrome 141; `getLayout()` từ Chrome 140; `onOpened` từ 141; `onClosed` từ 142.
- `activeTab` **không** được cấp khi user tương tác trong side panel → bắt buộc `tabs` + `scripting` + `host_permissions`.
- Khác biệt Firefox: `sidebar_action` / `browser.sidebarAction` — không nằm trong scope M1–M2 nhưng nên giữ abstraction layer theo hướng đó.
