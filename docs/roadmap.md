# Lộ trình

Trạng thái phát triển của nền tảng và danh sách bài lab trên MiniShop.

## Giai đoạn 1 — Nền tảng & Lab 01 ✅

- [x] Docker Compose 3 service (React Vite + FastAPI + PostgreSQL) với hot reload.
- [x] Source reader: parse `@snippet` / `@step`, tạo diff, đóng gói `.zip`; API Reset DB.
- [x] Workspace theo [Design System](design-system.md): `LabWorkspace`, `TopControlBar`, `FlowPipeline`, `CodeInspector`.
- [x] **Lab 01: SQL Injection** (Đăng nhập & Tìm kiếm sản phẩm).
- [x] Test My Fix tầng backend.

## Giai đoạn 2 — Bộ lab cốt lõi (đang triển khai)

- [x] Phiên đăng nhập: header `X-VVWA-Actor`, `LabContext`/`ctx`, bộ chọn persona ([ADR-0005](adr/0005-lab-session-actor-context.md)).
- [x] Cặp sink frontend `vulnerable.tsx`/`secure.tsx` (source, Diff, `.zip`), `verifyTests` theo `layer`, toán tử `$contains`/`$notContains`, ESLint chặn sink ([ADR-0006](adr/0006-frontend-sink-grading-and-verify-matchers.md)).
- [x] Bộ chấm frontend trong document trơ, DOM probe, matcher TypeScript, `VerifyModal` gộp kết quả ([ADR-0006](adr/0006-frontend-sink-grading-and-verify-matchers.md)).
- [x] **Lab 02: Stored XSS** (Đánh giá sản phẩm) — sink frontend, persona `ctx`.
- [ ] **Lab 03: IDOR / Broken Access Control** (Xem chi tiết đơn hàng) — cần `ctx`.
- [ ] **Lab 04: Business Logic & Client-side Trust** (Giỏ hàng / Thanh toán) — cần `ctx`.

## Giai đoạn 3 — Mở rộng

- [ ] **Lab 05: Mass Assignment** (Cập nhật hồ sơ khách hàng).
- [ ] **Lab 06: Path Traversal / File Upload** (Tải hóa đơn & Upload ảnh sản phẩm).
- [ ] **Lab 07: Race Condition** (Áp mã giảm giá) — cần ADR cho test nhiều bước / đồng thời.
- [ ] **Lab 08: SSRF** (Kiểm tra ảnh sản phẩm từ URL ngoài).

## Danh mục lab

| Lab | Tính năng MiniShop | Bản lỗi | Bản vá | Phụ thuộc |
| :--- | :--- | :--- | :--- | :--- |
| 01 SQL Injection | Đăng nhập, tìm kiếm | Nối chuỗi `f-string` vào SQL | Parameterized query `$1, $2` | — |
| 02 Stored XSS | Đánh giá sản phẩm | Render bằng `dangerouslySetInnerHTML` | Render dạng chữ (React tự escape); CSP chỉ minh họa, không chấm | Sink frontend ([ADR-0006](adr/0006-frontend-sink-grading-and-verify-matchers.md)) |
| 03 IDOR | Chi tiết đơn hàng | Không kiểm tra chủ sở hữu | `order.user_id == ctx.actor.id` | `ctx` ([ADR-0005](adr/0005-lab-session-actor-context.md)) |
| 04 Business Logic | Giỏ hàng, thanh toán | Tin `price`, `quantity` (số âm) từ client | Tính lại giá từ DB, validate Pydantic `gt=0` | `ctx` |
| 05 Mass Assignment | Hồ sơ khách hàng | Ghi thẳng `dict` vào DB (tự nâng `role`) | Pydantic schema giới hạn trường | `ctx` |
| 06 Path Traversal / Upload | Hóa đơn, ảnh sản phẩm | Ghép chuỗi đường dẫn | `Path.resolve()` + whitelist phần mở rộng | — |
| 07 Race Condition | Mã giảm giá | Đọc–kiểm tra–ghi không khóa | `SELECT ... FOR UPDATE` / atomic update | `ctx`, ADR mới |
| 08 SSRF | Ảnh sản phẩm từ URL | `httpx.get(url)` trực tiếp | Allowlist domain, chặn dải IP nội bộ | Dependency mới cần ADR |
