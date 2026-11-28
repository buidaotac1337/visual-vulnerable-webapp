# 0012. Design token theo cấu trúc Atlassian, dark mode và font tự host

## Status

Accepted

* **Date:** 2026-11-28
* **Deciders:** Maintainers / Agents

## Context

Design system cũ (`docs/design-system.md`, khung ở [ADR-0002](0002-frontend-typescript-and-design-system.md)) chọn màu theo **sắc độ** (`danger-50…950`, `slate-*`) chứ không theo **mục đích**. Audit ngày 2026-11-28 ghi nhận:

* 518 class `slate-*` dùng đủ 11 sắc độ, không phân biệt chữ, nền hay viền;
* 144 tổ hợp class của năm vai trò ngữ nghĩa, 70 biến thể độ mờ;
* khoảng 20 bảng `Record<TraceStatus, string>` tự map màu, rải trong 9 file;
* 34 cỡ chữ arbitrary và 35 chỗ gắn `fontFamily` inline;
* font tải từ Google Fonts CDN, không chạy được offline, và lộ request ra ngoài với một app vốn được clone về chạy local.

Atlassian Design System (`@atlaskit/tokens` 20.15.0) có mô hình token theo mục đích: `color.{text,background,border,icon}.{role}.{emphasis}`, elevation `surface.*`, theme light/dark chuyển bằng `data-color-mode`. Tuy nhiên:

* **License:** Atlassian Design System License chỉ cho phép dùng trong add-on tích hợp với sản phẩm Atlassian, và cấm sửa đổi hay phân phối lại. Package npm mang Apache-2.0.
* **Font:** Atlassian Sans/Mono là font độc quyền, chỉ có trên CDN của Atlassian.
* **Package:** không có bản tích hợp Tailwind; nặng khoảng 20 MB; đòi React làm peer dependency; API đổi liên tục.

## Decision Drivers

* Một nguồn duy nhất (SSOT) cho màu, font, cỡ chữ, bo góc và đổ bóng; chọn token theo mục đích.
* Dark mode toàn app, trong khi Inspector vẫn luôn là bề mặt IDE tối.
* Chạy hoàn toàn offline, không phụ thuộc CDN hay license không phù hợp.

## Decision

1. **Không cài `@atlaskit/*`.** VVWA tự viết token trong namespace `--vv-*`, theo cấu trúc tên của Atlassian và dùng giá trị hex của bảng màu Atlassian 20.15.0. Không dùng tên, logo, icon hay font của Atlassian, và không bắt chước trade dress của Jira. Doc ghi nguồn tham khảo.
2. **SSOT nằm tại `core/frontend/src/styles/tokens/`:**

   | File | Nội dung |
   | :--- | :--- |
   | `palette.css` | Bảng màu gốc `--vv-palette-*` và giá trị phức hợp `--vv-raw-*`. Đây là nơi **duy nhất** được chứa literal màu |
   | `theme-light.css` / `theme-dark.css` | Khoảng 120 token semantic `--vv-*`, cùng tập tên ở hai file |
   | `foundations.css` | Font family; glow và flash suy ra từ token màu, khai báo lại trên mỗi phạm vi `[data-color-mode]` |
   | `tailwind-theme.css` | Ánh xạ sang utility Tailwind |
   | `fonts.css` | Font tự host |

3. **Chọn màu theo mục đích bằng namespace riêng của Tailwind v4.** `--text-color-*`, `--background-color-*`, `--border-color-*`, `--ring-color-*`, `--outline-color-*`, `--divide-color-*` sinh ra `text-danger`, `bg-danger-bold`, `border-danger`… Khối `@theme inline` làm utility xuất ra `var(--vv-*)`, nên đổi theme lúc runtime không cần build lại.
4. **Theme đổi qua `data-color-mode`** trên `<html>`. Script inline trong `index.html` đặt attribute trước khi vẽ trang. `useColorMode` lưu lựa chọn vào `localStorage` key `vvwa.colorMode` (`light` / `dark` / `auto`). Inspector (cùng code-focus banner) và `PipelinePopover` gắn `data-color-mode="dark"` cố định cho subtree của chúng. Shiki giữ theme `github-dark-default`, ghi rõ là ngoại lệ.
5. **Ánh xạ vai trò VVWA → Atlassian:** `danger` → `danger`, `safe` → `success`, `warning` → `warning`, `info` → `information`, `brand` → `brand` (Blue700). Giá trị dữ liệu trong API và trace **giữ nguyên**, ví dụ `TraceStatus` vẫn là `'safe'`. `lib/tones.ts` là nguồn duy nhất map status, outcome và mode sang tone, rồi sang bộ class literal.
6. **Font:** giữ Be Vietnam Pro (UI) và JetBrains Mono (code), cả hai license OFL, tự host qua `@fontsource` 5.3.0. Dùng file theo weight có `unicode-range`, nên trình duyệt chỉ tải subset cần thiết. Bỏ Google Fonts.
7. **Type scale** dùng kích thước của Atlassian. Line-height của body tăng 2px để dấu tiếng Việt không bị chạm dòng trên. Thêm token mở rộng `text-micro` (11px) cho nhãn và badge dày đặc (FlowPipeline, badge tiến độ, chip mô tả), thay cho các `text-[11px]`. Viền mềm của card tô màu brand dùng token mở rộng `border-brand-subtle`, vì Atlassian không có `border.brand.subtle`; giá trị lấy bằng `border.information.subtle`. Bo góc dùng `rounded-{xsmall…xxlarge}`, đổ bóng dùng `shadow-{raised,overlay,overflow}`.
8. **Migrate theo 5 giai đoạn.**
   1. Nền tảng: token, font, hook dark mode. Giai đoạn này giữ `legacy.css` để app chưa đổi giao diện.
   2. Primitive và khung workspace.
   3. Pipeline và Inspector.
   4. Labs, cùng nút Sáng/Tối/Theo hệ thống (`ColorModeSwitch`, xoay vòng trong một nút icon để không chiếm thêm chỗ trên toolbar). Đổi giá trị mặc định từ `light` sang `auto` ở cả `DEFAULT_COLOR_MODE` lẫn script pre-paint; thuộc tính tĩnh `data-color-mode="light"` của `<html>` chỉ là fallback khi không có JavaScript.
   5. Khóa lại: xóa `legacy.css`, ghi đè bảng màu mặc định của Tailwind, ESLint chặn palette thô và giá trị arbitrary, thêm gate `check_design_tokens`.

## Consequences

### Positive

* Màu được chọn theo mục đích. Đổi một token ở một chỗ là áp dụng cho mọi nơi, ở cả light lẫn dark.
* App chạy offline, không gửi request ra ngoài; font và token nằm trong bundle.
* Các cặp `text.*` trên `surface` đạt tương phản WCAG AA ở cả hai theme, theo giá trị gốc của Atlassian.

### Negative / Trade-offs

* Màu hiển thị thay đổi so với hiện tại. Ví dụ, màu `success` của Atlassian ngả xanh lá-vàng (Lime) thay vì emerald.
* Trong giai đoạn 1–4, token cũ (`legacy.css`) và token mới cùng tồn tại. Giai đoạn 5 xóa token cũ.
* Giá trị màu được chép tay từ Atlassian 20.15.0. Khi Atlassian đổi bảng màu, VVWA không tự cập nhật theo; đây là lựa chọn có chủ đích, để không phụ thuộc vào package.
* Mỗi lần thêm dependency font, người clone phải chạy `docker compose up -d --build frontend`.

## Verification

* `src/__tests__/designTokens.test.ts` kiểm tra:
  * light và dark có cùng tập token;
  * theme chỉ tham chiếu `palette.css`;
  * mọi utility và token suy ra đều trỏ tới token đã khai báo;
  * mọi class trong `lib/tones.ts` đều có utility tương ứng;
  * `index.html` không có URL ngoài, và dùng đúng key cùng giá trị mặc định của `useColorMode`.
* `src/__tests__/useColorMode.test.ts`: logic resolve, lưu vào `localStorage`, theo dõi khi hệ thống đổi theme.
* ESLint `no-restricted-syntax` (`core/frontend/eslint.config.js`) chặn palette mặc định có sắc độ, thang cũ `danger/safe/warning/info/brand-50…950` và `*-soft`, `white`/`black`, giá trị arbitrary cho màu, cỡ chữ, line-height và spacing, và `style={{ fontFamily }}`. `src/__tests__/sinkLintGuard.test.ts` kiểm tra từng loại.
* Gate `design-tokens` (`scripts/quality/check_design_tokens.py`, chạy trong gate `frontend`, test ở `scripts/tests/test_design_tokens_gate.py`) chặn mã màu ngoài `palette.css`, token lệch giữa light và dark, `var(--vv-*)` chưa khai báo và URL ngoài trong `index.html` / CSS.
* Theme Tailwind ghi đè `--color-*: initial`, nên class palette thô không sinh ra CSS.
