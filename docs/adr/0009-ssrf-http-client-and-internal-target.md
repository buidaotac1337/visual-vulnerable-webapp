# 0009. Thư viện HTTP Client (`httpx`), Internal Demo Target & Phòng thủ SSRF cho Lab 09

## Status

Accepted — triển khai cùng Lab 09 (`09-ssrf`), nâng `httpx==0.28.1` lên runtime dependency của [`vvwa-backend`](../../core/backend/pyproject.toml), bổ sung sidecar nội bộ [`internal_demo.py`](../../core/backend/app/internal_demo.py) trong [`docker-compose.yml`](../../docker-compose.yml), và cấu hình allowlist trong [`Settings`](../../core/backend/app/core/config.py).

* **Date:** 2026-11-22
* **Deciders:** Maintainers / Agents

## Context

Bài lab **Lab 09: SSRF — Kiểm tra ảnh sản phẩm từ URL ngoài** yêu cầu backend MiniShop thực hiện lời gọi HTTP outbound tới một URL do người dùng cung cấp để kiểm tra định dạng ảnh và cập nhật `products.image_url`. Trước khi triển khai Lab 09, hạ tầng có ba khoảng trống kiến trúc cần quyết định rõ ràng:

1. **Chưa có HTTP client bất đồng bộ trong runtime dependencies của backend:** `httpx==0.28.1` mới chỉ có trong nhóm `dev` ở [`pyproject.toml`](../../pyproject.toml) để phục vụ test, chưa được cài đặt trong image Docker runtime của `vvwa-backend`.
2. **Mục tiêu tấn công SSRF phải xác định, cô lập và hoạt động hoàn toàn offline:** Một bài lab SSRF không thể phụ thuộc vào internet công cộng hay giả lập `if "169.254.169.254" in url` bằng chuỗi giả. Cần một dịch vụ HTTP thật chỉ tồn tại trong mạng Docker nội bộ (không publish cổng ra máy host) để minh họa cả:
   * Đích hợp lệ: CDN ảnh sản phẩm (`minishop-cdn:8090`).
   * Đích nội bộ nhạy cảm: mock Cloud IAM Metadata & cấu hình admin (`internal-metadata:8090`).
   * Kỹ thuật vượt allowlist qua chuyển hướng: endpoint trên CDN hợp lệ trả về `302 Found` trỏ sang `internal-metadata:8090`.
3. **Đặc thù IP riêng (RFC 1918) trong mạng bridge Docker offline:** Trong môi trường Docker Compose offline, ngay cả hostname hợp lệ `minishop-cdn` cũng phân giải ra địa chỉ IP thuộc dải Docker bridge riêng (`172.x.x.x`), khiến hàm kiểm tra `ip.is_private` thông thường sẽ tự động chặn luôn demo CDN nếu không có cấu hình tách bạch rõ ràng.

## Decision Drivers

* **Tái lập 100% offline trên cả Docker Compose lẫn pytest/CI:** Không phụ thuộc internet, không phụ thuộc DNS Docker khi chạy unit/integration test.
* **An toàn cho máy host:** Sidecar demo tuyệt đối không mở `ports:` ra host và chỉ trả dữ liệu mock giáo dục (không chứa bí mật thật).
* **Phòng thủ nhiều lớp (Defense-in-Depth) trung thực:** Không dùng blacklist chuỗi thô sơ; phải kiểm tra đồng bộ cả scheme, thông tin xác thực nhúng, allowlist hostname, địa chỉ IP sau phân giải DNS (bao gồm IPv4-mapped IPv6), chính sách redirect, `Content-Type`, magic bytes và giới hạn kích thước.
* **Tối ưu tài nguyên container:** Tái sử dụng build image của `core/backend/Dockerfile` thay vì thêm image bên thứ ba mới.

## Decision

1. **Nâng `httpx==0.28.1` thành runtime dependency của `vvwa-backend`:**
   * Thêm `"httpx==0.28.1"` vào `dependencies` trong [`core/backend/pyproject.toml`](../../core/backend/pyproject.toml), loại bỏ khai báo trùng ở nhóm `dev` của [`pyproject.toml`](../../pyproject.toml), và cập nhật [`uv.lock`](../../uv.lock) bằng `uv lock`.
   * Cả `vulnerable.py` và `secure.py` đều dùng `httpx.AsyncClient` để không làm nghẽn event loop của FastAPI/Uvicorn (đặc biệt khi test quét cổng loopback `http://127.0.0.1:8000/api/health`).

2. **Bổ sung sidecar `internal-metadata` qua [`internal_demo.py`](../../core/backend/app/internal_demo.py) & [`docker-compose.yml`](../../docker-compose.yml):**
   * Chạy lệnh `uvicorn app.internal_demo:app --host 0.0.0.0 --port 8090` trên cùng image `core/backend/Dockerfile`, **không** khai báo `ports:` ra host, gắn hai alias trên mạng Docker mặc định: `internal-metadata` và `minishop-cdn`.
   * Phân tách dịch vụ theo HTTP header `Host`:
     * `Host: internal-metadata*` (và loopback `127.0.0.1` / `localhost` trong test offline): phục vụ `GET /latest/meta-data/iam-credentials` (mock IAM JSON), `GET /admin/config` (mock internal config JSON), và `GET /health`.
     * `Host: minishop-cdn*` (và loopback trong test offline): phục vụ `GET /cdn/kb.png`, `/cdn/mouse.png`, `/cdn/headset.png` (PNG 1x1 hợp lệ, `Content-Type: image/png`) và `GET /cdn/redirect-to-metadata` (`302 Found` với `Location: http://internal-metadata:8090/latest/meta-data/iam-credentials`, cho phép tùy biến `metadata_base_url` trong `create_internal_demo_app()` cho test loopback).
     * Yêu cầu tới route không thuộc virtual host tương ứng nhận `404`.

3. **Cấu hình allowlist trong [`Settings`](../../core/backend/app/core/config.py) và chuỗi phòng thủ 6 lớp trong `secure.py`:**
   * Thêm `ssrf_allowed_hosts: str = "minishop-cdn"` (`VVWA_SSRF_ALLOWED_HOSTS`, kèm property `ssrf_allowed_host_set`) và `ssrf_demo_cdn_host: str = "minishop-cdn"` (`VVWA_SSRF_DEMO_CDN_HOST`).
   * `labs/09-ssrf/backend/secure.py` kiểm tra lần lượt:
     1. **Phiên đăng nhập (`ctx.actor is not None`):** Từ chối truy cập ẩn danh, cho phép persona đã đăng nhập (`admin`, `alice`) thực hành.
     2. **Cấu trúc URL & scheme:** Chỉ cho phép `http` / `https`, `hostname` khác rỗng, không chứa khoảng trắng, dấu `\`, hoặc `username`/`password` nhúng (`user:pass@`).
     3. **Allowlist hostname:** `hostname` sau chuẩn hóa phải thuộc `settings.ssrf_allowed_host_set`.
     4. **Phân giải DNS & lọc IP nhiều dải:** Gọi `socket.getaddrinfo` kiểm tra **mọi** địa chỉ IP trả về (giải bọc `ipv4_mapped`, ví dụ `::ffff:127.0.0.1`). Luôn luôn chặn `is_loopback`, `is_link_local` (như `169.254.169.254`), `is_multicast`, `is_reserved`, `is_unspecified`. Chặn `is_private` trừ trường hợp ngoại lệ được cấu hình tường minh cho môi trường Docker offline (`hostname == settings.ssrf_demo_cdn_host` và `ip.is_private`).
     5. **Cấm chuyển hướng (`follow_redirects=False`):** Sử dụng `httpx.AsyncClient(follow_redirects=False, timeout=3.0)` và từ chối mọi mã phản hồi `3xx` hoặc khác `200`.
     6. **Kiểm chứng nội dung ảnh & không rò rỉ body:** Yêu cầu `Content-Type` thuộc `{image/png, image/jpeg, image/webp}`, kích thước `1..262144` bytes (`<= 256 KiB`), kiểm tra magic bytes khớp với `Content-Type`, và luôn giữ `body_preview = None` khi từ chối.

## Consequences

### Positive
* Sinh viên được khai thác SSRF thực sự trên mạng Docker nội bộ (đọc IAM metadata, đọc admin config, quét loopback `127.0.0.1:8000`, và bypass allowlist qua `302 Redirect`) với thông điệp rõ ràng.
* `internal_demo.py` chạy hoàn toàn trong tiến trình Python trên FastAPI nên test `pytest` có thể dựng cả `ASGITransport` lẫn server loopback cục bộ chỉ trong vài mili-giây.
* Luồng kiểm tra `secure.py` phân biệt rõ ngoại lệ Docker bridge của demo CDN với loopback/link-local/DNS rebinding, nên ngay cả khi `minishop-cdn` bị rebind về `127.0.0.1` hay `169.254.169.254` vẫn bị chặn.

### Negative / Trade-offs
* **Lưu ý về ngoại lệ Docker bridge cho `ssrf_demo_cdn_host`:** Trong môi trường production thực tế trên internet, **mọi** IP `is_private` (hoặc `not ip.is_global`) đều phải bị chặn vô điều kiện; ngoại lệ `hostname == ssrf_demo_cdn_host and ip.is_private` chỉ dành riêng để demo CDN trong mạng bridge nội bộ offline hoạt động không cần internet, và đã được ghi chú rõ trong `README.md` của Lab 09.
* Cần rebuild container `backend` và khởi chạy thêm container `internal-metadata` khi chạy Docker Compose.

## Verification

* `uv lock --check` xác nhận `uv.lock` đồng bộ với `core/backend/pyproject.toml` và `pyproject.toml`.
* `uv run python scripts/gates.py --gate infra` kiểm tra `docker compose config -q` hợp lệ.
* Pytest trong [`test_lab_09_ssrf.py`](../../core/backend/tests/test_lab_09_ssrf.py) kiểm tra tách biệt virtual-host của `internal_demo.py`, toàn bộ vector tấn công trên `vulnerable.py`, chặn DNS rebinding/IPv6-mapped/redirect/scheme/anonymous trên `secure.py`, và `POST /api/labs/09-ssrf/verify?reset_db=true` hoàn toàn offline.
* `uv run python scripts/gates.py --gate backend` và `--gate docs` pass toàn bộ.
