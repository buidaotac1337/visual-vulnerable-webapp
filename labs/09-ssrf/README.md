# Lab 09: SSRF — Kiểm tra ảnh sản phẩm từ URL ngoài

## 1. Bản chất lỗ hổng

**Server-Side Request Forgery (SSRF)** xảy ra khi ứng dụng cho phép người dùng kiểm soát URL mà server tự gọi ra ngoài, nhưng không kiểm tra đích đến hay chính sách chuyển hướng. Kẻ tấn công lợi dụng vị trí mạng nội bộ của backend để truy cập các dịch vụ không mở ra internet.

Trong MiniShop, chức năng cập nhật ảnh sản phẩm từ URL ngoài ở chế độ `Vulnerable` gửi thẳng `image_url` vào `httpx.AsyncClient(follow_redirects=True)`:

```python
async with httpx.AsyncClient(follow_redirects=True, timeout=3.0) as client:
    response = await client.get(raw_url)
```

| Payload tấn công | Cơ chế khai thác | Hậu quả trong sandbox |
| :--- | :--- | :--- |
| `http://internal-metadata:8090/latest/meta-data/iam-credentials` | Gọi thẳng tới dịch vụ nội bộ không công khai | Rò rỉ mock Cloud IAM credentials (`ASIA-VVWA-DEMO-9001`) |
| `http://internal-metadata:8090/admin/config` | Truy cập endpoint quản trị nội bộ | Rò rỉ `jwt_signing_key` và `db_admin_dsn` |
| `http://minishop-cdn:8090/cdn/redirect-to-metadata` | CDN hợp lệ trả `302 Found` sang `internal-metadata:8090` | Vượt qua allowlist hostname nếu client tự theo dõi redirect |
| `http://127.0.0.1:8000/api/health` | Trỏ về địa chỉ loopback của chính backend | Quét cổng và đọc phản hồi dịch vụ nội bộ |
| `file:///etc/passwd` | Dùng scheme ngoài HTTP/HTTPS | Gây lỗi giao thức không kiểm soát nếu không lọc scheme |

## 2. Safety Pattern (Phòng thủ nhiều lớp — ADR-0009)

Không bao giờ dựa vào blacklist chuỗi như `"127.0.0.1" in url`. Phải áp dụng chuỗi kiểm tra 6 lớp tại [`secure.py`](backend/secure.py) (chi tiết tại [ADR-0009](../../docs/adr/0009-ssrf-http-client-and-internal-target.md)):

1. **Phiên đăng nhập (`ctx.actor is not None`):** Chỉ cho phép tài khoản đã đăng nhập thực hiện tải URL ngoài.
2. **Kiểm tra cú pháp & scheme:** Chỉ nhận `http`/`https`, từ chối ký tự điều khiển/dấu `\`, và từ chối thông tin xác thực nhúng (`user:pass@`).
3. **Allowlist hostname:** Chỉ cho phép hostname nằm trong `Settings.ssrf_allowed_host_set` (mặc định `minishop-cdn`).
4. **Phân giải DNS & lọc IP nhiều dải:** Dùng `socket.getaddrinfo` kiểm tra **mọi** IP trả về (giải bọc IPv4-mapped IPv6 như `::ffff:127.0.0.1`), luôn chặn `is_loopback`, `is_link_local` (`169.254.169.254`), `is_multicast`, `is_reserved`, `is_unspecified`, non-global (`100.64.0.0/10`, `fc00::/7`), và `is_private`.
   * *Lưu ý môi trường Docker offline:* Trong mạng Docker Compose không có internet, `minishop-cdn` được phân giải thành IP dải cầu nối riêng (`172.x.x.x`), nên `secure.py` chỉ nới ngoại lệ `is_private` cho đúng hostname cấu hình trong `Settings.ssrf_demo_cdn_host`. Trong sản phẩm thực tế trên internet, **mọi** IP riêng/nội bộ (`not ip.is_global`) đều phải bị chặn vô điều kiện.
5. **Tắt chuyển hướng (`follow_redirects=False`):** Từ chối mọi phản hồi `3xx` để chặn kỹ thuật bypass allowlist bằng `302 Redirect`.
6. **Xác thực phản hồi ảnh:** Chỉ nhận HTTP `200`, `Content-Type` thuộc `image/png` / `image/jpeg` / `image/webp`, kiểm tra magic bytes khớp MIME, kích thước `<= 256 KiB`, và không bao giờ trả `body_preview` khi bị từ chối.

## 3. Hướng dẫn thực hành

1. Ở chế độ **Vulnerable**, bấm chip **Ảnh CDN hợp lệ (kb.png)** rồi bấm **Kiểm tra & Cập nhật ảnh**: MiniShop tải PNG 1x1 từ `minishop-cdn:8090` và cập nhật ảnh sản phẩm `#1`.
2. Lần lượt thử các chip **Đọc IAM Metadata nội bộ**, **Đọc cấu hình Admin nội bộ**, **Vượt allowlist bằng 302 Redirect**, và **Quét cổng loopback (127.0.0.1:8000)**: quan sát khung cảnh báo đỏ hiển thị dữ liệu nội bộ rò rỉ và bước `validate-target` / `fetch-url` phát sáng trong Code Inspector.
3. Gạt sang chế độ **Secure** và chạy lại các payload tấn công: chỉ `minishop-cdn:8090/cdn/kb.png` được phép; mọi truy cập `internal-metadata`, `302 Redirect`, `127.0.0.1`, và `file://` đều bị chặn an toàn (`body_preview: null`).
4. Mở `labs/09-ssrf/backend/vulnerable.py`, vá hàm `fetch_product_image` theo mẫu trong tab **Diff**, lưu file và bấm **Test My Fix** để đạt **7/7 PASS**.
