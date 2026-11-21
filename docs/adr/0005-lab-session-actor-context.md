# 0005. Ngữ cảnh Phiên đăng nhập (Session Actor) cho Handler Bài Lab

## Status

Accepted — đã triển khai (`app/services/session_actor.py`, `useLabActor`, `ActorSwitcher`)

* **Date:** 2026-11-21
* **Deciders:** Maintainers / Agents

## Context

Handler của bài lab hiện có chữ ký `async def action(payload, db)` ([lab_loader.py](../../core/backend/app/services/lab_loader.py)). Engine không có khái niệm "ai đang đăng nhập", và trong `core/backend/app` không có auth hay session nào.

Các bài lab Giai đoạn 2–3 trong [roadmap](../04-lab-authoring-and-roadmap.md) đều cần danh tính đó:

* **Lab 03 IDOR:** bản an toàn phải so sánh `order.user_id == current_user.id`.
* **Lab 04 Business Logic:** cần biết ai đặt hàng và trừ số dư của ai.
* **Lab 05 Mass Assignment:** cần biết hồ sơ của ai bị sửa, và quyền mới (`role`) phải có hiệu lực ngay ở request sau.
* **Lab 07 Race Condition:** cần biết ai đang áp mã giảm giá.

Nếu để lab tự đọc `user_id` từ `payload` thì chính cách làm đó đã là lỗi "tin dữ liệu client", và bản `secure.py` không có cách nào an toàn thật. Bài học muốn tách bạch hai kênh: **payload** (sinh viên tấn công) và **phiên đăng nhập** (hệ thống tin cậy). Engine phải cấp kênh thứ hai.

## Decision Drivers

* **Sư phạm:** `secure.py` phải làm được phân quyền đúng nghĩa, và trace phải cho thấy danh tính đến từ phiên chứ không từ payload.
* **Không phá vỡ Lab 01:** handler `(payload, db)` hiện có giữ nguyên.
* **Gọn cho sinh viên yếu code:** handler không cần danh tính thì không phải khai báo gì thêm.
* **Không thêm dependency** và không thêm endpoint đăng nhập cho tới khi có bài lab về chính tầng xác thực.

## Decision

1. **Kênh truyền: header `X-VVWA-Actor: <username>`** trên `POST /api/labs/{lab_id}/{mode}/{action}`.
   * Header này mô phỏng cookie phiên đã xác thực. Theo quy ước của bài lab, đây là kênh tin cậy và **không phải bề mặt tấn công** của các Lab 03–07. Body JSON (`payload`) vẫn là kênh do kẻ tấn công kiểm soát.
   * Không có header thì engine coi là **ẩn danh** (`ctx.actor is None`).
2. **Engine phân giải actor** trong một service mới thuộc `app.services`:
   * Kiểm tra định dạng `\A[a-z0-9_]{1,32}\Z`, sau đó tra bằng câu lệnh tham số hóa `SELECT id, username, role FROM users WHERE username = $1` qua `lab_app_user`.
   * Username sai định dạng hoặc không tồn tại sẽ trả lỗi miền mới `InvalidActorError`, ánh xạ sang **HTTP 400**.
   * `role` được đọc **trực tiếp từ DB ở mỗi request**, nên quyền bị leo thang ở Lab 05 có hiệu lực ngay. Reset DB khôi phục persona gốc.
   * Engine chỉ truy vấn DB khi handler có khai báo `ctx`. Nếu handler không cần `ctx` thì header bị bỏ qua.
3. **Hợp đồng handler:**
   * `LabActor(id: int, username: str, role: str)` và `LabContext(actor: LabActor | None)` là các Pydantic model `frozen`, export qua barrel `app.schemas`.
   * Engine dùng `inspect.signature` để kiểm tra. Handler nào có tham số tên `ctx` thì được gọi với `ctx=LabContext(...)`:

     ```python
     async def view_order(payload: dict[str, Any], db: LabDatabaseProtocol, ctx: LabContext) -> dict[str, Any]: ...
     ```

   * Handler `(payload, db)` như Lab 01 được gọi y như cũ.
4. **Trace do engine sinh:**
   * Khi `ctx` được tiêm vào, engine chèn bước đầu tiên `tag: "engine-session"` (`layer: backend`, `status: info`). Tiêu đề là "Phiên đăng nhập (engine cấp)", chi tiết có dạng `alice (id=2, role=customer)` hoặc `Ẩn danh: không có phiên`.
   * Tiền tố tag `engine-` được **dành riêng cho engine**. Nếu handler của lab trả về tag bắt đầu bằng `engine-`, engine sẽ đổi kết quả thành phản hồi lỗi `runtime-error` như các lỗi lab khác.
5. **Mở rộng `meta.json`** (tất cả đều tùy chọn, nên Lab 01 hợp lệ nguyên trạng):
   * `actors: string[]`: các username có trong seed để hiện trên bộ chọn persona. Phần tử đầu là mặc định. Thiếu hoặc rỗng thì không hiện bộ chọn và không gửi header.
   * `samplePayloads[].actor?: string`: bấm chip payload sẽ đổi persona cùng lúc, ví dụ "Đang là alice, xem đơn của bob".
   * `verifyTests[].actor?: string`: verifier dựng `LabContext` bằng cùng service phân giải actor.
   * `LabMetadata` kiểm tra rằng mọi `actor` trong `samplePayloads` và `verifyTests` đều nằm trong `actors`.
6. **Frontend:**
   * Bộ chọn persona nằm ở `SandboxPane`, chỉ hiện khi `lab.actors` không rỗng. Trạng thái lưu trong workspace theo từng lab và về mặc định khi đổi lab.
   * `executeLabAction` nhận thêm `actor` tùy chọn và gắn header.
   * `LabViewProps` thêm `actor: string | null`, chỉ để hiển thị (ví dụ "Đang đăng nhập: alice"). LabView không tự đổi persona.

## Consequences

### Positive
* `secure.py` làm được kiểm tra chủ sở hữu và phân quyền đúng nghĩa. Ranh giới giữa payload và phiên hiện rõ trên trace nhờ bước `engine-session`.
* Lab 01 và mọi handler không cần danh tính giữ nguyên.
* Một cơ chế dùng chung cho Lab 03, 04, 05, 07, không lab nào phải tự chế cách đăng nhập.

### Negative / Trade-offs
* Ai có `curl` cũng giả được header. Điều này chấp nhận được vì VVWA là công cụ học chạy local một người dùng, và các bài lab trên không nhắm vào tầng phiên. **Bài lab về Broken Authentication hay Session sau này phải có ADR mới** (ví dụ token ký HMAC).
* Handler có `ctx` tốn thêm một truy vấn DB mỗi request. Không đáng kể ở quy mô local.
* Persona phải tồn tại trong `seed.sql`. Nếu sinh viên xóa user qua một bài lab thì request trả 400 cho tới khi bấm Reset DB.

## Verification

* Pytest cho service phân giải actor: thiếu header (ẩn danh), sai định dạng, không tồn tại (400), và `role` đọc trực tiếp sau khi bị `UPDATE`.
* Pytest cho `lab_loader`: handler có `ctx` nhận đúng actor và bước `engine-session`; handler `(payload, db)` không bị ảnh hưởng; tag `engine-*` do lab trả về bị từ chối.
* Pytest cho `LabMetadata`: `actor` không nằm trong `actors` thì bị đánh dấu không hợp lệ. Verifier chạy test có `actor`.
* Vitest: bộ chọn persona chỉ hiện khi có `actors`; chip payload có `actor` đổi được persona; request gửi đúng header `X-VVWA-Actor`.
* `uv run python scripts/gates.py --auto` pass các gate tương ứng.
