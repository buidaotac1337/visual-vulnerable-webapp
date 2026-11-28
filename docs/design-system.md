# Design System

Quy chuẩn giao diện của VVWA: token màu, theme sáng/tối, typography, component đặc thù và khoảng cách. Hệ token mô phỏng **cấu trúc** của Atlassian Design System (chọn màu theo mục đích, light/dark) và dùng giá trị màu của bảng màu Atlassian `@atlaskit/tokens` 20.15.0, nhưng là token riêng của VVWA (`--vv-*`), không phụ thuộc package hay font của Atlassian ([ADR-0012](adr/0012-atlassian-style-design-tokens.md)).

## 1. Nguyên tắc

* **Chọn màu theo mục đích, không theo sắc độ.** Viết `text-subtle`, `bg-danger-bold`, `border-input`; không viết `text-slate-600` hay `bg-red-600`. Bảng màu mặc định của Tailwind đã bị xóa khỏi theme nên class palette thô không sinh ra CSS, và ESLint cùng gate `design-tokens` chặn từ trước (mục 3).
* **Một nguồn duy nhất.** Mọi giá trị màu nằm trong `core/frontend/src/styles/tokens/`. Màu theo trạng thái trace, outcome hay mode lấy từ `lib/tones.ts`.
* **Hai bề mặt.** MiniShop Sandbox theo theme người dùng chọn (Sáng / Tối / Theo hệ thống). Code & Trace Inspector luôn là bề mặt IDE tối, để cú pháp và dòng phát sáng nổi bật.

| Bề mặt | Vị trí | Theme |
| :--- | :--- | :--- |
| **MiniShop Sandbox** | Cột trái | Theo `data-color-mode` của `<html>` |
| **Code & Trace Inspector**, code-focus banner, `PipelinePopover` | Cột phải, popover gói tin | Luôn `data-color-mode="dark"` |

## 2. Stack UI

| Mục đích | Thư viện |
| :--- | :--- |
| Styling | Tailwind CSS v4, token bằng CSS variables |
| Control (Tabs, Switch, Dialog, Select) | HTML ngữ nghĩa + ARIA tự viết (`role="tablist"`, `radiogroup`, `<dialog>`), không dùng shadcn/ui hay Radix ([ADR-0004](adr/0004-frontend-workspace-architecture-and-lab-plugin-contract.md)) |
| Icon | `lucide-react` (ví dụ `ShieldAlert`, `ShieldCheck`, `Bug`, `Play`, `Pause`, `RotateCcw`, `Download`) |
| Tô màu cú pháp | Shiki (`shiki/core`), theme `github-dark-default`, ngôn ngữ `python`, `tsx`, `sql`; render thành `<span>` React |

## 3. Màu sắc

### Cấu trúc file token

| File | Nội dung |
| :--- | :--- |
| `tokens/palette.css` | Bảng màu gốc `--vv-palette-*` (giá trị Atlassian) và giá trị phức hợp `--vv-raw-*` (bóng đổ có alpha). **Nơi duy nhất** được chứa mã màu |
| `tokens/theme-light.css` / `theme-dark.css` | Khoảng 120 token semantic `--vv-*`, cùng tập tên ở hai file, chỉ tham chiếu palette |
| `tokens/foundations.css` | Font family; glow dòng code và flash input suy ra từ token màu, khai báo lại trên mỗi phạm vi `[data-color-mode]` |
| `tokens/tailwind-theme.css` | Xóa palette mặc định (`--color-*: initial`), ánh xạ token sang utility, type scale, bo góc |
| `tokens/fonts.css` | Font tự host |

### Token màu

| Nhóm | Utility | Token |
| :--- | :--- | :--- |
| Chữ | `text-default`, `text-subtle`, `text-subtlest`, `text-disabled`, `text-inverse`, `text-brand`, `text-link`, `text-{role}`, `text-{role}-bolder`, `text-warning-inverse` | `--vv-text*`, `--vv-link` |
| Icon | `text-icon`, `text-icon-subtle`, `text-icon-{role}`, `text-icon-accent-{blue,purple,yellow}` | `--vv-icon*` |
| Bề mặt | `bg-surface`, `bg-surface-sunken` (nền trang, vùng lõm), `bg-surface-raised` (card), `bg-surface-overlay` | `--vv-surface*` |
| Nền | `bg-neutral` (chip), `bg-neutral-bold`, `bg-input`, `bg-selected`, `bg-disabled`, `bg-blanket`, `bg-{role}`, `bg-{role}-subtler`, `bg-{role}-bold` (+ `-hovered`), `bg-brand-subtlest`, `bg-brand-bold` | `--vv-background-*` |
| Viền | `border-default`, `border-bold`, `border-input`, `border-focused`, `border-{role}`, `border-{role}-subtle`, `border-brand-subtle` | `--vv-border*` |
| Ring / outline | `ring-focused`, `ring-{role}`, `ring-{role}-subtle`, `ring-default`, `outline-focused` | `--vv-border*` |
| Đổ bóng | `shadow-raised` (card), `shadow-overlay` (popover, modal, thẻ nổi), `shadow-overflow` | `--vv-shadow-*` |

`{role}` là `danger`, `warning`, `success`, `information` hoặc `discovery`. Ánh xạ vai trò bảo mật của VVWA:

| Ý nghĩa trong VVWA | Tone | Ví dụ |
| :--- | :--- | :--- |
| Vulnerable, bước bị khai thác, test fail | `danger` | Nút mode Vulnerable, dòng code phát sáng đỏ |
| Secure, safety pattern đã chặn, test pass (`TraceStatus` = `safe`) | `success` | Nút mode Secure, badge "đã chặn" |
| Input chưa kiểm tra, bước có nguy cơ | `warning` | Callout cảnh báo |
| Bước xử lý bình thường (`info`) | `information` | Chấm trace xanh dương |
| Nút chính, điểm nhấn, Song song | `brand` | `bg-brand-bold text-inverse` |

**Màu theo trạng thái** lấy từ `@/lib`, không tự viết bảng map: `statusToneClasses(status)`, `toneClasses(TRACE_OUTCOME_TONE[outcome])`, `toneClasses(WORKSPACE_MODE_TONE[mode])`. Mỗi tone có `text`, `textBolder`, `bg`, `bgSubtler`, `bgBold`, `bgBoldHovered`, `onBold`, `border`, `borderSubtle`, `borderLeft`, `ringSubtle` và `icon`, viết đầy đủ tên class để Tailwind quét được.

**Mẫu thường dùng:**

| Thành phần | Class |
| :--- | :--- |
| Card | `bg-surface-raised border-default shadow-raised` |
| Input | `bg-input border-input focus:border-focused` |
| Tooltip | `bg-neutral-bold text-inverse` |
| Backdrop modal | `backdrop:bg-blanket` |
| Nút chính | `bg-brand-bold text-inverse hover:bg-brand-bold-hovered` |

**Token mở rộng của VVWA** (không có trong Atlassian): `border-brand-subtle`, `ring-*-subtle`, `ring-default`, `text-micro`, `leading-code`.

### Theme sáng / tối

* Nút **Sáng / Tối / Theo hệ thống** (`ColorModeSwitch`) trên toolbar lưu lựa chọn vào `localStorage` (`vvwa.colorMode`). `useColorMode` đặt `data-color-mode` trên `<html>`, mặc định theo hệ điều hành.
* Script inline trong `index.html` đặt thuộc tính này trước khi vẽ trang, nên không bị nháy màu.
* Một phạm vi gắn `data-color-mode="dark"` (như Inspector) dùng token dark dù toàn app đang sáng. Component không cần class riêng cho dark.
* Shiki giữ theme `github-dark-default` cho màu cú pháp. Đây là ngoại lệ có chủ đích.

### Khóa SSOT

| Cơ chế | Chặn |
| :--- | :--- |
| Theme Tailwind | Palette mặc định bị xóa: `slate-500`, `red-600`, `white`… không sinh ra CSS |
| ESLint `no-restricted-syntax` (mọi `.ts`/`.tsx`, kể cả `labs/` và `vulnerable.tsx`) | Palette mặc định có sắc độ; thang cũ `danger/safe/warning/info/brand-50…950` và `*-soft`; `white`/`black`; giá trị arbitrary cho màu (`bg-[#…]`, `-[var(--…)]`), cỡ chữ (`text-[11px]`), line-height và spacing (`px-[3px]`); `style={{ fontFamily }}` |
| Gate `design-tokens` (`scripts/quality/check_design_tokens.py`, chạy trong gate `frontend`) | Mã màu ngoài `palette.css`; token chỉ có ở light hoặc chỉ có ở dark; `var(--vv-*)` chưa khai báo; URL ngoài trong `index.html` và CSS |
| `src/__tests__/designTokens.test.ts` | Mọi class trong `TONE_CLASSES` đều có utility thật; light/dark khớp nhau; `index.html` đồng bộ với `useColorMode` |

## 4. Typography

| Vai trò | Font | Class |
| :--- | :--- | :--- |
| Giao diện | `Be Vietnam Pro`, hiển thị dấu tiếng Việt rõ ở cỡ nhỏ | `font-sans` (mặc định) |
| Code & payload | `JetBrains Mono`, phân biệt rõ `'` `"` `` ` `` `1` `l` `I` `0` `O` | `font-mono` |

Font được tự host qua `@fontsource/be-vietnam-pro` và `@fontsource/jetbrains-mono` (OFL 1.1, `tokens/fonts.css`). Vite bundle file `woff2` vào app, trình duyệt chỉ tải subset cần dùng (`unicode-range`). Không có request ra ngoài, nên app chạy được offline.

| Class | Size / Line-height | Weight | Dùng cho |
| :--- | :--- | :--- | :--- |
| `text-heading-large` … `text-heading-xxsmall` | `24/28` … `12/16` | `600` | Tiêu đề |
| `text-body-large` | `16px / 24px` | `400` | Đoạn nổi bật |
| `text-body` | `14px / 22px` | `400` | Nội dung, nhãn form |
| `text-body-small` | `12px / 18px` | `400` | Caption, chú thích |
| `text-micro` | `11px / 16px` | — | Nhãn và badge dày đặc (FlowPipeline, badge tiến độ) |
| `text-code` / `leading-code` | `13px / 22px` | `400` | Dòng code trong Inspector và Diff |

Kích thước lấy theo Atlassian. Line-height của body tăng 2px so với Atlassian để dấu tiếng Việt không chạm dòng trên. Các class cỡ chữ mặc định của Tailwind (`text-xs`, `text-sm`…) vẫn dùng được, còn giá trị arbitrary (`text-[11px]`) bị chặn.

## 5. Component đặc thù

### Nhãn & `Tooltip`

Mọi nhãn của workspace (nút topbar, công tắc mode, nút phát/dừng/tốc độ trace, tab Inspector, tiêu đề chip payload) lấy từ một nguồn duy nhất: `UI_LABELS` trong `core/frontend/src/lib/uiLabels.ts` (import qua `@/lib`). Mỗi mục có `text` hiển thị, `tip` giải thích bằng tiếng Việt (tùy chọn với tiêu đề không focus được) và `busy` nếu nút có trạng thái đang chạy; `modeTip` và `testMyFixTip` bổ sung tên file `frontend/vulnerable.tsx` / `secure.tsx` cho lab có frontend sink. Thuật ngữ đã quen (Vulnerable, Secure, Reset DB, Test My Fix, Replay, Payload) giữ nguyên làm nhãn; phần giải thích nằm trong tooltip.

`Tooltip` (`@/components`) theo mẫu WAI-ARIA tooltip: mở khi rê chuột hoặc khi focus bằng bàn phím, giữ mở khi con trỏ di chuyển sang vùng tooltip (WCAG 1.4.13), đóng bằng `Esc` (chặn lan truyền để không đóng modal bao ngoài), rời chuột, mất focus hoặc khi trigger chuyển sang `disabled`, và nối `aria-describedby` (giữ nguyên các ID đã có). Không dùng thuộc tính `title` cho giải thích (không hiện khi dùng bàn phím hay màn hình cảm ứng). Tham số `side="top"` cho control ở đáy panel, `align="start"` cho control sát mép trái và `align="end"` cho control sát mép phải.

### `ModeSwitch` & `LayoutModeSwitch`

Segmented control ba nút cho chế độ chạy lab (`ModeSwitch`, [ADR-0010](adr/0010-song-song-compare-mode.md)):

| Nút | Tone (`WORKSPACE_MODE_TONE`) | Khi active |
| :--- | :--- | :--- |
| Vulnerable | `danger` | `border-danger bg-danger text-danger` |
| Secure | `success` | `border-success bg-success text-success` |
| Song song | `brand` | `border-brand bg-brand-subtlest text-brand` |

Dưới `xl`, nhãn chữ của ba nút chỉ còn cho trình đọc màn hình (`sr-only xl:not-sr-only`), nút hiển thị icon kèm tooltip.

Nút Vulnerable và Secure có thêm một chấm `h-1.5 w-1.5` cho kết quả gần nhất của mode đó trong lab đang mở: `bgBold` của tone outcome (`TRACE_OUTCOME_TONE`): `bg-danger-bold` (bị khai thác), `bg-success-bold` (đã chặn), `bg-neutral-bold` (bình thường), `bg-warning-bold` (lỗi). Nhãn đọc cho trình đọc màn hình nằm trong `sr-only`. Tên tiếng Việt của outcome lấy từ `TRACE_OUTCOME_LABELS` (`@/lib`).

Ở chế độ Song song, tab Backend của Inspector hiển thị `CompareCodeView`. Trên cùng là badge outcome của hai phía. Kế đến là `CompareTraceTable`, bảng các hàng căn theo `layer:tag`, có cột tiêu đề `text-danger` / `text-success` và hàng đang phát đánh dấu bằng `aria-current="step"`. Dưới cùng là `vulnerable.py` và `secure.py`, xếp hai cột từ container `@3xl` trở lên.

`LayoutModeSwitch` (`role="radiogroup"`, ẩn dưới `lg`, chỉ icon kèm tooltip và hiện nhãn từ `1800px`) chuyển giữa ba bố cục desktop, dùng tone `brand` khi active: `Chia đôi` (`split`), `Tập trung code` (`code-focus`) và `Sandbox nổi` (`floating`). Hai bề mặt giữ nguyên cây React khi đổi chế độ để không mất trạng thái form đang nhập.

### `SplitDivider`

Thanh kéo dọc (`w-1.5`, `role="separator"`, `aria-orientation="vertical"`) chỉ hiển thị ở chế độ `Chia đôi` từ `lg` trở lên:

* Kéo chuột/chạm hoặc nhấn `ArrowLeft` / `ArrowRight` (`±5%`) để chỉnh tỷ lệ cột Sandbox trong khoảng `30%`–`70%` (lưu `vvwa.splitPercent`).
* Nháy đúp hoặc nhấn `Home` / `End` để đặt lại về `50%`.

### `GlowingCodeLine`

Dòng ứng với bước trace đang active:

* Viền trái `3px` theo `status`.
* Nền tint của tone (`bg-danger`, `bg-success`…) và glow `--vv-glow-{tone}` (khai báo lại trong phạm vi dark của Inspector), lấy qua `statusToneClasses`.
* **Inline Callout** trượt xuống (`200ms`) ngay dưới dòng: `Bước N: <title>` và `detail` bằng font mono.

### `FlowPipeline`

Ba node `1. MiniShop UI` → `2. FastAPI` → `3. PostgreSQL`:

| Trạng thái | Hiển thị |
| :--- | :--- |
| `idle` | Viền `border-default` nét đứt, chữ `text-subtle`; không dùng `opacity` để chữ vẫn đạt tương phản WCAG AA |
| `active` | Viền theo `status` + vòng sáng `ring-4` khi trace đang chạy tới tầng này |
| `completed` | Giữ màu trạng thái nghiêm trọng nhất đã gặp |

Mỗi node bấm được để nhảy tới bước đầu tiên của tầng và dòng code tương ứng. Thứ tự nghiêm trọng: `info` < `safe` < `warning` < `danger`.

### `TraceControls`, `TraceSpeedSwitch` & `TraceStepPills`

Thanh điều khiển phát lại trace ở đáy Dark IDE Inspector gồm:

* **Thanh tiến độ (`role="progressbar"`):** dải `h-1` sát mép trên (`bg-brand-bold` trên `bg-neutral`) hiển thị tỷ lệ bước hiện tại (`Bước X / Y`).
* **Nút điều khiển bước:** `Trước`, nút chuyển trạng thái `Phát` (`Play`) / `Dừng` (`Pause`) / `Phát lại` (`RotateCcw`), `Sau`, và bộ đếm bước.
* **`TraceSpeedSwitch` (`role="radiogroup"`):** công tắc 4 mức (`Tay`, `0.5×`, `1×`, `2×`) lưu vào `localStorage` (`vvwa.traceSpeed`); hỗ trợ phím mũi tên/`Home`/`End`. Chế độ `Tay` dừng ngay ở bước 1 sau khi gửi request thay vì tự chạy.
* **`TraceStepPills`:** các pill số bước kèm chấm trạng thái (`bgBold` của tone trạng thái); bước đang chọn nổi bật bằng `bg-neutral-bold text-inverse` (`aria-current="step"`) và bấm để nhảy thẳng tới bước đó.
* **Phím tắt toàn cục (`useTraceShortcuts`):** `←` / `→` chuyển bước và `Space` phát/tạm dừng/phát lại khi có trace và không có modal che; tự động nhường cho ô nhập liệu (`input`, `textarea`, `select`, `contentEditable`) và widget ARIA (`radiogroup`, `tablist`, `separator`, `button`, liên kết).

### `PayloadChipBar` & Trải nghiệm người mới

Chip dạng pill (`rounded-full`, `border-dashed`), phân biệt trực quan giữa **Thử tấn công** (`danger` tinh tế + icon `ShieldAlert` ẩn với screen reader) và **Luồng hợp lệ** (`success` tinh tế + icon `CheckCircle2` ẩn với screen reader) trong khi vẫn giữ nguyên tên truy cập của chip. Bấm chip điền dữ liệu vào form, kích hoạt hiệu ứng nháy ô nhập (`450ms`), giữ viền liền (`aria-pressed`), hiển thị mô tả kèm gợi ý bấm nút gửi ngay bên dưới.

Các thành phần hỗ trợ người mới (`WelcomeBanner`, `LabBeginnerCard`, `LabStepperCard`, `OutcomeCoachPanel`, `LabCatalogModal`, `GlossaryModal`, `TraceLegendBar`) đều tuân thủ cùng hệ màu ngữ nghĩa, dùng `<dialog>` chuẩn HTML, và không chặn thao tác trực tiếp trên MiniShop Sandbox.

### Primitive dùng chung (`core/frontend/src/components/ui/`)

Import qua barrel `@/components` (hoặc `../ui` bên trong `core/frontend/src/components/`) để đồng bộ giao diện MiniShop và hành vi A11y giữa mọi lab:

| Component | Vai trò | Thuộc tính chính |
| :--- | :--- | :--- |
| `LabCard` | Khung card MiniShop chuẩn (`rounded-xlarge`, `bg-surface-raised`, header có viền dưới) | `title`, `icon` (tô màu `text-icon-brand`), `headerRight` (sub-tab / actor / số dư), `children` |
| `PrimaryButton` | Nút hành động chính `bg-brand-bold text-inverse` | `icon`, `isBusy`, `busyLabel` (tự khóa và đổi nhãn), `type` (mặc định `'button'`), `disabled`, `className` |
| `TextField` | Cặp `<label htmlFor>` + `<input>` | `id`, `label`, `value`, `onChange`, `mono` (class `font-mono`, tắt autocomplete/spellcheck), `flashSeq` (chỉ remount khi `flashSeq` đổi để giữ focus khi gõ) |
| `AddressBar` | Thanh địa chỉ trình duyệt giả lập (`<Globe>`, tiền tố monospace + input + submit) | `id`, `ariaLabel`, `prefix`, `value`, `onChange`, `onSubmit`, `submitLabel`, `busyLabel`, `isBusy`, `submitDisabled`, `flashSeq`, `inputClassName` |
| `ResultNotice` | Khung thông báo kết quả theo mức ngữ nghĩa | `tone` (`danger` \| `warning` \| `safe` \| `info` \| `neutral`), `title`, `icon` (mặc định theo `tone`), `role` (mặc định `'alert'` cho `danger`/`warning`, `'status'` cho `safe`/`info`, bỏ qua cho `neutral`) |
| `SubTabBar` | Thanh sub-tab ngang (`role="tablist"`) | `ariaLabel`, `items` (`id`, `label`, `icon`, `buttonId`, `controlsId`), `activeId`, `onChange`; hỗ trợ `ArrowLeft`/`ArrowRight`/`Home`/`End` |

## 6. Khoảng cách & bo góc

| Thuộc tính | Giá trị |
| :--- | :--- |
| Lưới cơ sở | Bội số `4px` theo thang Tailwind (`p-2` = `8px` = `space.100` của Atlassian); bước lẻ dùng `0.25` (`px-0.75` = `3px`), không dùng `px-[3px]` |
| Bo góc card / container | `12px` (`rounded-xlarge`) |
| Bo góc button / input / callout | `8px` (`rounded-large`) |
| Bo góc nhỏ / badge vuông | `6px` (`rounded-medium`), `4px` (`rounded-small`) |
| Bo góc badge / chip | `9999px` (`rounded-full`) |
| Chiều cao topbar | `56px` (`h-14`) |

Từ breakpoint `lg` trở lên, khung app cao đúng một màn hình (`h-screen`) với ba chế độ bố cục lưu trong `localStorage` (`vvwa.layoutMode`, `vvwa.splitPercent`): **Chia đôi** (mặc định, hai cột cuộn độc lập với `SplitDivider` chỉnh `30%`–`70%`), **Tập trung code** (ẩn cột Sandbox để Inspector chiếm toàn chiều rộng kèm nút pill **Về Chia đôi**), và **Sandbox nổi** (Inspector toàn màn hình, Sandbox thành thẻ nổi góc trên phải dưới thanh tab Inspector `rounded-xlarge shadow-overlay` có thể thu gọn/mở rộng để không che code hay điều khiển trace). Dưới `lg`, hai bề mặt luôn xếp chồng thành một cột.
