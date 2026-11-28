import type { JSX } from 'react';
import { BookOpen, Code2, Compass, FlaskConical, Sparkles, X } from 'lucide-react';

/** Props for the non-blocking inline onboarding banner. */
export interface WelcomeBannerProps {
  isVisible: boolean;
  onOpenCatalog: () => void;
  onOpenGlossary: () => void;
  onDismiss: () => void;
}

/**
 * Render a compact, non-blocking welcome banner for first-time learners explaining
 * the two-surface MiniShop + Code Inspector workflow and linking to the catalog and glossary.
 *
 * @param props - Visibility flag and action callbacks.
 * @returns Rendered WelcomeBanner section, or `null` when hidden.
 */
export function WelcomeBanner({
  isVisible,
  onOpenCatalog,
  onOpenGlossary,
  onDismiss,
}: WelcomeBannerProps): JSX.Element | null {
  if (!isVisible) {
    return null;
  }

  return (
    <section
      aria-label="Hướng dẫn làm quen VVWA"
      className="rounded-xlarge border border-brand-subtle bg-brand-subtlest p-4 text-default shadow-raised"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-large bg-brand-bold text-inverse">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-default">
              Chào mừng đến với Visual Vulnerable Web App
            </h2>
            <p className="text-xs text-subtle">
              Học bảo mật web trực quan qua 2 màn hình song song — không cần kinh nghiệm trước.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Ẩn hướng dẫn chào mừng"
          className="cursor-pointer rounded-large p-1 text-subtlest hover:bg-surface-raised hover:text-default"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <div className="flex items-start gap-2.5 rounded-large border border-default bg-surface-raised p-2.5">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <div className="text-xs">
            <p className="font-semibold text-default">Bên trái: Thử tương tác MiniShop</p>
            <p className="mt-0.5 text-subtle">
              Chọn payload mẫu, gửi yêu cầu ở chế độ <span className="font-medium">Vulnerable</span>{' '}
              rồi gạt sang <span className="font-medium">Secure</span> để so sánh.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-large border border-default bg-surface-raised p-2.5">
          <Code2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <div className="text-xs">
            <p className="font-semibold text-default">
              Bên phải: Xem dòng code phát sáng theo từng bước
            </p>
            <p className="mt-0.5 text-subtle">
              Theo dõi luồng từ UI → FastAPI → PostgreSQL, mở tab Diff và tự sửa code để chấm bài.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenCatalog}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-large bg-brand-bold px-3 py-1.5 text-xs font-semibold text-inverse hover:bg-brand-bold-hovered"
        >
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Xem lộ trình 9 bài lab</span>
        </button>

        <button
          type="button"
          onClick={onOpenGlossary}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-large border border-default bg-surface-raised px-3 py-1.5 text-xs font-medium text-subtle hover:bg-neutral-subtle-hovered"
        >
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Mở từ điển bảo mật</span>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto cursor-pointer rounded-large px-2.5 py-1.5 text-xs font-medium text-subtle hover:bg-surface-raised hover:text-default"
        >
          Đã hiểu, ẩn hướng dẫn
        </button>
      </div>
    </section>
  );
}
