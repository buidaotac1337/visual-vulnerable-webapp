# 0008. Giao dịch Cơ sở dữ liệu (`db.transaction()`) & Kiểm thử Đồng thời / Nhiều bước trong `verifyTests`

## Status

Accepted — triển khai cùng Lab 08 (`08-race-condition`), mở rộng `LabDatabaseProtocol` (`app/db/client.py`), `BackendVerifyTest` (`app/schemas/lab.py`), và bộ chấm `verifier.py`.

* **Date:** 2026-11-22
* **Deciders:** Maintainers / Agents

## Context

Trước khi xây dựng Lab 08 (**Race Condition — Áp mã giảm giá MiniShop**), hạ tầng thực thi và kiểm thử tự động của VVWA có hai giới hạn kiến trúc:

1. **Mỗi lệnh SQL mượn-trả một connection riêng từ `asyncpg.Pool`:** Trong [`AsyncpgLabDatabase`](../../core/backend/app/db/client.py), mỗi lời gọi `fetch_one`, `fetch_all`, `fetch_val`, `execute` đều thực hiện `async with self._pool.acquire() as conn:`. Trong PostgreSQL, nếu không có một transaction xuyên suốt nhiều câu lệnh, khóa mức hàng như `SELECT ... FOR UPDATE` sẽ được giải phóng ngay khi câu lệnh kết thúc và connection quay về pool. Do đó handler `secure.py` không thể giữ row lock qua bước kiểm tra và bước cập nhật.
2. **`BackendVerifyTest` chỉ chạy tuần tự 1 request và chấm 1 response:** [`verifier.py`](../../core/backend/app/services/verifier.py) trước đây chỉ gọi `execute_lab_action(...)` đúng 1 lần rồi so `expect` với `response.data`. Điều này không đủ để tái hiện lỗi **TOCTOU (Time-of-Check to Time-of-Use)** đòi hỏi nhiều coroutine đập vào cùng dữ liệu đồng thời, cũng như không đọc lại được trạng thái DB cuối cùng sau khi cơn bão request kết thúc.

## Decision Drivers

* **Khả năng giữ khóa bi quan (`SELECT ... FOR UPDATE`):** Handler cần một API tường minh, gọn nhẹ để gom nhiều truy vấn vào cùng một PostgreSQL transaction trên duy nhất một connection.
* **Tương thích ngược tuyệt đối với Labs 01–07:** Các lab cũ chỉ gọi `db.fetch_one`/`fetch_val`/`execute` không cần thay đổi bất kỳ dòng code nào.
* **Bộ chấm tổng quát, không hardcode domain của Lab 08:** `verifier.py` chỉ điều phối số lượng tác vụ đồng thời, đếm `meta.outcome` phổ quát, tùy chọn gọi một action hậu kiểm (`checkAction`), và giao cho [`expect_matcher.py`](../../core/backend/app/services/expect_matcher.py) đánh giá — tái sử dụng được cho mọi lab concurrency hoặc multi-step sau này.
* **Độ phức tạp thấp và an toàn dưới tải:** Giữ McCabe complexity `<= 10`, không rò rỉ task chạy dở sang bước `reset_fn()` của test kế tiếp.

## Decision

1. **Thêm `db.transaction()` vào [`LabDatabaseProtocol`](../../core/backend/app/db/client.py):**
   * Bổ sung phương thức `transaction(self) -> AbstractAsyncContextManager[LabDatabaseProtocol]` vào `LabDatabaseProtocol`.
   * Triển khai lớp nội bộ `_TransactionLabDatabase(conn)` bọc một `asyncpg.Connection` duy nhất cho `fetch_one`, `fetch_all`, `fetch_val`, `execute`, và hỗ trợ transaction lồng nhau (`tx.transaction()`) qua savepoint của `asyncpg` (`conn.transaction()`) mà không mượn thêm connection từ pool.
   * Trên `AsyncpgLabDatabase`, `@asynccontextmanager async def transaction()` mượn đúng một connection từ `self._pool`, mở `async with conn.transaction():`, và yield `_TransactionLabDatabase(conn)`. Các phương thức ngoài block `transaction()` giữ nguyên hành vi mượn-trả theo từng lệnh như cũ.

2. **Mở rộng [`BackendVerifyTest`](../../core/backend/app/schemas/lab.py) (và kiểu TypeScript tương ứng trong [`api.ts`](../../core/frontend/src/types/api.ts)):**
   * `concurrency: int = Field(default=1, ge=1, le=20)` — số request gọi `action` đồng thời qua `asyncio.gather`.
   * `check_action: str | None = Field(default=None, alias="checkAction")` — tên action đọc trạng thái hậu kiểm sau khi `action` hoàn tất (chạy cùng `actor`).
   * `check_input: dict[str, Any] = Field(default_factory=dict, alias="checkInput")` — payload truyền cho `checkAction`.

3. **Ngữ nghĩa chấm trong [`verifier.py`](../../core/backend/app/services/verifier.py):**
   * **`concurrency == 1` và `checkAction is None`:** Giữ nguyên 100% hành vi cũ — so `expect` trực tiếp với `action_resp.data`.
   * **`concurrency == 1` và `checkAction` có giá trị:** Chạy `action`, kiểm tra không lỗi (`ok` và `outcome != "error"`), sau đó chạy `checkAction` với `checkInput` (cùng `actor`), rồi so `expect` với `{**action_resp.data, "check": check_resp.data}`.
   * **`concurrency > 1`:** Khởi chạy `concurrency` lời gọi `execute_lab_action(...)` song song bằng `asyncio.gather(...)` trên cùng adapter `db` (đợi toàn bộ task kết thúc trước khi đánh giá hoặc sang test tiếp theo). Tổng hợp bộ đếm phổ quát:
     ```json
     {
       "total": 5,
       "outcomes": { "normal": 1, "exploited": 0, "blocked": 4, "error": 0 },
       "responses": [ ... ],
       "check": { ... }
     }
     ```
     Test tự động **fail** nếu bất kỳ request nào gặp ngoại lệ/lỗi runtime (`not ok` hoặc `outcome == "error"`) hoặc nếu `checkAction` thất bại; ngược lại `expect` được so khớp với cấu trúc trên bằng `matches_expected`.

## Consequences

### Positive
* Các bài lab xử lý cạnh tranh dữ liệu có thể dùng `async with db.transaction() as tx:` kết hợp `SELECT ... FOR UPDATE` chuẩn PostgreSQL một cách tự nhiên, nhất quán với `LabDatabaseProtocol`.
* Labs 01–07 hoạt động nguyên vẹn không cần sửa đổi.
* Các bài lab nhiều bước hoặc đồng thời trong tương lai (ví dụ trừ tồn kho song song, idempotency key, chuyển khoản hai bước) có thể khai báo kiểm thử ngay trong `meta.json` mà không cần sửa code `core/`.

### Negative / Trade-offs
* Mọi test double triển khai `LabDatabaseProtocol` trong `core/backend/tests/` phải bổ sung phương thức `transaction()` để đạt `mypy --strict`.
* `Settings.db_pool_max_size` mặc định là `10`, trong khi `concurrency` cho phép tối đa `20`. Khi `concurrency > db_pool_max_size`, các coroutine vượt quá kích thước pool sẽ chờ slot từ `asyncpg.Pool.acquire()`; vì vậy các kịch bản race condition nên dùng `concurrency <= 10` (Lab 08 dùng `5` và `7`) để mọi kết nối khóa hàng xảy ra thực sự song song trong PostgreSQL.

## Verification

* Pytest trong [`test_concurrent_verify.py`](../../core/backend/tests/test_concurrent_verify.py): kiểm tra `AsyncpgLabDatabase.transaction()` giữ cùng một connection và savepoint lồng nhau, kiểm tra đủ 3 nhánh của `verifier.py` (`concurrency=1`, `concurrency=1 + checkAction`, `concurrency > 1 + checkAction`) và xử lý lỗi runtime/`checkAction`.
* Pytest trong [`test_lab_08_race_condition.py`](../../core/backend/tests/test_lab_08_race_condition.py): chứng minh `vulnerable.py` fail các ca đồng thời (`3/5 PASS`) và `secure.py` pass toàn bộ (`5/5 PASS`).
* `uv run python scripts/gates.py --gate backend` (kèm `mypy --strict` trên `core/backend/app`, `core/backend/tests`, và tất cả 8 lab) và `--gate docs` đều pass.
