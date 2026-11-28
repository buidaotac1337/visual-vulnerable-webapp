import type { JSX } from 'react';
import { CircleCheck, CircleX } from 'lucide-react';

import { ResultNotice } from '@/components';

import { abuseNote, formatMoney } from './cartData';
import type { CheckoutResult, Product } from './cartData';

interface CheckoutSummaryProps {
  result: CheckoutResult | null;
  products: readonly Product[];
}

/**
 * Result card of the last checkout.
 *
 * @param props - Parsed checkout result and the catalog.
 * @returns Order confirmation, a rejection notice, or nothing before the first checkout.
 */
export function CheckoutSummary({ result, products }: CheckoutSummaryProps): JSX.Element | null {
  if (!result) {
    return null;
  }
  if (!result.placed) {
    return (
      <ResultNotice
        tone="neutral"
        icon={<CircleX className="h-4 w-4 shrink-0 text-subtlest" aria-hidden="true" />}
      >
        {result.error ?? 'Thanh toán không thành công.'}
      </ResultNotice>
    );
  }
  const note = abuseNote(result, products);
  const total = result.total ?? 0;
  return (
    <article
      aria-label="Kết quả thanh toán"
      className={`flex flex-col gap-2 rounded-large border p-3 text-xs ${note ? 'border-danger-subtle bg-danger' : 'border-success-subtle bg-success'}`}
    >
      <p className="flex items-center gap-1.5 font-semibold text-default">
        <CircleCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        <span>
          Đặt hàng thành công: đơn #{result.orderId}, tổng {formatMoney(total)}
        </span>
      </p>
      {note && <ResultNotice tone="danger">{note}</ResultNotice>}
      <ul className="flex flex-col gap-1 border-t border-default pt-2 text-subtle">
        {result.lines.map((line, index) => (
          <li
            key={`${String(index)}-${String(line.productId)}`}
            className="flex justify-between gap-2"
          >
            <span>
              {line.quantity} × {line.name} @ {formatMoney(line.unitPrice)}
            </span>
            <span>{formatMoney(line.unitPrice * line.quantity)}</span>
          </li>
        ))}
      </ul>
      {result.balance !== null && (
        <p className="text-subtlest">Số dư còn lại: {formatMoney(result.balance)}</p>
      )}
    </article>
  );
}
