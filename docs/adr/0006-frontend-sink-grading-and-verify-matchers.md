# 0006. Chấm Bản vá phía Frontend (Sink Files) & Toán tử So khớp cho Test My Fix

## Status

Accepted — đã triển khai (`expect_matcher.py`, `frontend_sinks.py`, `lib/expectMatcher.ts`, `lib/domProbe.ts`, `lib/frontendVerifier.ts`, `useLabVerify`). Lab 02 Stored XSS giờ có thể bắt đầu.

* **Date:** 2026-11-21
* **Deciders:** Maintainers / Agents

## Context

Hiện tại "Test My Fix" ([verifier.py](../../core/backend/app/services/verifier.py)) chỉ chạy `verifyTests` trên `labs/<id>/backend/vulnerable.py`. Diff, gói `.zip` và Code Inspector cũng chỉ có một cặp file backend `vulnerable.py`/`secure.py`.

Lab 02 Stored XSS dạy lỗ hổng ở **điểm render của React** (`dangerouslySetInnerHTML`), tức sink nằm ở frontend. Maintainer đã quyết định **chấm cả bản vá phía frontend** thay vì dời lỗ hổng sang backend. Vì vậy cần thêm:

1. Một cặp file frontend có lỗi và đã vá, tương tự backend, để sinh viên sửa, xem diff và tải về.
2. Một cơ chế chấm chạy được mã React của sinh viên **mà không bao giờ thực thi payload** trong trang thật.
3. Toán tử so khớp không cần bằng nhau tuyệt đối. Cùng một payload có thể được escape theo nhiều cách đúng (`&lt;` hay `&#60;`, thư viện khác nhau), nên so khớp chính xác từng chuỗi sẽ chấm sai.

Ngoài ra, quy tắc "không có `dangerouslySetInnerHTML` trong `core/`" ([ADR-0004](0004-frontend-workspace-architecture-and-lab-plugin-contract.md)) hiện chỉ là quy ước, chưa có rule lint nào ép. Lab 02 sẽ là lab đầu tiên dùng sink này một cách hợp lệ.

## Decision Drivers

* **An toàn khi chấm:** chấm một bản vá còn lỗi không được làm payload chạy trong trang VVWA.
* **Đối xứng với backend:** sinh viên sửa đúng một file `vulnerable.*`, có Diff, `@step` và snippet `.zip` như Lab 01.
* **Ranh giới được máy ép buộc:** sink nguy hiểm chỉ được phép ở đúng một loại file, và lint phải chặn ở mọi nơi khác.
* **Không thêm dependency.**

## Decision

1. **Cặp sink file frontend (tùy chọn theo từng lab):** `labs/<id>/frontend/vulnerable.tsx` và `labs/<id>/frontend/secure.tsx`.
   * Phải có đủ cả hai file hoặc không có file nào. Discovery cảnh báo nếu chỉ có một và bỏ qua phần frontend của lab.
   * Hai file export **các component cùng tên, cùng props** (ví dụ `ReviewContent`). `LabView.tsx` import cả hai và chọn theo `mode`. **`LabView.tsx` không được chứa sink.**
   * Sinh viên vá bằng cách sửa `frontend/vulnerable.tsx`. Cú pháp `// @snippet:start|end` và `// @step:<tag>` dùng được ngay vì `source_reader` đã nhận diện `//`.
2. **Source, Diff, Snippet:**
   * `LabSourceResponse` thêm `frontend_vulnerable`, `frontend_secure` (`ParsedSourceFile | None`) và `frontend_diff` (`str | None`). Trường `frontend` (`LabView.tsx`) giữ nguyên.
   * Tab **Frontend** hiển thị sink file đúng với `mode` khi lab có cặp này, nếu không thì hiển thị `LabView.tsx`. Tab **Diff** hiển thị cả diff backend và diff frontend.
   * `resolveStepTarget` với `layer: "frontend"` tìm tag trong sink file của `mode` trước, rồi mới tìm trong `LabView.tsx`.
   * Gói `.zip` thêm `vulnerable.tsx`, `secure.tsx` và `frontend.diff.patch`.
3. **`verifyTests` phân loại theo `layer`**, mặc định là `"backend"` nên Lab 01 hợp lệ nguyên trạng:
   * Backend: `{ name, action, input, expect, actor? }`, giữ như hiện tại cộng thêm `actor` từ [ADR-0005](0005-lab-session-actor-context.md).
   * Frontend: `{ name, layer: "frontend", component, props, expect }`. `component` là tên export trong `frontend/vulnerable.tsx`.
   * `POST /api/labs/{id}/verify` chỉ chạy test backend. Test frontend do trình duyệt chạy.
4. **Bộ chấm frontend (`core/frontend/src/lib/frontendVerifier.ts`):**
   * Nạp module `frontend/vulnerable.tsx` qua `import.meta.glob`. Nhờ HMR, module luôn là bản sinh viên vừa lưu.
   * Render `component` với `props` vào một container thuộc **document trơ** tạo bằng `document.implementation.createHTMLDocument('')`, dùng `createRoot` và `flushSync`. Document trơ không có browsing context nên không chạy script, không tải ảnh và không kích hoạt `onerror`/`onload`. **Container không bao giờ được gắn vào document thật.** Chấm xong thì unmount.
   * Sau đó một **DOM probe** quét cây vừa render và trả về observation `{ text, html, activeContent, findings }`. `activeContent` là `true` khi gặp bất kỳ dấu hiệu nào sau đây:
     * phần tử `script`, `iframe`, `object`, `embed`;
     * thuộc tính `on*` hoặc `srcdoc`;
     * thuộc tính URL (`href`, `src`, `action`, `formaction`, `xlink:href`) có scheme `javascript:`, sau khi đã trim, chuyển chữ thường và bỏ ký tự điều khiển.
   * `expect` được so với observation bằng cùng matcher như backend (mục 5). Nếu component ném lỗi khi render thì test **fail** kèm thông báo lỗi.
5. **Toán tử so khớp `expect`** (Python ở `verifier.py`, TypeScript ở frontend, cùng ngữ nghĩa):
   * Một object có **mọi key bắt đầu bằng `$`** được coi là object toán tử. Phase 2 có `$contains: string` (chuỗi thực tế chứa chuỗi này) và `$notContains: string`.
   * Toán tử không xác định thì test **fail** với lỗi rõ ràng, không bao giờ âm thầm pass.
   * Quy tắc hiện có vẫn giữ: so khớp subset đệ quy cho dict, list phải cùng độ dài, bool so nghiêm ngặt.
   * Ví dụ: `"expect": { "activeContent": false, "text": { "$contains": "<img src=x" } }` nghĩa là payload bị vô hiệu hóa nhưng nội dung đánh giá vẫn hiển thị dưới dạng chữ.
6. **Tổng hợp kết quả:**
   * `VerifyModal` gộp kết quả backend (từ API) và frontend (chạy cục bộ), mỗi dòng có badge `Backend`/`Frontend`. Lab chỉ **pass** khi mọi test ở cả hai lớp đều pass.
   * Nếu API verify lỗi, modal vẫn hiển thị kết quả frontend kèm lỗi backend.
   * Logic verify tách sang hook mới `useLabVerify` vì `useLabWorkspace.ts` đã 283 dòng, gần ngưỡng cảnh báo.
7. **Lint ép ranh giới sink** trong `core/frontend/eslint.config.js`, áp dụng cho `core/frontend/src` và `labs/*/frontend`:
   * `no-restricted-syntax` cấm thuộc tính JSX `dangerouslySetInnerHTML` và cả key `dangerouslySetInnerHTML` trong object props (ví dụ `createElement('p', { dangerouslySetInnerHTML })`), cấm **gán** `innerHTML`/`outerHTML`, và cấm gọi `insertAdjacentHTML`. Fixture trong test phải tắt rule tường minh bằng `eslint-disable-next-line` kèm lý do.
   * Có một override duy nhất tắt rule cho `labs/*/frontend/vulnerable.tsx`. Việc *đọc* `innerHTML` trong DOM probe vẫn được phép.
   * Quy tắc Security isolation trong [AGENTS.md](../../AGENTS.md) được cập nhật để nêu đích danh hai file `labs/<id>/backend/vulnerable.py` và `labs/<id>/frontend/vulnerable.tsx`.
8. **Ngoài phạm vi:**
   * CSP chỉ được nêu như lớp phòng thủ bổ sung trong README của lab và không được chấm.
   * DOMPurify chưa được thêm. Lab nào cần cho phép HTML định dạng thì phải có ADR thêm dependency.
   * Test nhiều bước hoặc đồng thời (Lab 07 Race Condition) cần ADR riêng.

## Consequences

### Positive
* Lab 02 dạy XSS đúng tại điểm render của React, và sinh viên sửa đúng một file `frontend/vulnerable.tsx` với trải nghiệm Diff, `@step` và `.zip` giống backend.
* Chấm bản vá chưa sửa xong vẫn an toàn vì payload chỉ được render trong document trơ.
* Ranh giới sink được lint ép buộc thay vì chỉ là quy ước. Vô tình dùng `dangerouslySetInnerHTML` trong `core/` hay `LabView.tsx` sẽ làm Frontend Gate fail.
* `$contains` và `$notContains` cũng giúp backend chấm các đầu ra có nhiều cách đúng, ví dụ escape hoặc thông báo lỗi.

### Negative / Trade-offs
* Matcher tồn tại ở hai nơi (Python và TypeScript). Để giảm rủi ro lệch nhau, hai bộ unit test dùng **cùng danh sách ca kiểm thử** (mirrored), và mọi toán tử mới phải thêm đồng thời ở cả hai.
* DOM probe là heuristic: nó kiểm các payload mà lab khai báo trong `verifyTests` chứ không chứng minh được là hết mọi biến thể XSS (CSS injection, mutation XSS, `data:` URL…). Mỗi lab phải chọn bộ payload đại diện.
* Trình duyệt chạy test frontend, nên kết quả này không có trong response của `POST /verify`. Công cụ tự động gọi API trực tiếp chỉ thấy phần backend.

* Lỗi render của React 19 không được ném ra từ `flushSync` mà đi qua `onUncaughtError`; runner bắt lỗi qua callback này để test fail kèm thông báo thay vì làm hỏng trang.
* Module `frontend/vulnerable.tsx` được nạp qua `import.meta.glob`; khi sinh viên sửa file trong lúc dev, React Refresh dự kiến render code mới nhất cho cùng component. Điều này **chưa được kiểm chứng trên app thật** vì chưa có lab nào có cặp sink: phải kiểm tra khi làm Lab 02.
* Jsdom không bao giờ chạy `onerror`, kể cả trên document thật, nên test trong Vitest chỉ kiểm cơ chế render/probe. Tính an toàn của document trơ đã được kiểm tra riêng trên Chromium (document thật chạy `onerror` và `iframe srcdoc`; document trơ thì không).

## Verification

* Vitest cho DOM probe: phát hiện `<script>`, `onerror`, `javascript:` (kể cả chữ hoa, khoảng trắng, ký tự điều khiển), và nội dung chữ an toàn cho `activeContent: false`.
* Vitest cho runner: render `<img src=x onerror="window.__vvwaPwned = 1">` qua sink có lỗi, khẳng định `window.__vvwaPwned` vẫn là `undefined` và container không nằm trong `document`.
* Vitest và pytest dùng cùng bộ ca kiểm thử matcher (`$contains`, `$notContains`, toán tử lạ, bool nghiêm ngặt).
* Pytest: schema `verifyTests` phân loại theo `layer`, verifier bỏ qua test frontend, `source_reader` trả cặp frontend và `frontend_diff`, `.zip` có đủ file frontend, và discovery cảnh báo khi cặp sink bị thiếu một file.
* Frontend Gate (ESLint) fail nếu `dangerouslySetInnerHTML` xuất hiện ngoài `labs/*/frontend/vulnerable.tsx`.
