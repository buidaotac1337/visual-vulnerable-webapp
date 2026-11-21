# API Reference

Hợp đồng HTTP giữa workspace React và FastAPI engine. Mọi endpoint nằm dưới tiền tố `/api`; OpenAPI tự sinh có tại `http://localhost:8000/docs`.

Schema SSOT: Pydantic trong [`core/backend/app/schemas/`](../core/backend/app/schemas/__init__.py), bản TypeScript tương ứng trong [`core/frontend/src/types/api.ts`](../core/frontend/src/types/api.ts).

## 1. Danh sách endpoint

| Method | Endpoint | Chức năng |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Trạng thái và phiên bản backend |
| `GET` | `/api/labs` | Danh sách lab phát hiện từ `labs/*/meta.json` |
| `GET` | `/api/labs/{lab_id}/source` | Mã nguồn đã parse, bản đồ `@step`, diff |
| `GET` | `/api/labs/{lab_id}/download` | Gói snippet `<lab_id>-fastapi.zip` |
| `POST` | `/api/labs/{lab_id}/verify` | Chạy `verifyTests` tầng backend trên `vulnerable.py` |
| `POST` | `/api/labs/{lab_id}/{mode}/{action}` | Thực thi một action của lab |
| `POST` | `/api/system/reset-db` | Khôi phục dữ liệu MiniShop từ `seed.sql` và dọn sandbox upload |

Ràng buộc tham số đường dẫn:

| Tham số | Quy tắc |
| :--- | :--- |
| `lab_id` | `^[a-z0-9][a-z0-9-]*$`, phải là thư mục có thật trong `labs/` |
| `mode` | `vulnerable` hoặc `secure` |
| `action` | `^[a-z][a-z0-9_]*$` (hàm async công khai, snake_case) |

## 2. Hệ thống

### `GET /api/health`

```json
{ "status": "ok", "service": "Visual Vulnerable Web App API", "version": "0.1.0", "environment": "local" }
```

### `POST /api/system/reset-db`

Chạy lại `seed.sql` bằng `lab_admin_user` trong một transaction và dọn sạch thư mục sandbox upload (`reset_upload_sandbox`, [ADR-0007](adr/0007-file-upload-sandbox-isolation.md)) rồi seed lại `webroot/index.html`.

```json
{ "ok": true, "message": "MiniShop database has been reset to its clean seed state.", "duration_ms": 42.17 }
```

## 3. Lab

### `GET /api/labs`

Trả về `{ "labs": LabMetadata[] }`, sắp xếp theo tên thư mục. Lab có `meta.json` không hợp lệ bị bỏ qua và ghi warning vào log backend. Cấu trúc `LabMetadata` xem [Tạo bài lab](lab-authoring.md#3-metajson).

### `GET /api/labs/{lab_id}/source`

Đọc trực tiếp file trên đĩa ở mỗi request.

| Trường | Kiểu | Nguồn |
| :--- | :--- | :--- |
| `lab_id` | `string` | |
| `vulnerable` | `ParsedSourceFile` | `backend/vulnerable.py` |
| `secure` | `ParsedSourceFile` | `backend/secure.py` |
| `frontend` | `ParsedSourceFile \| null` | `frontend/LabView.tsx` |
| `diff` | `string` | Unified diff `vulnerable.py` ↔ `secure.py` (theo phần snippet) |
| `frontend_vulnerable` | `ParsedSourceFile \| null` | `frontend/vulnerable.tsx`, chỉ khi có đủ cặp sink |
| `frontend_secure` | `ParsedSourceFile \| null` | `frontend/secure.tsx`, chỉ khi có đủ cặp sink |
| `frontend_diff` | `string \| null` | Unified diff của cặp sink |

`ParsedSourceFile`:

| Trường | Kiểu | Ý nghĩa |
| :--- | :--- | :--- |
| `code` | `string` | Phần mã giữa các khối `@snippet`, đã bỏ dòng marker |
| `steps` | `Record<string, number>` | Tag `@step` → số dòng (1-based) trong `code` |
| `line_count` | `number` | Số dòng của `code` |

Cú pháp marker: xem [Tạo bài lab](lab-authoring.md#5-snippet-và-step).

### `GET /api/labs/{lab_id}/download`

Trả về `application/zip` với `Content-Disposition: attachment; filename="<lab_id>-fastapi.zip"`. Gói chứa nội dung file đầy đủ (không cắt theo snippet):

| File | Điều kiện |
| :--- | :--- |
| `vulnerable.py`, `secure.py`, `diff.patch` | Luôn có |
| `README.md` | README của lab, hoặc README mặc định nếu lab không có |
| `vulnerable.tsx`, `secure.tsx`, `frontend.diff.patch` | Khi lab có cặp sink frontend |

### `POST /api/labs/{lab_id}/{mode}/{action}`

Thực thi `async def <action>(...)` trong `labs/<lab_id>/backend/<mode>.py`.

| Phần | Nội dung |
| :--- | :--- |
| Body | JSON object bất kỳ, chuyển nguyên vẹn cho handler dưới tên `payload`. Đây là kênh **không tin cậy** do người dùng kiểm soát. Mặc định `{}`. |
| Header `X-VVWA-Actor` | Tùy chọn. Username của persona đang đăng nhập, mô phỏng cookie phiên đã xác thực (kênh **tin cậy**). Xem [mục 5](#5-phiên-đăng-nhập-x-vvwa-actor). |

Response: `LabExecutionResponse` ([mục 4](#4-lab-execution-response--trace)).

### `POST /api/labs/{lab_id}/verify`

| Query | Mặc định | Ý nghĩa |
| :--- | :--- | :--- |
| `reset_db` | `false` | `true` để chạy lại `seed.sql` và dọn sandbox upload trước **mỗi** test |

Workspace luôn gọi với `reset_db=true`. Endpoint chỉ chạy test có `layer` là `backend` (mặc định); test `frontend` do trình duyệt chạy và không có trong response.

```json
{
  "ok": true,
  "lab_id": "01-sql-injection",
  "passed": false,
  "total": 6,
  "passed_count": 5,
  "results": [
    {
      "name": "Chặn payload SQLi vượt đăng nhập qua Username",
      "action": "login",
      "layer": "backend",
      "passed": false,
      "expected": { "logged_in": false },
      "actual": { "logged_in": true, "user": { "username": "admin" } },
      "error": null
    }
  ]
}
```

`passed` chỉ là `true` khi có ít nhất một test và mọi test đều pass. Lỗi của lab (action không tồn tại, persona không tồn tại, handler ném exception, `expect` dùng toán tử sai) được ghi vào `error` của test tương ứng thay vì làm hỏng cả request.

Với test đồng thời hoặc nhiều bước ([ADR-0008](adr/0008-db-transactions-and-concurrent-verify-tests.md)):
* Khi `concurrency == 1` và có `checkAction`, engine chạy `action` rồi chạy tiếp `checkAction` (với `checkInput`, cùng `actor`) và đối chiếu `expect` với `{ ...action_data, "check": check_data }`.
* Khi `concurrency > 1` (`1..20`), engine chạy song song `concurrency` lời gọi `action` qua `asyncio.gather`, đếm `outcomes` (`normal`, `exploited`, `blocked`, `error`), chạy thêm `checkAction` nếu có, và đối chiếu `expect` với `{ "total": N, "outcomes": ..., "responses": [...], "check": ... }`; test tự fail nếu bất kỳ request nào lỗi runtime hoặc `checkAction` thất bại.

## 4. Lab execution response & trace

```json
{
  "ok": true,
  "data": { "logged_in": true, "user": { "id": 1, "username": "admin", "role": "admin" } },
  "meta": { "lab_id": "01-sql-injection", "mode": "vulnerable", "outcome": "exploited" },
  "trace": [
    {
      "step": 1,
      "layer": "backend",
      "tag": "build-login-query",
      "status": "danger",
      "title": "Nối chuỗi trực tiếp bằng f-string",
      "detail": "SQL thực tế: SELECT ... WHERE username = '' OR 1=1--' AND password_hash = 'any'"
    },
    {
      "step": 2,
      "layer": "database",
      "tag": "exec-login-query",
      "status": "danger",
      "title": "PostgreSQL thực thi câu lệnh SQL thô",
      "detail": "Bypass thành công! Trả về user 'admin' (role=admin)."
    }
  ]
}
```

| Trường | Kiểu | Ý nghĩa |
| :--- | :--- | :--- |
| `ok` | `boolean` | `false` khi handler lỗi hoặc trả sai cấu trúc |
| `data` | `object` | Kết quả nghiệp vụ hiển thị trong sandbox và được so với `expect` |
| `meta.lab_id`, `meta.mode` | `string` | Do engine điền |
| `meta.outcome` | `exploited \| blocked \| normal \| error` | Phân loại kết quả, mặc định `normal` |
| `trace` | `TraceStep[]` | Các bước để phát sáng pipeline và dòng code |

`TraceStep`:

| Trường | Kiểu | Ý nghĩa |
| :--- | :--- | :--- |
| `step` | `number` | Số thứ tự 1-based, **engine tự đánh lại** bất kể giá trị lab trả về |
| `layer` | `frontend \| backend \| database` | Node pipeline tương ứng |
| `tag` | `string` | Khớp với marker `@step:<tag>` trong mã nguồn để xác định dòng phát sáng |
| `status` | `info \| warning \| danger \| safe` | Màu phát sáng |
| `title` | `string` | Tiêu đề ngắn trong Inline Callout |
| `detail` | `string` | Giá trị thực tế: câu SQL, biến, giải thích |

| `status` | Ý nghĩa |
| :--- | :--- |
| `info` | Bước xử lý bình thường |
| `warning` | Dữ liệu chưa được kiểm tra, tiềm ẩn rủi ro |
| `danger` | Lỗ hổng vừa được kích hoạt hoặc khai thác thành công |
| `safe` | Safety pattern đã chặn payload |

### Tag dành riêng cho engine

| Tag | Khi nào xuất hiện |
| :--- | :--- |
| `engine-session` | Bước đầu tiên khi handler khai báo `ctx`; cho biết request chạy dưới danh tính nào |
| `runtime-error` | Bước duy nhất khi handler ném exception hoặc trả sai cấu trúc (`ok: false`, `outcome: error`) |

Tiền tố `engine-` chỉ engine được dùng. Lab trả về tag bắt đầu bằng `engine-` sẽ nhận response `runtime-error`.

## 5. Phiên đăng nhập (`X-VVWA-Actor`)

| Giá trị header | Kết quả |
| :--- | :--- |
| Không gửi hoặc rỗng | Ẩn danh: `ctx.actor is None` |
| Sai định dạng (không khớp `^[a-z0-9_]{1,32}$`) | HTTP `400`, kiểm tra trước khi chạm DB, áp dụng cho mọi action |
| Đúng định dạng, handler **không** khai báo `ctx` | Bỏ qua, không tra DB |
| Đúng định dạng, handler khai báo `ctx`, user tồn tại | `ctx.actor = LabActor(id, username, role)`; `role` đọc trực tiếp từ DB ở mỗi request |
| Đúng định dạng, handler khai báo `ctx`, user không tồn tại | HTTP `400 Unknown actor '…'` |

Header này là kênh tin cậy theo quy ước của sản phẩm và không phải bề mặt tấn công của các lab hiện có. Chi tiết: [ADR-0005](adr/0005-lab-session-actor-context.md).

## 6. Toán tử so khớp `expect`

Dùng chung cho test backend (Python) và frontend (TypeScript), cùng ngữ nghĩa.

| Giá trị mong đợi | Quy tắc |
| :--- | :--- |
| Object thường | So subset đệ quy: mọi key mong đợi phải có và khớp; key thừa ở thực tế được bỏ qua |
| Object mà **mọi key bắt đầu bằng `$`** | Object toán tử |
| List | Phải cùng độ dài và khớp từng phần tử |
| Boolean | So nghiêm ngặt: `true` không bằng `1` |
| Giá trị khác | So bằng |

| Toán tử | Toán hạng | Pass khi |
| :--- | :--- | :--- |
| `$contains` | `string` | Giá trị thực tế là chuỗi và chứa toán hạng |
| `$notContains` | `string` | Giá trị thực tế là chuỗi và không chứa toán hạng |

Toán tử không xác định, toán hạng không phải chuỗi, hoặc object trộn key `$` với key thường đều làm test **fail kèm lỗi**. Matcher đánh giá toàn bộ cây (không dừng sớm) nên lỗi cú pháp `expect` luôn được báo.

## 7. Mã lỗi

Lỗi ở tầng engine trả về `{ "detail": "<thông báo>" }`:

| HTTP | Lỗi miền | Nguyên nhân |
| :--- | :--- | :--- |
| `400` | `InvalidLabIdError` | `lab_id` hoặc `action` sai định dạng, hoặc đường dẫn thoát khỏi `labs/` |
| `400` | `InvalidActorError` | Header `X-VVWA-Actor` sai định dạng hoặc persona không tồn tại |
| `404` | `LabNotFoundError` | Lab, `meta.json` hoặc file handler không tồn tại / không hợp lệ |
| `404` | `ActionNotFoundError` | Không có hàm async tên `action` trong module |
| `422` | — | `mode` không phải `vulnerable`/`secure`, hoặc body không phải JSON object |
| `503` | `DatabaseUnavailableError` | Không kết nối được PostgreSQL hoặc Reset DB thất bại |

Lỗi xảy ra **bên trong** mã lab không dùng mã HTTP lỗi: response vẫn là `200` với `ok: false` và bước `runtime-error`.
