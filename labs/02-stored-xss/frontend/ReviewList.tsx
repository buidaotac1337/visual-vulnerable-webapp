import type { JSX } from 'react';
import { ShieldAlert, Star } from 'lucide-react';

import type { ReviewBodyComponent, ReviewPage } from './reviewData';

interface ReviewListProps {
  page: ReviewPage | null;
  ReviewBody: ReviewBodyComponent;
  findingsById: ReadonlyMap<number, readonly string[]>;
}

function Stars({ rating }: { rating: number }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${String(rating)} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`h-3 w-3 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

/**
 * Product review list rendered with the ReviewContent sink of the active mode.
 *
 * @param props - Page data, active sink component, and active-content findings.
 * @returns Review section of the MiniShop product page.
 */
export function ReviewList({ page, ReviewBody, findingsById }: ReviewListProps): JSX.Element {
  if (!page) {
    return <p className="text-xs text-slate-500">Đang tải đánh giá...</p>;
  }
  const product = page.products.find((item) => item.id === page.productId);
  return (
    <section aria-label="Đánh giá sản phẩm" className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Đánh giá cho {product?.name ?? `sản phẩm #${String(page.productId)}`} (
        {String(page.reviews.length)})
      </h3>
      {page.reviews.length === 0 && <p className="text-xs text-slate-500">Chưa có đánh giá nào.</p>}
      {page.reviews.map((review) => {
        const findings = findingsById.get(review.id) ?? [];
        return (
          <article
            key={review.id}
            className={`rounded-lg border p-3 ${findings.length > 0 ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-slate-50'}`}
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">{review.username}</span>
              <Stars rating={review.rating} />
            </div>
            <ReviewBody content={review.content} />
            {findings.length > 0 && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-700">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Nội dung đã thành mã thực thi được: {findings.join(', ')}</span>
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}
