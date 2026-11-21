# 0004. Kiến trúc Frontend Workspace, Lab Plugin Contract & Shiki Syntax Highlighting

## Status

Accepted

* **Date:** 2026-11-21
* **Deciders:** Maintainers / Agents

## Context

Sau khi hoàn thiện Backend Core Engine (lab discovery, dynamic hot-reload loader, `# @snippet`/`# @step` source reader, verifier và 1-click Reset DB), dự án bước sang Giai đoạn 1 xây dựng **Frontend Workspace** theo triết lý **Dual-Surface Pedagogy** ([docs/design-system.md](../design-system.md)).

Quá trình đánh giá mở rộng trước triển khai chỉ ra 4 quyết định kiến trúc cốt lõi cần chốt một lần trước khi viết các bài lab MiniShop:

1. **Cơ chế nạp động bài Lab Frontend:** Cần một hợp đồng props rõ ràng (`LabViewProps`) để mỗi bài lab dưới `labs/<id>/frontend/LabView.tsx` chỉ cần plug-in một React component độc lập, tự động phát hiện qua Vite `import.meta.glob`, giữ nguyên input khi sinh viên gạt `Vulnerable ↔ Secure`, và có fallback mượt mà khi `labs/` chưa có bài lab hoặc lab mới chỉ có backend.
2. **Thư viện Syntax Highlighting vs UI Primitives:** Cần tô màu cú pháp chuẩn VS Code cho `python`/`tsx`/`sql` kèm hiệu ứng sáng đèn theo từng dòng `@step` và `InlineCallout`, nhưng vẫn phải tuân thủ quy tắc an toàn tuyệt đối trong `core/` (không dùng `dangerouslySetInnerHTML`) và giữ bộ ESLint strict (`explicit-function-return-type`, `jsdoc/require-jsdoc`, `no-restricted-imports`, `max-lines <= 350`, `complexity <= 10`) không bị phình to hay phá vỡ.
3. **Ranh giới Barrel cho Stateful Hooks:** Logic điều phối workspace (`useLabWorkspace`) và máy trạng thái phát lại trace (`useTracePlayback`) cần một module riêng `core/frontend/src/hooks/` tuân thủ kỷ luật barrel import tương tự `components`, `lib`, `types`.
4. **Tính nhất quán đường dẫn `labs/` trong Quality Gates:** Khi chạy Frontend Gate qua Docker fallback trong `scripts/quality/runners.py`, container phải thấy thư mục `labs/` ở đúng vị trí tương đối `/app/labs` giống như `core/frontend/Dockerfile` và host.

## Decision Drivers

* **An toàn Sandbox (`core/` vs `labs/`):** Tuyệt đối không sử dụng `dangerouslySetInnerHTML` trong `core/frontend/`.
* **Tối ưu tốc độ & độ gọn:** Giữ số lượng dependency tối thiểu, pin exact version (`save-exact=true`), tránh boilerplate khó bảo trì.
* **Sẵn sàng mở rộng 8 bài lab MiniShop:** Hỗ trợ đồng bộ bước trace ở cả Frontend (`layer: "frontend"`) và Backend/Database, auto-refresh source sau khi sửa file trên đĩa và đồng bộ `dbResetSeq` khi bấm Reset DB.
* **Khớp 100% Quality Gates:** Mọi file TypeScript trong `core/frontend/src/` và `labs/*/frontend/` đều được kiểm tra bởi `tsc --noEmit`, ESLint và Prettier.

## Decision

1. **Syntax Highlighting bằng `shiki` (fine-grained `shiki/core`) + UI Controls thuần Tailwind v4:**
   * Cài exact-pinned `shiki` và chỉ nạp 3 grammar (`python`, `tsx`, `sql`) cùng theme `github-dark-default` qua `createHighlighterCore` + `createJavaScriptRegexEngine`.
   * Render code bằng `codeToTokens` thành các React `<span>` (có fallback đồng bộ tức thì cho lần vẽ đầu và Vitest `jsdom`), **không** dùng `codeToHtml` / `dangerouslySetInnerHTML`.
   * Xây dựng các UI control Phase 1 (`ModeSwitch`, `TopControlBar`, `Tabs`, native `<dialog>` `VerifyModal`, CSS Grid responsive split-screen) trực tiếp bằng semantic HTML + ARIA + Tailwind v4 thay vì cài `shadcn/ui` / `@radix-ui/*`.
2. **Chuẩn hóa Lab Plugin Contract (`LabViewProps`) & Vite `import.meta.glob`:**
   * `core/frontend/src/lib/labRegistry.ts` phát hiện `../../../../labs/*/frontend/LabView.tsx` qua `import.meta.glob` và lazy-load theo `lab.id`.
   * `<LabView>` luôn được mount theo `key={lab.id}` (không dùng `key={mode}`) để giữ nguyên dữ liệu sinh viên nhập khi gạt `Vulnerable ↔ Secure`; trạng thái `payload` lưu ở `useLabWorkspace` để `PayloadChipBar` điền 1-click và kích hoạt `inputFlashSeq`.
   * Cung cấp 2 chế độ fallback trong `EmptyLabFallback`: `no-labs` (khi `GET /api/labs` trả mảng rỗng) và `generic-runner` (khi lab chưa có `LabView.tsx`).
3. **Bổ sung `core/frontend/src/hooks` vào hệ thống Barrel:**
   * Thêm `core/frontend/src/hooks` vào `[tool.vvwa.quality].barrel_frontend_dirs` trong `pyproject.toml`, chặn deep-import `@/hooks/*` trong `core/frontend/eslint.config.js` và cập nhật `AGENTS.md`.
4. **Thống nhất hình học thư mục `labs/` trong Frontend Gate & Hot Reload Backend:**
   * Cập nhật Docker fallback trong `scripts/quality/runners.py` mount `/app/core/frontend` và `/app/labs` với `-w /app/core/frontend`.
   * Mở rộng `core/frontend/tsconfig.app.json` (`include` và `paths` fallback `@types/*` → `node_modules/*`), thêm `resolveLabDepsPlugin` trong `vite.config.ts`/`vitest.config.ts`, thêm `@source '../../../../labs';` trong `tokens.css` cho Tailwind CSS v4, và mở scripts `lint` / `format:check` sang `labs/*/frontend`.
   * Gỡ `--reload-dir /app/labs` khỏi `core/backend/Dockerfile` vì `lab_loader.py` đã nạp mới trực tiếp từ đĩa ở mỗi request, tránh Uvicorn khởi động lại worker khi sinh viên lưu bài lab.

## Consequences

### Positive
* Không có `dangerouslySetInnerHTML` ở bất kỳ file nào trong `core/frontend/`, giữ vững ranh giới an toàn của VVWA.
* Thêm bài lab mới chỉ cần tạo `labs/<id>/frontend/LabView.tsx` xuất `export function LabView(props: LabViewProps)` — không cần sửa code trong `core/frontend/`.
* Frontend Gate (kể cả chế độ Docker fallback) kiểm tra nhất quán cả `core/frontend/src` lẫn `labs/*/frontend`.
* Sửa file trong `labs/` không làm Uvicorn khởi động lại và rớt kết nối PostgreSQL pool.

### Negative / Trade-offs
* `shiki` tăng nhẹ kích thước cài đặt `node_modules` (nhưng bundle thực tế nhỏ nhờ import fine-grained `shiki/core` và chỉ nạp 3 ngôn ngữ).
* Các UI control tự viết cần duy trì tiêu chuẩn accessibility (ARIA roles, keyboard focus cho `<dialog>`, `role="tablist"`/`radiogroup`) thủ công trong code và kiểm thử bằng Testing Library.

## Verification

* `uv run python scripts/gates.py --gate docs` xác nhận ADR-0004 hợp lệ và đã đăng ký trong `docs/adr/README.md`.
* `uv run python scripts/gates.py --gate frontend` chạy đầy đủ `check_file_limits`, `check_barrels` (bao gồm `src/hooks`), `eslint`, `prettier --check`, `tsc --noEmit`, `vitest run` và `vite build` với cả `/app/core/frontend` lẫn `/app/labs` được mount đồng bộ.
* `uv run python scripts/gates.py --gate all` pass toàn bộ 5 gate (`hygiene`, `docs`, `backend`, `frontend`, `infra`).
