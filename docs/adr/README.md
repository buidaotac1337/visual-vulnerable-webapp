# Architecture Decision Records (ADR)

Thư mục này lưu giữ các **Quyết định Kiến trúc (ADR)** quan trọng của dự án **Visual Vulnerable Web App (VVWA)** để đảm bảo lịch sử lý do thiết kế minh bạch cho cả lập trình viên và AI agents.

## Khi nào BẮT BUỘC tạo ADR mới?

* Thêm, thay thế hoặc gỡ bỏ framework, database, runtime, hoặc công cụ quản lý phụ thuộc.
* Thay đổi hợp đồng API, cấu trúc JSON `trace`, cú pháp `# @step`/`# @snippet`, hoặc schema `meta.json`.
* Thay đổi cấu trúc thư mục, ranh giới module (`core/` vs `labs/`), quy chuẩn barrel import, hoặc ngưỡng Quality Gate.
* Thay đổi cơ chế bảo mật sandbox hoặc mô hình phân quyền PostgreSQL (`lab_app_user` vs `lab_admin_user`).

## Quy trình tạo ADR

1. Sao chép [0000-template.md](0000-template.md) thành `NNNN-short-kebab-title.md` (số thứ tự tăng dần 4 chữ số).
2. Điền đầy đủ các mục bắt buộc: `## Status`, `## Context`, `## Decision`, `## Consequences`.
3. Thêm dòng tương ứng vào bảng Danh mục bên dưới.
4. Chạy `uv run python scripts/gates.py --gate docs` để kiểm tra hợp lệ.

## Danh mục ADR

| ID | Tiêu đề | Trạng thái | Ngày |
| :--- | :--- | :--- | :--- |
| [0001](0001-uv-workspace-and-pinned-dependencies.md) | Sử dụng Python `uv` Workspace & Pin Exact Version toàn bộ Stack | Accepted | 2026-11-21 |
| [0002](0002-frontend-typescript-and-design-system.md) | Nâng cấp Frontend sang Strict TypeScript & Tailwind CSS v4 | Accepted | 2026-11-21 |
| [0003](0003-quality-gates-and-modular-boundaries.md) | Thiết lập Quality Gates phân luồng, giới hạn 350 LOC & Barrel Imports | Accepted | 2026-11-21 |
| [0004](0004-frontend-workspace-architecture-and-lab-plugin-contract.md) | Kiến trúc Frontend Workspace, Lab Plugin Contract & Shiki Syntax Highlighting | Accepted | 2026-11-21 |
| [0005](0005-lab-session-actor-context.md) | Ngữ cảnh Phiên đăng nhập (Session Actor) cho Handler Bài Lab | Accepted | 2026-11-21 |
| [0006](0006-frontend-sink-grading-and-verify-matchers.md) | Chấm Bản vá phía Frontend (Sink Files) & Toán tử So khớp cho Test My Fix | Accepted | 2026-11-21 |
| [0007](0007-file-upload-sandbox-isolation.md) | Cách ly Sandbox Ghi File & Giới hạn Jail cho Lab 07 File Upload | Accepted | 2026-11-22 |
| [0008](0008-db-transactions-and-concurrent-verify-tests.md) | Giao dịch Cơ sở dữ liệu (`db.transaction()`) & Kiểm thử Đồng thời / Nhiều bước trong `verifyTests` | Accepted | 2026-11-22 |
| [0009](0009-ssrf-http-client-and-internal-target.md) | Thư viện HTTP Client (`httpx`), Internal Demo Target & Phòng thủ SSRF cho Lab 09 | Accepted | 2026-11-22 |
