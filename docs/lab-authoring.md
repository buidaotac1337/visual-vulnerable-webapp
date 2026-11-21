# Tạo bài lab

Hướng dẫn thêm một bài lab mới vào VVWA: cấu trúc thư mục, schema `meta.json`, hợp đồng handler backend, giao diện `LabView`, cặp sink frontend và bộ `verifyTests`. Engine tự phát hiện lab mới, không cần sửa code trong `core/`.

Lab tham khảo: [`labs/01-sql-injection`](../labs/01-sql-injection/README.md) (lỗ hổng ở backend), [`labs/02-stored-xss`](../labs/02-stored-xss/README.md) (cặp sink frontend, handler dùng `ctx`).

## 1. Cấu trúc thư mục

```text
labs/<id>-<slug>/
├── meta.json             # Bắt buộc: metadata, payload mẫu, verifyTests
├── README.md             # Khuyến nghị: lý thuyết lỗ hổng và safety pattern (được đóng gói khi tải snippet)
├── backend/
│   ├── vulnerable.py     # Bắt buộc: bản có lỗ hổng, người dùng sửa file này
│   └── secure.py         # Bắt buộc: bản áp dụng safety pattern
└── frontend/
    ├── LabView.tsx       # Tùy chọn: giao diện MiniShop riêng, KHÔNG chứa sink
    ├── vulnerable.tsx    # Tùy chọn, đi theo cặp: sink frontend có lỗ hổng
    └── secure.tsx        # Tùy chọn, đi theo cặp: sink frontend an toàn
```

* Tên thư mục là `lab_id`: chữ thường, số và dấu `-`, bắt đầu bằng chữ hoặc số. Thư mục bắt đầu bằng `.` hoặc `_` bị bỏ qua.
* Lab không có `frontend/LabView.tsx` vẫn chạy được bằng **generic runner** (nhập tên action và payload JSON).
* `LabView.tsx` có thể import component phụ trong cùng thư mục (ví dụ `ResultCards.tsx` của Lab 01).

## 2. Quy trình

1. Tạo nhánh `lab/<id>-<slug>`.
2. Tạo thư mục và `meta.json` với `id` trùng tên thư mục.
3. Viết `backend/secure.py` trước, sau đó `backend/vulnerable.py` khác đúng ở điểm lỗi, để tab **Diff** chỉ nêu đúng phần cần sửa.
4. Đặt marker `@snippet` và `@step`; trace trả về dùng cùng tag.
5. (Tùy chọn) Viết `frontend/LabView.tsx`, và cặp sink nếu lỗ hổng nằm ở điểm render.
6. Viết `verifyTests`: ít nhất một test cho luồng hợp lệ và một test cho mỗi payload tấn công.
7. Kiểm tra: `vulnerable.py` **fail** các test chặn payload, còn khi chép nội dung `secure.py` sang thì **pass** toàn bộ.
8. Viết test pytest/vitest cho lab trong `core/backend/tests` hoặc `core/frontend/src/__tests__`, chạy `uv run python scripts/gates.py --auto`.

## 3. `meta.json`

```json
{
  "id": "01-sql-injection",
  "title": "SQL Injection — Đăng nhập & Tìm kiếm MiniShop",
  "category": "Injection",
  "difficulty": "Cơ bản",
  "summary": "Khai thác lỗi nối chuỗi f-string vào câu lệnh SQL để vượt qua bước đăng nhập Admin.",
  "safetyPattern": "Sử dụng Parameterized Query ($1, $2 với asyncpg) để tách cấu trúc SQL khỏi dữ liệu.",
  "samplePayloads": [
    {
      "label": "Bypass Admin Login",
      "description": "Biến điều kiện WHERE thành luôn đúng và comment phần kiểm tra mật khẩu.",
      "data": { "tab": "login", "username": "' OR 1=1--", "password": "any" }
    }
  ],
  "verifyTests": [
    {
      "name": "Tài khoản hợp lệ (alice) vẫn đăng nhập được",
      "action": "login",
      "input": { "username": "alice", "password": "password123" },
      "expect": { "logged_in": true, "user": { "username": "alice", "role": "customer" } }
    },
    {
      "name": "Chặn payload SQLi vượt đăng nhập qua Username",
      "action": "login",
      "input": { "username": "' OR 1=1--", "password": "wrong" },
      "expect": { "logged_in": false }
    }
  ]
}
```

| Trường | Kiểu | Bắt buộc | Ý nghĩa |
| :--- | :--- | :---: | :--- |
| `id` | `string` | ✓ | Trùng tên thư mục |
| `title` | `string` | ✓ | Tên hiển thị trên thanh công cụ |
| `category` | `string` | ✓ | Nhóm lỗ hổng (Injection, XSS, Access Control…) |
| `difficulty` | `string` | ✓ | Mức độ |
| `summary` | `string` | ✓ | Tóm tắt kịch bản |
| `safetyPattern` | `string` | ✓ | Tóm tắt cách phòng chống, hiển thị dưới Code Inspector |
| `samplePayloads` | `SamplePayload[]` | | Chip payload 1-click; phần tử đầu là giá trị mặc định của form |
| `verifyTests` | `VerifyTest[]` | | Bộ test của **Test My Fix** ([mục 7](#7-verifytests)) |
| `actors` | `string[]` | | Persona hiện trên bộ chọn; phần tử đầu là mặc định. Bỏ trống thì không hiện bộ chọn và không gửi header |

`SamplePayload`:

| Trường | Kiểu | Ý nghĩa |
| :--- | :--- | :--- |
| `label` | `string` | Chữ trên chip |
| `description` | `string` | Mô tả ngắn (tooltip) |
| `data` | `object` | Dữ liệu điền vào form (`payload` của `LabView`) |
| `actor` | `string` | Tùy chọn. Đổi persona khi bấm chip; phải nằm trong `actors` |

Quy tắc validate: username trong `actors` phải khớp `^[a-z0-9_]{1,32}$`, không trùng lặp, và tồn tại trong `seed.sql`. Mọi `actor` được tham chiếu trong `samplePayloads` và `verifyTests` phải có trong `actors`. Lab vi phạm schema bị bỏ qua khi discovery, kèm warning trong log backend.

## 4. Handler backend

Mỗi action là một hàm `async` công khai, tên snake_case, trong `backend/vulnerable.py` và `backend/secure.py` (hai file cùng tên hàm).

```python
from typing import Any

from app.db import LabDatabaseProtocol
from app.schemas import LabContext


async def login(payload: dict[str, Any], db: LabDatabaseProtocol) -> dict[str, Any]:
    """Không cần danh tính: chỉ nhận payload và db."""
    ...


async def view_order(
    payload: dict[str, Any],
    db: LabDatabaseProtocol,
    ctx: LabContext,
) -> dict[str, Any]:
    """Cần danh tính: khai báo thêm tham số ctx."""
    order_id = int(payload.get("order_id", 0))  # Do người dùng kiểm soát
    current = ctx.actor                         # Do engine cấp từ phiên, có thể là None
    ...
```

### Tham số

| Tham số | Kiểu | Ý nghĩa |
| :--- | :--- | :--- |
| `payload` | `dict[str, Any]` | Body JSON của request, kênh không tin cậy |
| `db` | `LabDatabaseProtocol` | Kết nối quyền hạn chế `lab_app_user` |
| `ctx` | `LabContext` | Tùy chọn. Chỉ được truyền khi hàm khai báo tham số tên `ctx` nhận được keyword (không phải positional-only, `*ctx` hay `**ctx`) |

`LabContext.actor` là `LabActor(id: int, username: str, role: str)` hoặc `None` (ẩn danh). Bản `secure.py` **không bao giờ** suy ra danh tính từ `payload`.

`LabDatabaseProtocol`:

| Phương thức | Trả về |
| :--- | :--- |
| `await db.fetch_one(sql, *args)` | `dict` của dòng đầu tiên hoặc `None` |
| `await db.fetch_all(sql, *args)` | `list[dict]` |
| `await db.fetch_val(sql, *args)` | Giá trị cột đầu của dòng đầu, hoặc `None` |
| `await db.execute(sql, *args)` | Status tag của PostgreSQL, ví dụ `UPDATE 1` |

Tham số bind dùng `$1, $2, …`. `Decimal` được chuyển thành `float`, ngày giờ thành chuỗi ISO. `search_path` đã đặt sẵn `minishop`.

### Giá trị trả về

```python
return {
    "data": {"logged_in": True, "user": row},
    "meta": {"outcome": "exploited"},
    "trace": [
        {
            "layer": "backend",
            "tag": "build-login-query",
            "status": "danger",
            "title": "Nối chuỗi trực tiếp bằng f-string",
            "detail": f"SQL thực tế: {sql}",
        },
    ],
}
```

| Khóa | Yêu cầu |
| :--- | :--- |
| `data` | `dict`; được hiển thị trong sandbox và so với `expect` |
| `meta.outcome` | `exploited`, `blocked`, `normal` hoặc `error`; mặc định `normal` |
| `trace` | Danh sách `dict` có `layer`, `tag`, `status`, `title`, `detail`. Không cần `step` (engine tự đánh số). Không dùng tag bắt đầu bằng `engine-` |

Exception chưa bắt hoặc giá trị trả về sai cấu trúc đều được engine chuyển thành response `runtime-error`. Lỗi SQL mà lab muốn minh họa (ví dụ error-based SQLi) nên bắt `asyncpg.PostgresError` và trả trace có giải thích. Chi tiết response: [API Reference](api-reference.md#4-lab-execution-response--trace).

## 5. `@snippet` và `@step`

Marker là comment đặt trong file thật, để Code Inspector không phụ thuộc vào số dòng cứng. Python dùng `#`, TypeScript/TSX dùng `//`. Mỗi marker phải nằm trên một dòng riêng.

```python
# @snippet:start
async def login(payload: dict[str, Any], db: LabDatabaseProtocol) -> dict[str, Any]:
    username = str(payload.get("username", ""))

    # @step:build-login-query
    sql = f"SELECT ... WHERE username = '{username}'"

    # @step:exec-login-query
    row = await db.fetch_one(sql)
    ...
# @snippet:end
```

| Marker | Quy tắc |
| :--- | :--- |
| `@snippet:start` / `@snippet:end` | Chỉ phần giữa hai marker được hiển thị và dùng cho tab Diff. Một file có thể có nhiều khối; chúng được nối với nhau bằng một dòng trống. Không có cặp hoàn chỉnh thì hiển thị toàn bộ file (đã bỏ marker) |
| `@step:<tag>` | Tag gồm chữ, số, `_`, `-`. Gắn với **dòng không rỗng kế tiếp**. Dòng marker bị ẩn khỏi UI |

Tag trong `trace` phải trùng với tag `@step` để dòng code phát sáng đúng chỗ. Bước tầng `frontend` được tìm trước trong sink file của mode hiện tại, sau đó trong `LabView.tsx`; các bước khác tìm trong `backend/<mode>.py`.

## 6. Frontend

### `LabView.tsx`

File phải export một component tên `LabView` nhận `LabViewProps` (import từ `@/types`):

```tsx
import type { JSX } from 'react';
import type { LabViewProps } from '@/types';

export function LabView({ mode, payload, onPayloadChange, onExecute }: LabViewProps): JSX.Element {
  ...
}
```

| Prop | Kiểu | Ý nghĩa |
| :--- | :--- | :--- |
| `lab` | `LabMetadata` | Metadata của lab |
| `mode` | `'vulnerable' \| 'secure'` | Mode đang chọn |
| `actor` | `string \| null` | Persona đang đăng nhập, chỉ để hiển thị |
| `payload` / `onPayloadChange` | `LabPayload` / `(next) => void` | Trạng thái form do workspace giữ; được bảo toàn khi đổi mode |
| `inputFlashSeq` | `number` | Tăng mỗi khi chip payload được bấm, dùng để nháy ô nhập |
| `dbResetSeq` | `number` | Tăng sau mỗi lần Reset DB hoặc Test My Fix, dùng để tải lại dữ liệu |
| `isExecuting` | `boolean` | Có request đang chạy |
| `lastResponse` | `LabExecutionResponse \| null` | Response gần nhất |
| `onExecute` | `(action, overridePayload?, options?) => Promise<LabExecutionResponse \| null>` | Gửi action tới backend |

`options` của `onExecute`:

| Tùy chọn | Ý nghĩa |
| :--- | :--- |
| `frontendStepsBefore` | Bước trace tầng `frontend` chèn trước trace backend (ví dụ "Gửi form đăng nhập") |
| `frontendStepsAfter` | Hàm nhận response, trả về bước trace chèn sau trace backend |
| `silent` | Không phát trace, không ghi đè `lastResponse`; dùng cho các lần đọc dữ liệu ban đầu |

`LabView` được mount theo `lab.id`, không theo `mode`, nên state cục bộ không mất khi đổi mode. Import qua barrel (`@/types`, `@/lib`…); package npm được resolve từ `core/frontend/node_modules`.

### Cặp sink frontend

Dùng khi lỗ hổng nằm ở điểm render của React (ví dụ Stored XSS).

* Có đủ **cả hai** `frontend/vulnerable.tsx` và `frontend/secure.tsx`, hoặc không có file nào. Chỉ có một file thì engine ghi warning và bỏ qua phần frontend.
* Hai file export **cùng tên component, cùng props** (ví dụ `ReviewContent`). `LabView.tsx` import cả hai và chọn theo `mode`.
* Người dùng vá bằng cách sửa `frontend/vulnerable.tsx`. File này có trong tab Frontend, tab Diff và gói snippet.

## 7. `verifyTests`

Mỗi test thuộc một tầng, xác định bởi `layer` (mặc định `backend`).

### Test backend

```json
{
  "name": "Chặn payload UNION SELECT trích xuất bảng users",
  "action": "search_products",
  "input": { "keyword": "' AND 1=0 UNION SELECT ... FROM users--" },
  "expect": { "count": 0 },
  "actor": "alice"
}
```

| Trường | Ý nghĩa |
| :--- | :--- |
| `action` | Hàm trong `backend/vulnerable.py` |
| `input` | `payload` truyền vào handler |
| `expect` | So với `response.data` |
| `actor` | Tùy chọn. Persona truyền vào `ctx`; phải nằm trong `actors` |

Workspace reset DB trước mỗi test backend, nên các test độc lập với nhau. Test fail khi handler báo lỗi (`ok: false`).

### Test frontend

```json
{
  "name": "Payload onerror chỉ hiển thị dạng chữ, không thành thẻ HTML",
  "layer": "frontend",
  "component": "ReviewContent",
  "props": { "content": "<img src=x onerror=alert(1)>" },
  "expect": { "activeContent": false, "text": { "$contains": "<img src=x" } }
}
```

| Trường | Ý nghĩa |
| :--- | :--- |
| `component` | Tên export PascalCase trong `frontend/vulnerable.tsx` |
| `props` | Props truyền vào component |
| `expect` | So với observation của DOM probe |

Trình duyệt render component vào một document trơ (không chạy script, không tải tài nguyên), chờ DOM ổn định rồi quét:

| Observation | Ý nghĩa |
| :--- | :--- |
| `activeContent` | `true` nếu có `script`/`iframe`/`frame`/`object`/`embed`, thuộc tính `on*` hoặc `srcdoc`, hay URL `javascript:` |
| `findings` | Danh sách dấu hiệu tìm thấy, ví dụ `<img onerror>` |
| `text` | `textContent` của cây đã render |
| `html` | `innerHTML` của cây đã render |

Sink phải ghi DOM đồng bộ trong render hoặc trong effect; effect bất đồng bộ kéo dài (`setTimeout`, `fetch`) có thể bị quét trước khi ghi.

### Quy tắc so khớp

Subset đệ quy cho object, list cùng độ dài, boolean so nghiêm ngặt, toán tử `$contains` / `$notContains`. Bảng đầy đủ: [API Reference](api-reference.md#6-toán-tử-so-khớp-expect).

Lab chỉ **pass** khi mọi test của cả hai tầng đều pass.

## 8. Ranh giới bảo mật

* Lỗ hổng có chủ đích **chỉ** được đặt trong `backend/vulnerable.py` và `frontend/vulnerable.tsx`.
* `LabView.tsx`, `secure.*` và toàn bộ `core/` không chứa sink. ESLint chặn `dangerouslySetInnerHTML`, gán `innerHTML`/`outerHTML` và `insertAdjacentHTML` ở mọi file frontend trừ `labs/*/frontend/vulnerable.tsx`.
* Ruff chỉ miễn các cảnh báo bảo mật có chủ đích (`S608`, `S105`, `S106`, `S324`, `S501`) cho `labs/*/backend/vulnerable.py`.
* Mọi file lab tuân thủ cùng chuẩn chất lượng với `core/`: tối đa 350 dòng, type hint, docstring/JSDoc.

## 9. Checklist trước khi mở PR

- [ ] `id` trong `meta.json` trùng tên thư mục; lab hiện trong danh sách.
- [ ] `vulnerable.py` và `secure.py` có cùng tập action; Diff chỉ khác ở điểm lỗi.
- [ ] Mọi tag trong `trace` có marker `@step` tương ứng.
- [ ] Payload mẫu cho cả luồng hợp lệ và luồng tấn công.
- [ ] `vulnerable.*` fail các test chặn payload; `secure.*` pass toàn bộ.
- [ ] `README.md` của lab mô tả lỗ hổng, payload và safety pattern.
- [ ] `uv run python scripts/gates.py --auto` pass.
