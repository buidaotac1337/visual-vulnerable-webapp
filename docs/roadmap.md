# Lộ trình

Trạng thái phát triển của nền tảng và danh sách bài lab trên MiniShop.

## Giai đoạn 1 — Nền tảng & Lab 01 ✅

- [x] Docker Compose 3 service (React Vite + FastAPI + PostgreSQL) với hot reload.
- [x] Source reader: parse `@snippet` / `@step`, tạo diff, đóng gói `.zip`; API Reset DB.
- [x] Workspace theo [Design System](design-system.md): `LabWorkspace`, `TopControlBar`, `FlowPipeline`, `CodeInspector`.
- [x] **Lab 01: SQL Injection** (Đăng nhập & Tìm kiếm sản phẩm).
- [x] Test My Fix tầng backend.

## Giai đoạn 2 — Bộ lab cốt lõi ✅

- [x] Phiên đăng nhập: header `X-VVWA-Actor`, `LabContext`/`ctx`, bộ chọn persona ([ADR-0005](adr/0005-lab-session-actor-context.md)).
- [x] Cặp sink frontend `vulnerable.tsx`/`secure.tsx` (source, Diff, `.zip`), `verifyTests` theo `layer`, toán tử `$contains`/`$notContains`, ESLint chặn sink ([ADR-0006](adr/0006-frontend-sink-grading-and-verify-matchers.md)).
- [x] Bộ chấm frontend trong document trơ, DOM probe, matcher TypeScript, `VerifyModal` gộp kết quả ([ADR-0006](adr/0006-frontend-sink-grading-and-verify-matchers.md)).
- [x] **Lab 02: Stored XSS** (Đánh giá sản phẩm) — sink frontend, persona `ctx`.
- [x] **Lab 03: IDOR / Broken Access Control** (Xem chi tiết đơn hàng) — kiểm tra chủ sở hữu bằng `ctx`.
- [x] **Lab 04: Business Logic & Client-side Trust** (Giỏ hàng / Thanh toán) — tính lại giá từ DB, `quantity: int = Field(gt=0)`.

## Giai đoạn 3 — Mở rộng ✅

- [x] **Lab 05: Mass Assignment** (Cập nhật hồ sơ khách hàng) — schema `ProfileUpdate` với `extra="forbid"`, `ctx`.
- [x] **Lab 06: Path Traversal** (Tải hóa đơn) — tên file theo mẫu, `resolve()` + `is_relative_to()`, kiểm tra chủ sở hữu bằng `ctx`.
- [x] **Lab 07: File Upload** (Tải ảnh sản phẩm MiniShop) — sandbox ghi file tách biệt có outer jail ([ADR-0007](adr/0007-file-upload-sandbox-isolation.md)), kiểm tra magic bytes, sinh tên UUID trong `uploads/`.
- [x] **Lab 08: Race Condition** (Áp mã giảm giá MiniShop) — giao dịch `db.transaction()` với `SELECT ... FOR UPDATE` và kiểm thử đồng thời / hậu kiểm ([ADR-0008](adr/0008-db-transactions-and-concurrent-verify-tests.md)).
- [x] **Lab 09: SSRF** (Kiểm tra ảnh sản phẩm từ URL ngoài) — `httpx` bất đồng bộ, sidecar nội bộ `internal-metadata` / `minishop-cdn`, lọc DNS/IP & cấm redirect ([ADR-0009](adr/0009-ssrf-http-client-and-internal-target.md)).

## Danh mục lab

| Lab | Tính năng MiniShop | Bản lỗi | Bản vá | Phụ thuộc |
| :--- | :--- | :--- | :--- | :--- |
| 01 SQL Injection | Đăng nhập, tìm kiếm | Nối chuỗi `f-string` vào SQL | Parameterized query `$1, $2` | — |
| 02 Stored XSS | Đánh giá sản phẩm | Render bằng `dangerouslySetInnerHTML` | Render dạng chữ (React tự escape); CSP chỉ minh họa, không chấm | Sink frontend ([ADR-0006](adr/0006-frontend-sink-grading-and-verify-matchers.md)) |
| 03 IDOR | Chi tiết đơn hàng | Không kiểm tra chủ sở hữu | `order.user_id == ctx.actor.id` | `ctx` ([ADR-0005](adr/0005-lab-session-actor-context.md)) |
| 04 Business Logic | Giỏ hàng, thanh toán | Tin `price`, `quantity` (số âm) từ client | Tính lại giá từ DB, validate Pydantic `gt=0` | `ctx` |
| 05 Mass Assignment | Hồ sơ khách hàng | Ghi thẳng `dict` vào DB (tự nâng `role`) | Pydantic schema giới hạn trường | `ctx` |
| 06 Path Traversal | Tải hóa đơn | Ghép chuỗi đường dẫn | Tên file theo mẫu, `resolve()` + `is_relative_to()`, kiểm tra chủ sở hữu | `ctx` |
| 07 File Upload | Ảnh sản phẩm | Tin header `Content-Type`, ghép thẳng `filename` | Magic bytes, tên UUID, giới hạn trong `uploads/` | `ctx`, [ADR-0007](adr/0007-file-upload-sandbox-isolation.md) |
| 08 Race Condition | Mã giảm giá | Đọc–kiểm tra–ghi không khóa | `db.transaction()` + `SELECT ... FOR UPDATE` | `ctx`, [ADR-0008](adr/0008-db-transactions-and-concurrent-verify-tests.md) |
| 09 SSRF | Ảnh sản phẩm từ URL | `httpx.AsyncClient(follow_redirects=True)` không kiểm tra host/IP | Allowlist domain, lọc IP sau DNS (kể cả `ipv4_mapped`), `follow_redirects=False`, kiểm tra magic bytes | `ctx`, [ADR-0009](adr/0009-ssrf-http-client-and-internal-target.md) |
