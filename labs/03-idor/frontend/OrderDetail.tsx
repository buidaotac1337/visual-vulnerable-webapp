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
      <p className="text-xs text-slate-500">
        Chọn một đơn trong danh sách hoặc nhập mã đơn trên thanh địa chỉ.
      </p>
    );
  }
  const order = visibleOrder(lookup);
  if (!order) {
    return (
      <ResultNotice
        tone="neutral"
        icon={<PackageSearch className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />}
      >
        {lookup.error ?? 'Không tìm thấy đơn hàng.'}
      </ResultNotice>
    );
  }
  const foreign = order.owner !== actor;
  return (
    <article
      aria-label={`Đơn hàng #${String(order.id)}`}
      className={`flex flex-col gap-3 rounded-lg border p-3 ${foreign ? 'border-danger-300 bg-danger-50/40' : 'border-slate-200 bg-slate-50'}`}
    >
      {foreign && (
        <ResultNotice tone="danger">
          Đây là đơn của {order.owner}. {actor ?? 'Người dùng ẩn danh'} đang xem dữ liệu của khách
          hàng khác.
        </ResultNotice>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-slate-500">Mã đơn</dt>
        <dd className="font-semibold text-slate-900">#{order.id}</dd>
        <dt className="text-slate-500">Khách hàng</dt>
        <dd className="text-slate-900">{order.owner}</dd>
        <dt className="text-slate-500">Trạng thái</dt>
        <dd className="text-slate-900">{order.status}</dd>
        <dt className="text-slate-500">Địa chỉ giao</dt>
        <dd className="text-slate-900">{order.shippingAddress}</dd>
        <dt className="text-slate-500">Tổng tiền</dt>
        <dd className="font-semibold text-slate-900">{formatMoney(order.totalAmount)}</dd>
      </dl>
      <ul className="flex flex-col gap-1 border-t border-slate-200 pt-2 text-xs text-slate-700">
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
