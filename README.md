# VVWA — Visual Vulnerable Web App

Nền tảng lab bảo mật web chạy local. VVWA cho thấy từng bước thực thi của một lỗ hổng và của bản vá trên ứng dụng thương mại điện tử mẫu **MiniShop**: request đi qua tầng nào, dòng code nào chạy, câu SQL thực tế ra sao, và vì sao bản an toàn chặn được payload.

> [!WARNING]
> Mã trong `labs/*/backend/vulnerable.py` và `labs/*/frontend/vulnerable.tsx` chứa lỗ hổng **có chủ đích**. Chỉ chạy VVWA trên máy local, không triển khai ra Internet hay mạng dùng chung.

---

## Tính năng

| Tính năng | Mô tả |
| :--- | :--- |
| **Chuyển chế độ tức thì** | Công tắc `Vulnerable ↔ Secure` ngay trên màn hình lab, giữ nguyên dữ liệu đã nhập để so sánh hai bản cài đặt. |
| **Live Trace** | Pipeline `MiniShop UI → FastAPI → PostgreSQL` và dòng code đang chạy phát sáng theo từng bước (đỏ: bị khai thác, xanh: đã chặn), kèm giá trị thực tế như câu SQL sau khi ghép chuỗi. |
| **Code Inspector** | Đọc trực tiếp mã nguồn trên đĩa với các tab **Backend** / **Frontend** / **Diff**, tô màu cú pháp bằng Shiki. |
| **Test My Fix** | Sửa `vulnerable.py` hoặc `vulnerable.tsx`, bấm một nút để chấm bằng bộ `verifyTests` khai báo trong `meta.json`. |
| **Persona đăng nhập** | Chọn người dùng đang đăng nhập cho các lab phân quyền. Engine cấp danh tính qua header `X-VVWA-Actor`, tách biệt với payload. |
| **Reset DB 1-click** | Khôi phục dữ liệu MiniShop về trạng thái seed trong chưa tới một giây. |
| **Tải snippet** | Tải gói `.zip` gồm bản lỗi, bản vá, `diff.patch` và `README.md` của lab. |
| **Hot reload** | Lưu file trong `labs/` là API và giao diện cập nhật ngay, không cần khởi động lại. |

## Bắt đầu nhanh

Yêu cầu duy nhất: **Docker Desktop** (Docker Compose v2).

```bash
git clone https://github.com/buidaotac1337/visual-vulnerable-webapp.git
cd visual-vulnerable-webapp
docker compose up --build
```

| Dịch vụ | Địa chỉ |
| :--- | :--- |
| Workspace (giao diện) | <http://localhost:5173> |
| API health | <http://localhost:8000/api/health> |
| API docs (OpenAPI) | <http://localhost:8000/docs> |
| PostgreSQL | `localhost:5432`, database `minishop` |

Cấu hình cổng, biến môi trường và xử lý sự cố: xem [Cài đặt & Vận hành](docs/getting-started.md).

## Danh sách lab

| ID | Lab | Nhóm | Mức độ | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| [`01-sql-injection`](labs/01-sql-injection/README.md) | SQL Injection — Đăng nhập & Tìm kiếm MiniShop | Injection | Cơ bản | Có sẵn |
| [`02-stored-xss`](labs/02-stored-xss/README.md) | Stored XSS — Đánh giá sản phẩm MiniShop | XSS | Cơ bản | Có sẵn |
| [`03-idor`](labs/03-idor/README.md) | IDOR — Xem chi tiết đơn hàng MiniShop | Access Control | Cơ bản | Có sẵn |
| [`04-business-logic`](labs/04-business-logic/README.md) | Business Logic — Giỏ hàng & Thanh toán MiniShop | Business Logic | Cơ bản | Có sẵn |
| [`05-mass-assignment`](labs/05-mass-assignment/README.md) | Mass Assignment — Cập nhật hồ sơ khách hàng MiniShop | Access Control | Cơ bản | Có sẵn |
| `06` | Path Traversal / File Upload — Hóa đơn & Ảnh sản phẩm | File Handling | — | Kế hoạch |

Danh sách đầy đủ: [Lộ trình](docs/roadmap.md).

## Công nghệ

| Thành phần | Công nghệ |
| :--- | :--- |
| Frontend | React 19, TypeScript (strict), Vite 6, Tailwind CSS v4, Shiki, lucide-react, `pnpm` |
| Backend | Python 3.12, FastAPI, Pydantic v2, `asyncpg`, `uv` workspace |
| Database | PostgreSQL 16 (tách quyền `lab_app_user` / `lab_admin_user`) |
| Môi trường chạy | Docker Compose (3 service: `frontend`, `backend`, `postgres`) |
| Chất lượng | Ruff, mypy `--strict`, ESLint, Prettier, Pytest, Vitest, `scripts/gates.py`, GitHub Actions |

## Cấu trúc repository

```text
visual-vulnerable-webapp/
├── core/
│   ├── backend/      # FastAPI engine: nạp lab, trace, source reader, verifier, reset DB
│   ├── frontend/     # Workspace React: sandbox, code inspector, trace playback, verify
│   └── postgres/     # init.sql (schema + phân quyền), seed.sql (dữ liệu MiniShop)
├── labs/             # Các bài lab, mỗi lab một thư mục <id>-<slug>/
├── docs/             # Tài liệu sản phẩm, kỹ thuật và ADR
├── scripts/          # Quality checkers và bộ chạy gate thống nhất
├── docker-compose.yml
└── AGENTS.md         # Quy chuẩn kỹ thuật cho AI coding agents
```

Chi tiết từng module: [Kiến trúc hệ thống](docs/architecture.md).

## Tài liệu

| Tài liệu | Nội dung |
| :--- | :--- |
| [Cài đặt & Vận hành](docs/getting-started.md) | Yêu cầu hệ thống, chạy bằng Docker, cổng, biến môi trường, tài khoản seed, xử lý sự cố |
| [Hướng dẫn sử dụng](docs/user-guide.md) | Bố cục workspace, các điều khiển, quy trình làm một bài lab, Test My Fix |
| [Kiến trúc hệ thống](docs/architecture.md) | 3 service, luồng request, module backend/frontend, lược đồ DB, phân quyền, hot reload |
| [API Reference](docs/api-reference.md) | Endpoint, cấu trúc response và `trace`, header phiên, mã lỗi, gói snippet |
| [Tạo bài lab](docs/lab-authoring.md) | Cấu trúc lab, schema `meta.json`, hợp đồng handler, `@snippet`/`@step`, `LabView`, sink frontend, `verifyTests` |
| [Design System](docs/design-system.md) | Màu ngữ nghĩa, typography, quy chuẩn component |
| [Lộ trình](docs/roadmap.md) | Các giai đoạn phát triển và danh sách lab |
| [Đóng góp](docs/CONTRIBUTING.md) | Môi trường dev, quy ước nhánh/commit, Quality Gates, quy trình PR |
| [Architecture Decision Records](docs/adr/README.md) | Lịch sử quyết định kiến trúc |
| [AGENTS.md](AGENTS.md) | Hợp đồng kỹ thuật cho AI coding agents |

## Đóng góp

Mọi thay đổi đi qua nhánh riêng `<type>/<slug>`, Conventional Commits và Quality Gates:

```bash
uv sync --frozen
uv run python scripts/gates.py --auto
```

Quy trình đầy đủ: [Đóng góp](docs/CONTRIBUTING.md).

## Giấy phép

Phát hành theo giấy phép [MIT](LICENSE).
