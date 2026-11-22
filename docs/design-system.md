# Design System

Quy chuẩn giao diện của VVWA: bề mặt, màu ngữ nghĩa, typography, component đặc thù và khoảng cách. Token SSOT nằm tại [`core/frontend/src/styles/tokens.css`](../core/frontend/src/styles/tokens.css).

## 1. Nguyên tắc: hai bề mặt

Giao diện tách hai bề mặt tương phản để không lẫn giữa **ứng dụng đang được dùng** và **hệ thống đang giải thích**:

| Bề mặt | Vị trí | Nền | Phong cách |
| :--- | :--- | :--- | :--- |
| **MiniShop Sandbox** | Cột trái | Sáng `#F8FAFC` | Ứng dụng thương mại điện tử; viền trên đổi màu theo mode (đỏ: Vulnerable, xanh lá: Secure) |
| **Code & Trace Inspector** | Cột phải | Tối `#0F172A` | Kiểu IDE, để cú pháp và dòng phát sáng nổi bật |

## 2. Stack UI

| Mục đích | Thư viện |
| :--- | :--- |
| Styling | Tailwind CSS v4, token bằng CSS variables |
| Control (Tabs, Switch, Dialog, Select) | HTML ngữ nghĩa + ARIA tự viết (`role="tablist"`, `radiogroup`, `<dialog>`), không dùng shadcn/ui hay Radix ([ADR-0004](adr/0004-frontend-workspace-architecture-and-lab-plugin-contract.md)) |
| Icon | `lucide-react` (ví dụ `ShieldAlert`, `ShieldCheck`, `Bug`, `Play`, `Pause`, `RotateCcw`, `Download`) |
| Tô màu cú pháp | Shiki (`shiki/core`), theme `github-dark-default`, ngôn ngữ `python`, `tsx`, `sql`; render thành `<span>` React |

## 3. Màu sắc

### Màu ngữ nghĩa bảo mật

Dùng nhất quán ở mọi nơi: công tắc mode, node pipeline, dòng code phát sáng và badge kết quả.

| Vai trò | Class Tailwind | Bảng màu gốc | Dùng cho |
| :--- | :--- | :--- | :--- |
| Vulnerable / Danger | `*-danger-50` … `*-danger-950`, `*-danger`, `*-danger-soft` | `red` | Mode Vulnerable, bước bị khai thác, test fail |
| Secure / Safe | `*-safe-*` | `emerald` | Mode Secure, safety pattern đã chặn, test pass |
| Warning | `*-warning-*` | `amber` | Input chưa kiểm tra, bước có nguy cơ |
| Info | `*-info-*` | `blue` | Bước xử lý bình thường |
| Brand MiniShop | `*-brand-*` | `indigo` | Nút, logo, điểm nhấn trong MiniShop |

Mỗi vai trò là một dải màu đầy đủ (`50` … `950`) khai báo trong khối `@theme inline` của `tokens.css`, nên dùng được như mọi màu Tailwind: `bg-danger-50`, `text-safe-700`, `border-warning-300/60`. `*-soft` là nền mờ (`16%`, brand `10%` từ `indigo-600`). Do `@theme inline` chỉ inline giá trị lúc build và không xuất `--color-danger*` ra `:root`, các shadow/animation runtime (`--glow-*`, `--flash-brand`) tham chiếu biến palette gốc trong `:root`. Đổi bảng màu gốc của một vai trò trong `tokens.css` là đổi màu toàn bộ giao diện.

ESLint chặn các class màu gốc `red-*`, `emerald-*`, `amber-*`, `blue-*`, `indigo-*` (theo thang `50`, `100`…`900`, `950`) ở mọi file `.ts`/`.tsx`, kể cả lab và `vulnerable.tsx`. Màu trung tính (`slate-*`) và màu trang trí không mang nghĩa bảo mật (`sky`, `violet`, `yellow`) vẫn dùng trực tiếp.

### Bề mặt & chữ

| Vùng | Token | Hex |
| :--- | :--- | :--- |
| Nền sandbox | `--bg-sandbox` | `#F8FAFC` |
| Card sandbox | `--bg-card` | `#FFFFFF` |
| Chữ chính (sáng) | `--text-primary` | `#0F172A` |
| Chữ phụ (sáng) | `--text-muted` | `#64748B` |
| Nền IDE | `--bg-ide` | `#0F172A` |
| Header IDE | `--bg-ide-header` | `#1E293B` |
| Viền IDE | `--border-ide` | `#334155` |

## 4. Typography

| Vai trò | Font | Token |
| :--- | :--- | :--- |
| Giao diện | `Be Vietnam Pro` (fallback `Inter, system-ui, sans-serif`) — hiển thị dấu tiếng Việt rõ ở cỡ nhỏ | `--font-sans` |
| Code & payload | `JetBrains Mono` — phân biệt rõ `'` `"` `` ` `` `1` `l` `I` `0` `O` | `--font-mono` |

Font được nạp từ Google Fonts trong `core/frontend/index.html`.

| Cấp | Font | Size / Line-height | Weight | Dùng cho |
| :--- | :--- | :--- | :--- | :--- |
| Tiêu đề topbar | Be Vietnam Pro | `16px / 24px` | `600` | Tên lab |
| Tiêu đề khu vực | Be Vietnam Pro | `14px / 20px` | `600` | Pipeline, Payload mẫu |
| Nội dung | Be Vietnam Pro | `14px / 22px` | `400` | Giải thích, nhãn form |
| Caption / Badge | Be Vietnam Pro | `12px / 16px` | `500` | Trạng thái bước, tooltip |
| Code | JetBrains Mono | `13px / 22px` | `400` | Python, TSX, SQL |

## 5. Component đặc thù

### Nhãn & `Tooltip`

Mọi nhãn của workspace (nút topbar, công tắc mode, nút phát/dừng/tốc độ trace, tab Inspector, tiêu đề chip payload) lấy từ một nguồn duy nhất: `UI_LABELS` trong `core/frontend/src/lib/uiLabels.ts` (import qua `@/lib`). Mỗi mục có `text` hiển thị, `tip` giải thích bằng tiếng Việt (tùy chọn với tiêu đề không focus được) và `busy` nếu nút có trạng thái đang chạy; `modeTip` và `testMyFixTip` bổ sung tên file `frontend/vulnerable.tsx` / `secure.tsx` cho lab có frontend sink. Thuật ngữ đã quen (Vulnerable, Secure, Reset DB, Test My Fix, Replay, Payload) giữ nguyên làm nhãn; phần giải thích nằm trong tooltip.

`Tooltip` (`@/components`) theo mẫu WAI-ARIA tooltip: mở khi rê chuột hoặc khi focus bằng bàn phím, giữ mở khi con trỏ di chuyển sang vùng tooltip (WCAG 1.4.13), đóng bằng `Esc` (chặn lan truyền để không đóng modal bao ngoài), rời chuột, mất focus hoặc khi trigger chuyển sang `disabled`, và nối `aria-describedby` (giữ nguyên các ID đã có). Không dùng thuộc tính `title` cho giải thích (không hiện khi dùng bàn phím hay màn hình cảm ứng). Tham số `side="top"` cho control ở đáy panel, `align="start"` cho control sát mép trái và `align="end"` cho control sát mép phải.

### `ModeSwitch` & `LayoutModeSwitch`

Segmented control hai nửa cho chế độ chạy lab (`ModeSwitch`):

| Nửa | Khi active |
| :--- | :--- |
| Vulnerable | Nền `danger-50`, viền `danger-500`, chữ `danger-700` |
| Secure | Nền `safe-50`, viền `safe-500`, chữ `safe-700` |

`LayoutModeSwitch` (`role="radiogroup"`, ẩn dưới `lg`, icon gọn tại `lg`–`xl` và kèm nhãn từ `2xl`) chuyển giữa ba bố cục desktop dùng vai trò `brand` khi active (`bg-brand-50`, `border-brand-500`, `text-brand-700`): `Song song` (`split`), `Tập trung code` (`code-focus`) và `Sandbox nổi` (`floating`). Hai bề mặt giữ nguyên cây React khi đổi chế độ để không mất trạng thái form đang nhập.

### `SplitDivider`

Thanh kéo dọc (`w-1.5`, `role="separator"`, `aria-orientation="vertical"`) chỉ hiển thị ở chế độ `Song song` từ `lg` trở lên:

* Kéo chuột/chạm hoặc nhấn `ArrowLeft` / `ArrowRight` (`±5%`) để chỉnh tỷ lệ cột Sandbox trong khoảng `30%`–`70%` (lưu `vvwa.splitPercent`).
* Nháy đúp hoặc nhấn `Home` / `End` để đặt lại về `50%`.

### `GlowingCodeLine`

Dòng ứng với bước trace đang active:

* Viền trái `3px` theo `status`.
* Nền mờ (`*-soft`) và glow (`--glow-*` trong `tokens.css`) theo `status`.
* **Inline Callout** trượt xuống (`200ms`) ngay dưới dòng: `Bước N: <title>` và `detail` bằng font mono.

### `FlowPipeline`

Ba node `1. MiniShop UI` → `2. FastAPI` → `3. PostgreSQL`:

| Trạng thái | Hiển thị |
| :--- | :--- |
| `idle` | Viền xám nét đứt, chữ `slate-600`; không dùng `opacity` để chữ vẫn đạt tương phản WCAG AA |
| `active` | Viền theo `status` + vòng sáng `ring-4` khi trace đang chạy tới tầng này |
| `completed` | Giữ màu trạng thái nghiêm trọng nhất đã gặp |

Mỗi node bấm được để nhảy tới bước đầu tiên của tầng và dòng code tương ứng. Thứ tự nghiêm trọng: `info` < `safe` < `warning` < `danger`.

### `TraceControls`, `TraceSpeedSwitch` & `TraceStepPills`

Thanh điều khiển phát lại trace ở đáy Dark IDE Inspector gồm:

* **Thanh tiến độ (`role="progressbar"`):** dải `h-1` sát mép trên (`bg-brand-400` trên `bg-slate-800`) hiển thị tỷ lệ bước hiện tại (`Bước X / Y`).
* **Nút điều khiển bước:** `Trước`, nút chuyển trạng thái `Phát` (`Play`) / `Dừng` (`Pause`) / `Phát lại` (`RotateCcw`), `Sau`, và bộ đếm bước.
* **`TraceSpeedSwitch` (`role="radiogroup"`):** công tắc 4 mức (`Tay`, `0.5×`, `1×`, `2×`) lưu vào `localStorage` (`vvwa.traceSpeed`); hỗ trợ phím mũi tên/`Home`/`End`. Chế độ `Tay` dừng ngay ở bước 1 sau khi gửi request thay vì tự chạy.
* **`TraceStepPills`:** các pill số bước kèm chấm trạng thái (`bg-info-400`, `bg-warning-400`, `bg-danger-400`, `bg-safe-400`); bước đang chọn nổi bật nền sáng (`bg-slate-100 text-slate-900`, `aria-current="step"`) và bấm để nhảy thẳng tới bước đó.
* **Phím tắt toàn cục (`useTraceShortcuts`):** `←` / `→` chuyển bước và `Space` phát/tạm dừng/phát lại khi có trace và không có modal che; tự động nhường cho ô nhập liệu (`input`, `textarea`, `select`, `contentEditable`) và widget ARIA (`radiogroup`, `tablist`, `separator`, `button`, liên kết).

### `PayloadChipBar` & Trải nghiệm người mới

Chip dạng pill (`rounded-full`, `border-dashed`), phân biệt trực quan giữa **Thử tấn công** (`danger` tinh tế + icon `ShieldAlert` ẩn với screen reader) và **Luồng hợp lệ** (`safe` tinh tế + icon `CheckCircle2` ẩn với screen reader) trong khi vẫn giữ nguyên tên truy cập của chip. Bấm chip điền dữ liệu vào form, kích hoạt hiệu ứng nháy ô nhập (`450ms`), giữ viền liền (`aria-pressed`), hiển thị mô tả kèm gợi ý bấm nút gửi ngay bên dưới.

Các thành phần hỗ trợ người mới (`WelcomeBanner`, `LabBeginnerCard`, `LabStepperCard`, `OutcomeCoachPanel`, `LabCatalogModal`, `GlossaryModal`, `TraceLegendBar`) đều tuân thủ cùng hệ màu ngữ nghĩa, dùng `<dialog>` chuẩn HTML, và không chặn thao tác trực tiếp trên MiniShop Sandbox.

### Primitive dùng chung (`core/frontend/src/components/ui/`)

Import qua barrel `@/components` (hoặc `../ui` bên trong `core/frontend/src/components/`) để đồng bộ giao diện MiniShop và hành vi A11y giữa mọi lab:

| Component | Vai trò | Thuộc tính chính |
| :--- | :--- | :--- |
| `LabCard` | Khung card MiniShop chuẩn (`rounded-xl`, header có viền dưới) | `title`, `icon` (tô màu `brand-600`), `headerRight` (sub-tab / actor / số dư), `children` |
| `PrimaryButton` | Nút hành động chính `bg-brand-600` | `icon`, `isBusy`, `busyLabel` (tự khóa và đổi nhãn), `type` (mặc định `'button'`), `disabled`, `className` |
| `TextField` | Cặp `<label htmlFor>` + `<input>` | `id`, `label`, `value`, `onChange`, `mono` (`--font-mono`, tắt autocomplete/spellcheck), `flashSeq` (chỉ remount khi `flashSeq` đổi để giữ focus khi gõ) |
| `AddressBar` | Thanh địa chỉ trình duyệt giả lập (`<Globe>`, tiền tố monospace + input + submit) | `id`, `ariaLabel`, `prefix`, `value`, `onChange`, `onSubmit`, `submitLabel`, `busyLabel`, `isBusy`, `submitDisabled`, `flashSeq`, `inputClassName` |
| `ResultNotice` | Khung thông báo kết quả theo mức ngữ nghĩa | `tone` (`danger` \| `warning` \| `safe` \| `info` \| `neutral`), `title`, `icon` (mặc định theo `tone`), `role` (mặc định `'alert'` cho `danger`/`warning`, `'status'` cho `safe`/`info`, bỏ qua cho `neutral`) |
| `SubTabBar` | Thanh sub-tab ngang (`role="tablist"`) | `ariaLabel`, `items` (`id`, `label`, `icon`, `buttonId`, `controlsId`), `activeId`, `onChange`; hỗ trợ `ArrowLeft`/`ArrowRight`/`Home`/`End` |

## 6. Khoảng cách & bo góc

| Thuộc tính | Giá trị |
| :--- | :--- |
| Lưới cơ sở | Bội số `4px` (`4, 8, 12, 16, 24`) |
| Bo góc card / container | `12px` (`rounded-xl`) |
| Bo góc button / input / callout | `8px` (`rounded-lg`) |
| Bo góc badge / chip | `9999px` (`rounded-full`) |
| Chiều cao topbar | `56px` (`h-14`) |

Từ breakpoint `lg` trở lên, khung app cao đúng một màn hình (`h-screen`) với ba chế độ bố cục lưu trong `localStorage` (`vvwa.layoutMode`, `vvwa.splitPercent`): **Song song** (mặc định, hai cột cuộn độc lập với `SplitDivider` chỉnh `30%`–`70%`), **Tập trung code** (ẩn cột Sandbox để Inspector chiếm toàn chiều rộng kèm nút pill **Về Song song**), và **Sandbox nổi** (Inspector toàn màn hình, Sandbox thành thẻ nổi góc trên phải dưới thanh tab Inspector `rounded-xl shadow-2xl` có thể thu gọn/mở rộng để không che code hay điều khiển trace). Dưới `lg`, hai bề mặt luôn xếp chồng thành một cột.
