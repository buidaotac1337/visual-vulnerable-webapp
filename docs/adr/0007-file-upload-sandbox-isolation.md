# 0007. Cách ly Sandbox Ghi File & Giới hạn Jail cho Lab 07 File Upload

## Status

Accepted — triển khai cùng Lab 07 (`07-file-upload`), `Settings.upload_sandbox_dir`, `app/services/upload_sandbox.py`, và lifecycle reset trong `POST /api/system/reset-db` & `verify_lab`.

* **Date:** 2026-11-22
* **Deciders:** Maintainers / Agents

## Context

Trong `docker-compose.yml`, service `backend` mount trực tiếp hai thư mục của repository với quyền **đọc-ghi** để phục vụ hot reload khi sinh viên sửa bài lab:

* `./labs:/app/labs`
* `./core/backend/app:/app/core/backend/app`

Nếu một bài lab về **Unrestricted File Upload** ghi file trực tiếp vào bên trong `/app/labs/...` hoặc bất kỳ đường dẫn nào thuộc repository, các rủi ro sau xảy ra ngay cả khi học tập cục bộ:

1. **Ghi đè hoặc chèn mã nguồn host:** Một payload path traversal như `../../../../app/core/backend/app/main.py` hoặc `../../labs/07-file-upload/backend/secure.py` ở chế độ `vulnerable` sẽ ghi thẳng ra ổ đĩa máy host và khiến `uvicorn --reload` nạp lại mã độc ngay lập tức.
2. **Rò rỉ trạng thái giữa các test và sau Reset DB:** File sinh viên hoặc test tự động tải lên sẽ tồn tại vĩnh viễn trên đĩa nếu không gắn vào vòng đời làm sạch của `POST /api/system/reset-db` và `verify_lab(reset_db=True)`.
3. **Thay đổi hợp đồng vận chuyển API không cần thiết:** Chuyển toàn bộ router `POST /api/labs/{id}/{mode}/{action}` sang `multipart/form-data` sẽ phá vỡ hợp đồng JSON thống nhất mà `samplePayloads`, `verifyTests`, và `Test My Fix` đang dùng chung.

## Decision Drivers

* **An toàn tuyệt đối cho host mounts:** Không một request nào ở chế độ `vulnerable` có thể ghi file vào `labs/`, `core/`, hay bất kỳ thư mục nào ngoài sandbox tạm.
* **Giá trị sư phạm chân thực:** Ở chế độ `vulnerable`, path traversal hẹp như `../index.html` hoặc upload `shell.py` / `banner.svg` vẫn phải thành công *bên trong* mô phỏng webroot để sinh viên quan sát đúng hậu quả ghi đè webroot và webshell/XSS.
* **Sạch sẽ giữa các lần chạy:** Reset DB và từng ca kiểm thử `Test My Fix` phải khởi đầu trên hệ thống file sạch.
* **Giữ nguyên hợp đồng JSON thống nhất:** Không thêm dependency mới, không phá vỡ chữ ký `POST /api/labs/{id}/{mode}/{action}`.

## Decision

1. **Cấu hình thư mục sandbox tách biệt hoàn toàn (`Settings.upload_sandbox_dir`):**
   * Thêm trường `upload_sandbox_dir: Path` vào [`Settings`](../../core/backend/app/core/config.py) (biến môi trường `VVWA_UPLOAD_SANDBOX_DIR`, mặc định `Path(tempfile.gettempdir()) / "vvwa-uploads"`, tức `/tmp/vvwa-uploads` trong container Linux).
   * Validator chặn giá trị rỗng rơi về thư mục làm việc hiện tại (`Path(".")`), đồng thời từ chối mọi đường dẫn nằm trong hoặc bao trùm `labs_dir` hay thư mục gốc repository.

2. **Ranh giới an toàn hai lớp trong [`upload_sandbox.py`](../../core/backend/app/services/upload_sandbox.py):**
   * **Cấu trúc mô phỏng bên trong sandbox:**
     * `<sandbox>/webroot/` — thư mục gốc web giả lập, được seed sẵn một file vô hại `webroot/index.html`.
     * `<sandbox>/webroot/uploads/` — thư mục đích công khai cho ảnh sản phẩm hợp lệ.
   * **Hard outer jail (`write_within_sandbox_jail(sandbox_dir, target_path, data)`):**
     * Chuẩn hóa `target_path.resolve()` và ném `ValueError` nếu đường dẫn không nằm chặt bên trong `sandbox_dir.resolve()` (hoặc trùng chính `sandbox_dir`), đồng thời áp trần cứng kích thước engine (`<= 512 KiB`).
     * Trong phạm vi `<sandbox>`, `vulnerable.py` vẫn có thể bị khai thác (ví dụ `../index.html` thoát khỏi `uploads/` sang `<sandbox>/webroot/index.html`, hoặc `shell.py` rơi vào `uploads/`), trong khi mọi nỗ lực thoát khỏi `<sandbox>` (như `../../../../app/core/backend/app/main.py` hoặc đường dẫn tuyệt đối) đều bị outer jail chặn vật lý trước khi chạm đĩa.
   * `ensure_upload_sandbox(sandbox_dir)` khởi tạo `(webroot_dir, uploads_dir)` và seed `webroot/index.html` khi chưa tồn tại; `reset_upload_sandbox(sandbox_dir)` dọn toàn bộ file bên trong `sandbox_dir` rồi seed lại `webroot/index.html`. Tất cả được export qua barrel [`app.services`](../../core/backend/app/services/__init__.py) và truyền xuống handler qua `LabContext.upload_sandbox_dir`.

3. **Gắn vòng đời dọn sandbox vào Reset DB và `verify_lab`:**
   * `POST /api/system/reset-db` ([`system.py`](../../core/backend/app/api/system.py)) gọi `reset_upload_sandbox(ctx.settings.upload_sandbox_dir)` sau khi replay `seed.sql`.
   * `POST /api/labs/{id}/verify?reset_db=true` ([`labs.py`](../../core/backend/app/api/labs.py)) gọi `reset_upload_sandbox` cùng với `reset_database` trong `reset_fn` trước **mỗi** test case, ngăn file upload rò rỉ giữa các test.

4. **Hợp đồng truyền tải JSON:**
   * Giữ nguyên `POST /api/labs/{id}/{mode}/{action}` với payload JSON `{ product_id, filename, content_type, content_b64 }`.
   * Frontend cung cấp `<input type="file">` dùng `FileReader` mã hóa file thật sang Base64 kết hợp ô sửa `filename` / `content_type` / `content_b64` để thực hành tamper, trong khi `samplePayloads` và `verifyTests` chạy hoàn toàn đồng nhất trên cùng schema JSON.

## Consequences

### Positive
* Không thể ghi đè file mã nguồn host trong `./labs` hay `./core/backend/app` ngay cả khi `vulnerable.py` nối thẳng tên file client vào đường dẫn.
* Minh họa đầy đủ cả ba lớp rủi ro File Upload (MIME spoofing `shell.py`, Active SVG XSS `banner.svg`, và traversal ghi đè `../index.html` trong `webroot/`) mà không gây nguy hiểm cho môi trường chạy.
* `Test My Fix` và nút `Reset DB` luôn đảm bảo cả PostgreSQL lẫn thư mục upload trở về trạng thái sạch.

### Negative / Trade-offs
* Payload được mã hóa Base64 làm tăng kích thước truyền tải khoảng 33%, nên giới hạn bài lab đặt ở `256 KiB` (trần engine `512 KiB`) — đủ cho minh họa ảnh và payload học tập, không dành cho upload file lớn.
* Các test dùng `Settings` tùy biến hoặc kiểm thử `vulnerable.py` cần chỉ định `upload_sandbox_dir` tạm để tránh ghi chung vào thư mục temp mặc định.

## Verification

* Pytest cho `Settings.upload_sandbox_dir`: giá trị rỗng rơi về thư mục temp mặc định; từ chối đường dẫn nằm trong hoặc chứa `labs_dir` / repo root.
* Pytest cho `upload_sandbox.py`: `write_within_sandbox_jail` cho phép ghi vào `webroot/uploads/` và `webroot/index.html` nhưng ném `ValueError` với `../../../../app/...`, đường dẫn tuyệt đối, symlink thoát jail, và payload vượt `512 KiB`.
* Pytest cho `POST /api/system/reset-db` và `POST /api/labs/07-file-upload/verify?reset_db=true`: xác nhận file đã upload bị xóa sạch sau reset và giữa các test.
* `uv run python scripts/gates.py --gate backend` và `--gate docs` pass toàn bộ.
