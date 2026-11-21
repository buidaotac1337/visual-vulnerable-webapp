# Lab 07: Unrestricted File Upload — Tải ảnh sản phẩm MiniShop

## 1. Bản chất lỗ hổng

**Unrestricted File Upload** xảy ra khi ứng dụng cho phép người dùng tải file lên server mà chỉ dựa vào thông tin có thể giả mạo từ trình duyệt (`Content-Type` hoặc tên file) và lưu file trực tiếp bằng tên client gửi lên.

Trang cập nhật ảnh sản phẩm của MiniShop nhận JSON `{ product_id, filename, content_type, content_b64 }` và mắc hai lỗi cốt lõi:

```python
if not content_type.lower().startswith("image/"):  # 1. Tin header Content-Type từ client
    ...
target_path = uploads_dir / filename  # 2. Ghép thẳng filename vào uploads/
```

| Payload gửi lên | Lý do vượt qua kiểm tra | Hậu quả trong sandbox |
| :--- | :--- | :--- |
| `shell.py` (`image/png`) | Đổi header thành `image/png`, nội dung vẫn là code Python | Ghi được mã thực thi vào `uploads/shell.py` |
| `banner.svg` (`image/svg+xml`) | `image/svg+xml` bắt đầu bằng `image/` nhưng là XML chạy script | Nguy cơ Stored XSS khi trình duyệt mở `/uploads/banner.svg` |
| `../index.html` (`image/png`) | `uploads_dir / "../index.html"` trỏ ra thư mục cha `webroot/` | Ghi đè trang chủ `webroot/index.html` |
| `../evil.png` (PNG thật) | Dù kiểm tra magic bytes, tên file vẫn chứa `../` | File ảnh thoát khỏi `uploads/` ra `webroot/evil.png` |

## 2. Safety Pattern

Không bao giờ tin `Content-Type` hay `filename` của client. Kết hợp đồng thời **kiểm tra nội dung thật** và **cách ly đường dẫn lưu trữ**:

```python
ext = _detect_image_ext(raw)  # 1. Đọc magic bytes thật (PNG/JPEG/WebP) + giới hạn <= 256 KiB
stored_name = f"{uuid4().hex}.{ext}"  # 2. Sinh tên file ngẫu nhiên, bỏ qua filename client
target_path = (uploads_dir.resolve() / stored_name).resolve()
if not target_path.is_relative_to(uploads_dir.resolve()):  # 3. Chắc chắn nằm trong uploads/
    ...
```

* **Magic bytes + giới hạn kích thước:** Xác thực chữ ký nhị phân ở đầu file (`\x89PNG\r\n\x1a\n`, `\xff\xd8\xff`, `RIFF....WEBP`) thay vì đọc phần mở rộng hay MIME header. Từ chối file rỗng hoặc vượt `256 KiB`.
* **Loại bỏ hoàn toàn tên file client:** Đuôi file suy ra từ kết quả kiểm tra magic bytes; tên file mới sinh từ `uuid4().hex` nên không bao giờ chứa `../`, `/`, null byte hay ghi đè file sẵn có.
* **`resolve()` + `is_relative_to()`:** Khẳng định đường dẫn đích luôn nằm chặt trong `uploads/`.
* **Lưu ý phòng thủ bổ sung (ngoài phạm vi chấm):** Trong ứng dụng thật cần kiểm tra thêm quyền quản trị (`ctx.actor.role == "admin"`), phục vụ file upload qua domain riêng hoặc gắn header `Content-Disposition: attachment` / `X-Content-Type-Options: nosniff`, và re-encode ảnh qua thư viện xử lý ảnh để loại bỏ payload ẩn trong metadata.

## 3. Cách ly Sandbox (ADR-0007)

Trong Docker Compose, container backend mount `./labs` và `./core/backend/app` với quyền ghi để hot reload. Để bài lab an toàn tuyệt đối cho máy host (chi tiết tại [ADR-0007](../../docs/adr/0007-file-upload-sandbox-isolation.md)):

```text
<upload_sandbox_dir>/         # Mặc định <tempdir>/vvwa-uploads (ngoài repo)
└── webroot/
    ├── index.html            # Trang giả lập được seed sẵn
    └── uploads/              # Thư mục đích hợp lệ cho ảnh sản phẩm
```

* Engine cung cấp outer sandbox jail (`write_within_sandbox_jail`): mọi đường dẫn thoát khỏi `<sandbox>` (như `../../../../app/core/backend/app/main.py`) đều bị chặn vật lý trước khi chạm đĩa.
* Trong phạm vi `<sandbox>`, chế độ `Vulnerable` vẫn cho phép `../index.html` thoát khỏi `uploads/` sang `webroot/` để minh họa đúng rủi ro ghi đè webroot.
* Nút **Reset DB** và mỗi ca kiểm thử của **Test My Fix** đều tự động dọn sạch `<sandbox>` và khôi phục `webroot/index.html`.

## 4. Hướng dẫn thực hành

1. Ở chế độ **Vulnerable**, bấm chip **Ảnh PNG hợp lệ** rồi bấm **Tải ảnh lên**: ảnh được lưu vào `uploads/` bình thường.
2. Thử các chip **Giả mạo MIME (shell.py)**, **Stored XSS qua SVG**, **Ghi đè webroot (../index.html)** và **Traversal kèm ảnh thật (../evil.png)**: quan sát cây file `webroot/` cảnh báo đỏ và trace chỉ rõ bước `validate-upload` / `build-upload-path` bị vượt qua.
3. Chọn một file bất kỳ từ máy tính bằng ô chọn file hoặc tự sửa `Tên file` / `Content-Type` rồi bấm **Tải ảnh lên** để thử tamper trực tiếp.
4. Gạt sang **Secure** và thử lại các payload tấn công: tất cả bị chặn (trừ `../evil.png` có byte PNG thật được đổi sang `<uuid>.png` an toàn trong `uploads/`).
5. Mở `labs/07-file-upload/backend/vulnerable.py`, sửa `upload_image` theo safety pattern trong tab **Diff**, lưu file và bấm **Test My Fix** cho tới khi đạt **7/7 PASS**.
