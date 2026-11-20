# Visual Vulnerable Web App (VVWA)

> **Mục tiêu sư phạm:** Một phiên bản **trực quan hóa kiểu DVWA** giúp sinh viên (đặc biệt là những bạn mới học hoặc còn yếu lập trình) **nhìn thấy tận mắt** cơ chế hoạt động của lỗ hổng bảo mật và *Secure Coding / Safety Pattern* trên ứng dụng thương mại điện tử mẫu **MiniShop**, thông qua mô hình tự clone, tự chạy và tự sửa code ngay trên máy cá nhân.

---

## 1. Điểm khác biệt so với DVWA / Juice Shop

| Tiêu chí | Nền tảng truyền thống | Visual Vulnerable Web App (VVWA) |
| :--- | :--- | :--- |
| **Chuyển đổi chế độ** | Đổi level ở trang cài đặt riêng | **Công tắc `Vulnerable ↔ Secure` ngay tại màn hình bài học**, giữ nguyên input để so sánh tức thì |
| **Xem mã nguồn** | Popup tĩnh, khó đối chiếu | **Chia đôi màn hình (Split-screen)**, toggle tab **Backend (FastAPI) / Frontend (React) / Diff View** |
| **Trực quan hóa luồng chạy** | Không có | **Live Highlighting:** Sơ đồ luồng và **đúng dòng code đang chạy phát sáng** (đỏ: bị khai thác, xanh: đã chặn) kèm giá trị biến thực tế |
| **Thực hành tự vá lỗi** | Hạn chế | Clone về máy, mở thư mục `labs/` sửa trực tiếp với **Hot Reload** + nút **Test My Fix** |
| **Lưu tài liệu học** | Copy thủ công | **Tải riêng từng snippet** (`.zip` gồm `vulnerable.py`, `secure.py`, `diff.patch`, `README.md`) |

---

## 2. Công nghệ sử dụng (Tinh gọn & Sát thực tế)

* **Frontend:** React + TypeScript (strict) + Vite + Tailwind CSS v4 + `pnpm` *(shadcn/ui tích hợp từ Phase 1 UI Workspace)*
* **Backend:** Python 3.12 (`uv` workspace) + FastAPI + `asyncpg`
* **Database:** PostgreSQL 16 (phân quyền user riêng + nút Reset Lab 1-click)
* **Môi trường chạy local:** Docker Compose (3 service: `frontend`, `backend`, `postgres`, hỗ trợ Hot Reload)
* **Quality & Governance:** Ruff, Mypy strict, ESLint strict, Prettier, Pytest, Vitest, `scripts/gates.py`, ADR & GitHub CI phân luồng gate

---

## 3. Mục lục tài liệu thiết kế & Quản trị

1. [**01. Kiến trúc Hệ thống & Database MiniShop**](docs/01-architecture.md)
   * Sơ đồ kiến trúc 3 service, cấu trúc thư mục tách `core/` và `labs/`, lược đồ PostgreSQL cho MiniShop, bảo vệ & Reset DB.
2. [**02. Đặc tả Kỹ thuật: Trace, Highlight & Snippet**](docs/02-trace-and-snippet-spec.md)
   * Chuẩn API FastAPI, cấu trúc JSON `trace` cho hiệu ứng sáng đèn, cơ chế tag `# @step` chống lệch dòng và đóng gói snippet `.zip`.
3. [**03. Thiết kế Giao diện & Trải nghiệm Sư phạm (UI/UX)**](docs/03-ui-ux-wireframe.md)
   * Wireframe màn hình học tập Split-screen, thanh luồng trực quan, nút 1-click Payload và `Test My Fix`.
4. [**04. Quy chuẩn Tạo Bài Lab & Lộ trình Triển khai**](docs/04-lab-authoring-and-roadmap.md)
   * Chuẩn `meta.json`, danh sách bài lab ánh xạ theo tính năng MiniShop và lộ trình 3 giai đoạn.
5. [**05. Design System (Hệ thống Thiết kế Nhất quán)**](docs/05-design-system.md)
   * Bộ màu ngữ nghĩa (Vulnerable/Secure/Trace), font tiếng Việt (`Be Vietnam Pro` + `JetBrains Mono`), thư viện UI (Tailwind + shadcn/ui), quy chuẩn component và animation phát sáng.
6. [**AGENTS.md — Quy chuẩn kỹ thuật cho AI Coding Agents**](AGENTS.md) & [**Contributing Guide**](docs/CONTRIBUTING.md)
   * Quy tắc `<= 350` dòng/file, Barrel Imports, Type Hinting & Docstrings, quy ước nhánh/commit và ma trận Quality Gates.
7. [**Architecture Decision Records (ADR)**](docs/adr/README.md)
   * Lịch sử các quyết định kiến trúc cốt lõi của dự án.
