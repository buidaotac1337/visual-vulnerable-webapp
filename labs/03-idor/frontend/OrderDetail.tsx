import type { JSX } from 'react';
import { PackageSearch } from 'lucide-react';

import { ResultNotice } from '@/components';

import { visibleOrder } from './orderData';
import type { OrderLookup } from './orderData';

interface OrderDetailProps {
  lookup: OrderLookup | null;
  actor: string | null;
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

/**
 * Order detail card of the MiniShop order page.
 *
 * @param props - Result of the last view_order call and the logged-in persona.
 * @returns Detail card, a 'not found' notice, or a hint when nothing was opened yet.
 */
export function OrderDetail({ lookup, actor }: OrderDetailProps): JSX.Element {
  if (!lookup) {
    return (
      <p className="text-xs text-subtlest">
        Chọn một đơn trong danh sách hoặc nhập mã đơn trên thanh địa chỉ.
      </p>
    );
  }
  const order = visibleOrder(lookup);
  if (!order) {
    return (
      <ResultNotice
        tone="neutral"
        icon={<PackageSearch className="h-4 w-4 shrink-0 text-subtlest" aria-hidden="true" />}
      >
        {lookup.error ?? 'Không tìm thấy đơn hàng.'}
      </ResultNotice>
    );
  }
  const foreign = order.owner !== actor;
  return (
    <article
      aria-label={`Đơn hàng #${String(order.id)}`}
      className={`flex flex-col gap-3 rounded-large border p-3 ${foreign ? 'border-danger-subtle bg-danger' : 'border-default bg-surface-sunken'}`}
    >
      {foreign && (
        <ResultNotice tone="danger">
          Đây là đơn của {order.owner}. {actor ?? 'Người dùng ẩn danh'} đang xem dữ liệu của khách
          hàng khác.
        </ResultNotice>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-subtlest">Mã đơn</dt>
        <dd className="font-semibold text-default">#{order.id}</dd>
        <dt className="text-subtlest">Khách hàng</dt>
        <dd className="text-default">{order.owner}</dd>
        <dt className="text-subtlest">Trạng thái</dt>
        <dd className="text-default">{order.status}</dd>
        <dt className="text-subtlest">Địa chỉ giao</dt>
        <dd className="text-default">{order.shippingAddress}</dd>
        <dt className="text-subtlest">Tổng tiền</dt>
        <dd className="font-semibold text-default">{formatMoney(order.totalAmount)}</dd>
      </dl>
      <ul className="flex flex-col gap-1 border-t border-default pt-2 text-xs text-subtle">
        {order.items.map((item, index) => (
          <li key={`${String(index)}-${item.name}`} className="flex justify-between gap-2">
            <span>
              {item.quantity} × {item.name}
            </span>
            <span>{formatMoney(item.unitPrice * item.quantity)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
