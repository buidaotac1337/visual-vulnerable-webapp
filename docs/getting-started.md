# Cài đặt & Vận hành

Hướng dẫn chạy VVWA trên máy local, cấu hình cổng và biến môi trường, và xử lý các sự cố thường gặp.

## 1. Yêu cầu hệ thống

| Thành phần | Phiên bản | Ghi chú |
| :--- | :--- | :--- |
| Docker Desktop / Docker Engine | Có Docker Compose v2 | Bắt buộc để chạy sản phẩm |
| Git | Bất kỳ | Clone repository |
| `uv`, Node.js `22.21.1`, `pnpm` `10.12.1` | Tùy chọn | Chỉ cần khi phát triển, xem [Đóng góp](CONTRIBUTING.md) |

Không cần cài Python, Node.js hay PostgreSQL trên máy để chạy sản phẩm.

## 2. Khởi động

```bash
git clone https://github.com/buidaotac1337/visual-vulnerable-webapp.git
cd visual-vulnerable-webapp
docker compose up --build
```

Compose khởi động song song `postgres` và `internal-metadata` → `backend` (chờ cả hai báo healthy) → `frontend` (chờ `backend` báo healthy). Lần chạy đầu cần build image nên lâu hơn.

| Service | Container | Địa chỉ | Health check |
| :--- | :--- | :--- | :--- |
| `frontend` | `vvwa-frontend` | <http://localhost:5173> | — |
| `backend` | `vvwa-backend` | <http://localhost:8000> | `GET /api/health` |
| `postgres` | `vvwa-postgres` | `localhost:5432` | `pg_isready` |
| `internal-metadata` | `vvwa-internal-metadata` | Chỉ mạng nội bộ `:8090`, không mở cổng ra host (alias `minishop-cdn`) | `GET /health` |

OpenAPI (Swagger UI) của backend có tại <http://localhost:8000/docs>.

### Lệnh vận hành thường dùng

| Mục đích | Lệnh |
| :--- | :--- |
| Chạy nền | `docker compose up -d` |
| Xem log | `docker compose logs -f backend` |
| Dừng | `docker compose down` |
| Xóa sạch dữ liệu và khởi tạo lại DB | `docker compose down -v` rồi `docker compose up --build` |
| Build lại sau khi đổi dependency | `docker compose up --build` |

## 3. Cấu hình

Mọi biến đều có giá trị mặc định trong `docker-compose.yml`. Để tùy chỉnh, sao chép file mẫu rồi sửa:

```bash
cp .env.example .env
```

### Biến của Docker Compose

| Biến | Mặc định | Ý nghĩa |
| :--- | :--- | :--- |
| `POSTGRES_DB` | `minishop` | Tên database |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | `postgres` / `postgres_local_dev` | Superuser của container PostgreSQL |
| `POSTGRES_PORT` | `5432` | Cổng PostgreSQL trên máy host |
| `BACKEND_PORT` | `8000` | Cổng API trên máy host |
| `FRONTEND_PORT` | `5173` | Cổng workspace trên máy host |
| `VITE_WATCH_POLLING` | `true` | Vite theo dõi file bằng polling. Cần khi chạy Docker trên Windows/macOS, vì bind mount từ máy host không phát sự kiện thay đổi file vào container |

Đổi cổng host không ảnh hưởng giao tiếp nội bộ: frontend luôn proxy `/api` tới `http://backend:8000` trong mạng Compose.

### Biến của backend (tiền tố `VVWA_`)

Được đọc bởi `Settings` trong [`core/backend/app/core/config.py`](../core/backend/app/core/config.py).

| Biến | Mặc định | Ý nghĩa |
| :--- | :--- | :--- |
| `VVWA_ENVIRONMENT` | `local` | Tên môi trường, trả về trong `/api/health` |
| `VVWA_CORS_ORIGINS` | `http://localhost:5173` | Danh sách origin, phân tách bằng dấu phẩy |
| `VVWA_DATABASE_URL` | `postgresql://lab_app_user:…@postgres:5432/minishop` | DSN quyền hạn chế, dùng cho mọi request của lab |
| `VVWA_ADMIN_DATABASE_URL` | `postgresql://lab_admin_user:…@postgres:5432/minishop` | DSN quản trị, chỉ dùng cho Reset DB |
| `VVWA_LABS_DIR` | `<repo>/labs` | Thư mục chứa các lab |
| `VVWA_SEED_SQL_PATH` | `<repo>/core/postgres/seed.sql` | Script seed chạy khi Reset DB |
| `VVWA_UPLOAD_SANDBOX_DIR` | `<tempdir>/vvwa-uploads` (`/tmp/vvwa-uploads` trong container) | Thư mục sandbox cô lập cho bài lab upload file (Lab 07, nằm ngoài `labs/` và repo) |
| `VVWA_SSRF_ALLOWED_HOSTS` | `minishop-cdn` | Danh sách hostname cho phép khi chạy bản vá Lab 09 SSRF, phân tách bằng dấu phẩy |
| `VVWA_SSRF_DEMO_CDN_HOST` | `minishop-cdn` | Hostname demo CDN nội bộ trên mạng bridge Docker cho Lab 09 |
| `VVWA_DB_POOL_MIN_SIZE` / `VVWA_DB_POOL_MAX_SIZE` | `1` / `10` | Kích thước pool `asyncpg` |
| `VVWA_DB_CONNECT_TIMEOUT` | `5.0` | Timeout kết nối PostgreSQL (giây) |

> [!NOTE]
> Mật khẩu trong `.env.example` chỉ dành cho môi trường local.

## 4. Dữ liệu MiniShop

* [`core/postgres/init.sql`](../core/postgres/init.sql) tạo schema `minishop`, các bảng và hai role `lab_app_user` / `lab_admin_user`. Script này **chỉ chạy khi volume `vvwa_pg_data` còn trống**.
* [`core/postgres/seed.sql`](../core/postgres/seed.sql) nạp dữ liệu mẫu. Script chạy khi khởi tạo DB lần đầu và mỗi lần bấm **Reset DB**.

Tài khoản có sẵn trong seed:

| Username | Role | Ghi chú |
| :--- | :--- | :--- |
| `admin` | `admin` | Tài khoản quản trị, mục tiêu của các payload leo thang |
| `alice` | `customer` | Khách hàng, dùng cho luồng đăng nhập hợp lệ |
| `bob` | `customer` | Khách hàng thứ hai, dùng cho các lab phân quyền |

Mật khẩu và các dữ liệu khác (sản phẩm, đơn hàng, đánh giá, mã giảm giá) xem trực tiếp trong `seed.sql`.

## 5. Hot reload

| Thay đổi | Cơ chế | Cần làm gì |
| :--- | :--- | :--- |
| `labs/*/backend/*.py` | Engine nạp lại module từ đĩa ở **mỗi request** | Không cần làm gì |
| `labs/*/frontend/*.tsx` | Vite HMR (polling trong Docker) | Không cần làm gì; Test My Fix chấm đúng bản vừa lưu |
| Thư mục lab mới `labs/<id>/` | Backend quét `meta.json` ở mỗi lần tải danh sách; Vite theo dõi cả `labs/` nên `LabView.tsx` mới được nhận ngay | Tải lại trang để danh sách lab cập nhật |
| `core/frontend/src/**` | Vite HMR | Không cần làm gì |
| `core/backend/app/**` | `uvicorn --reload` khởi động lại worker | Không cần làm gì |
| `core/postgres/init.sql` | Chỉ chạy khi volume trống | `docker compose down -v` |
| `pyproject.toml`, `uv.lock`, `package.json`, `pnpm-lock.yaml`, Dockerfile | Nằm trong image | `docker compose up --build` |

Code Inspector tự đọc lại mã nguồn khi cửa sổ trình duyệt được focus lại, hoặc khi bấm nút làm mới.

## 6. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
| :--- | :--- | :--- |
| `port is already allocated` | Cổng 5173 / 8000 / 5432 đang bị chiếm | Đặt `FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_PORT` khác trong `.env` |
| Thanh công cụ không hiện `API: OK` (đứng ở `Connecting API...` hoặc hiện lỗi) | Backend chưa healthy hoặc lỗi khởi động | `docker compose logs backend` |
| API trả `503` | Backend không kết nối được PostgreSQL | Kiểm tra `docker compose ps` và log `postgres` |
| API trả `400 Unknown actor '…'` | Persona đã bị xóa hoặc đổi tên trong DB | Bấm **Reset DB** |
| Sửa file frontend nhưng giao diện không cập nhật | Watcher không nhận sự kiện thay đổi file qua bind mount | Giữ `VITE_WATCH_POLLING=true` (mặc định), rồi `docker compose up -d frontend` |
| Lab không xuất hiện trong danh sách | `meta.json` sai schema hoặc `id` không khớp tên thư mục | Xem warning `Skipping invalid lab` trong log backend |
| Đổi `init.sql` nhưng DB không đổi | Volume đã được khởi tạo từ trước | `docker compose down -v` rồi chạy lại |
| Dữ liệu lab bị sửa sau khi thử payload | Hành vi bình thường của lab ghi dữ liệu | Bấm **Reset DB** |
