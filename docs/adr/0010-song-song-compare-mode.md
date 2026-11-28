# 0010. Chế độ Song song: chạy cùng payload trên Vulnerable và Secure

## Status

Accepted

* **Date:** 2026-11-28
* **Deciders:** Maintainers / Agents

## Context

Trước đây người học chỉ so sánh được hai bản cài đặt bằng cách gạt `Vulnerable ↔ Secure` rồi gửi lại request. Mỗi lần gạt, workspace xóa trace, nên không thể nhìn hai luồng thực thi cùng lúc. Bản thiết kế UI chốt ngày 2026-11-22 thêm nút thứ ba **Song song** vào `ModeSwitch`. Nút này chạy cùng một payload trên cả hai bản và đặt `vulnerable.py`, `secure.py` cùng trace cạnh nhau, căn theo từng bước.

Có ba ràng buộc:

* Hai bản dùng chung một database MiniShop. Với lab có ghi dữ liệu (04, 05, 07, 08), phía chạy sau sẽ thấy dữ liệu mà phía chạy trước vừa sửa, nên kết quả so sánh bị lệch.
* `LabView.tsx` render theo một `mode` duy nhất và tự dựng các bước trace frontend từ `mode` đó (ví dụ `POST /api/labs/<id>/<mode>/login`). Lab có cặp sink frontend còn chọn component render theo `mode`.
* Lab 08 bắn N request đồng thời trong một lần bấm. N−1 request là `silent`, chỉ request cuối mang trace.

## Decision Drivers

* Hai phía phải bắt đầu từ cùng trạng thái dữ liệu để so sánh công bằng.
* Không đổi hợp đồng `LabViewProps` và không phải sửa từng lab.
* Không đổi API backend hay cấu trúc `trace`.

## Decision

1. `WorkspaceMode = LabMode | 'compare'`. `ModeSwitch` có ba nút `Vulnerable · Secure · Song song`. Khi đang ở `compare`, `LabView` vẫn nhận `mode = 'vulnerable'`, nghĩa là sandbox luôn render phía Vulnerable.
2. Ở chế độ Song song, `useCompareRun` gom mọi lời gọi `onExecute` phát ra trong cùng một macrotask (một lần bấm) thành một **lượt**:
   * Lượt có ít nhất một lời gọi không `silent` chạy theo thứ tự: `POST /api/system/reset-db` → cả lượt chạy đồng thời trên `secure` → `reset-db` → cả lượt chạy đồng thời trên `vulnerable`. Mỗi caller nhận response phía Vulnerable, nên DB sau lượt chạy mang trạng thái của phía mà sandbox đang hiển thị.
   * Lượt chỉ gồm lời gọi `silent` (đọc dữ liệu hiển thị) chạy trên `vulnerable` và không reset.
   * Các lượt chạy tuần tự. Những lần đọc lại do `dbResetSeq` tăng (sau lần reset đầu tiên) phải chờ lượt hiện tại kết thúc.
3. Trace của mỗi phía dựng từ request mang trace cuối cùng của lượt. Phía Secure dùng lại `frontendStepsBefore`, nhưng đoạn `/api/labs/<id>/vulnerable/` được đổi thành `/api/labs/<id>/secure/`. Với lab có cặp sink frontend, phía Secure bỏ `frontendStepsAfter`, vì các bước render đó do sink của phía Vulnerable tạo ra. Inspector có ghi chú giải thích điểm này.
4. `alignCompareTraces` căn hai trace bằng longest common subsequence trên khóa `layer:tag`. Bước chỉ một phía có (ví dụ `validate-name` của Lab 06, `race-window` của Lab 08) nằm trên một hàng riêng, ô của phía kia để trống. Thanh phát trace điều khiển chỉ số hàng. `FlowPipeline` đi theo trace phía Vulnerable.
5. `ModeSwitch` vẽ một chấm outcome (`exploited` / `blocked` / `normal` / `error`) trên nút Vulnerable và Secure. Chấm này ghi kết quả gần nhất của từng mode theo từng lab, từ lượt chạy thường lẫn lượt Song song. Bố cục `split` đổi nhãn thành **Chia đôi** để không trùng tên với chế độ Song song.

## Consequences

### Positive

* Mọi lab, kể cả lab ghi dữ liệu và burst Lab 08, so sánh được hai phía từ cùng dữ liệu seed chỉ bằng một lần bấm, không phải sửa lab nào.
* Hợp đồng plugin, API backend và cấu trúc trace giữ nguyên.

### Negative / Trade-offs

* Mỗi lượt Song song xóa dữ liệu người học đã tạo trước đó (review, đơn hàng, file upload), vì nó reset DB hai lần. Ghi chú trong sandbox và tooltip của nút có nói rõ điều này.
* Một lượt tốn hai lần Reset DB, chậm hơn khoảng 1 giây so với chạy một phía.
* Việc gom lượt theo macrotask giả định lab bắn toàn bộ request đồng bộ trong một handler. Lab cần chờ giữa các request sẽ bị tách thành nhiều lượt.
* Với lab có lỗ hổng ở sink frontend (Lab 02), chế độ Song song chỉ so sánh phần backend. Khác biệt của sink vẫn xem ở tab Diff hoặc bằng cách gạt mode.

## Verification

* `src/__tests__/compareTrace.test.ts`: căn hàng, ánh xạ chỉ số, đổi endpoint.
* `src/__tests__/useCompareRun.test.tsx`: thứ tự reset → secure → reset → vulnerable, gom burst, lượt chỉ có `silent`, bỏ bước render của sink, lượt đã cũ (stale), lỗi khi reset.
* `src/__tests__/CompareMode.test.tsx`: luồng tích hợp trong `App` và chấm outcome trên `ModeSwitch`.
* Gate `frontend` (`uv run python scripts/gates.py --gate frontend`).
