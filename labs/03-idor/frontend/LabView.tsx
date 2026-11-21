import { useEffect, useRef, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { Globe, Receipt } from 'lucide-react';

import type { LabPayload, LabViewProps } from '@/types';

import { OrderDetail } from './OrderDetail';
import { buildRenderSteps, readOrderList, readOrderLookup } from './orderData';
import type { OrderSummary } from './orderData';

const LAB_ID = '03-idor';

/** Text shown in the address bar; kept as typed so it can be cleared while editing. */
function readOrderIdText(payload: LabPayload): string {
  const value = payload.order_id;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return typeof value === 'string' ? value : '';
}

/** Order id to open, or null while the address bar does not hold a whole number. */
function parseOrderId(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

/** Load 'Đơn hàng của tôi' silently whenever the persona, mode, or database changes. */
function useMyOrders(props: LabViewProps): OrderSummary[] {
  const { actor, mode, dbResetSeq, onExecute } = props;
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const executeRef = useRef(onExecute);
  executeRef.current = onExecute;

  useEffect(() => {
    let active = true;
    void executeRef.current('list_orders', {}, { silent: true }).then((response) => {
      if (active) {
        setOrders(readOrderList(response?.data));
      }
    });
    return () => {
      active = false;
    };
  }, [actor, mode, dbResetSeq]);

  return orders;
}

/**
 * Interactive MiniShop 'my orders' page for Lab 03 (IDOR on the order detail page).
 *
 * @param props - Standardized VVWA LabViewProps injected by SandboxPane.
 * @returns Rendered order list, address bar, and order detail card.
 */
export function LabView(props: LabViewProps): JSX.Element {
  const { mode, actor, payload, onPayloadChange, inputFlashSeq, isExecuting, lastResponse } = props;
  const orderIdText = readOrderIdText(payload);
  const orderId = parseOrderId(orderIdText);
  const orders = useMyOrders(props);
  const lookup = readOrderLookup(lastResponse?.data);
  const flashClass = inputFlashSeq > 0 ? 'vvwa-input-flash' : '';

  // @snippet:start
  const openOrder = (id: number): void => {
    onPayloadChange({ ...payload, order_id: id });
    // @step:fe-open-order
    void props.onExecute(
      'view_order',
      { order_id: id },
      {
        frontendStepsBefore: [
          {
            layer: 'frontend',
            tag: 'fe-open-order',
            status: 'info',
            title: `Mở trang /orders/${String(id)}`,
            detail: `POST /api/labs/${LAB_ID}/${mode}/view_order với order_id=${String(id)} (phiên: ${actor ?? 'ẩn danh'})`,
          },
        ],
        // @step:fe-render-order
        frontendStepsAfter: (response) => buildRenderSteps(response, actor),
      },
    );
  };
  // @snippet:end

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (orderId !== null) {
      openOrder(orderId);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Receipt className="h-4 w-4 text-brand-600" aria-hidden="true" />
          <span>MiniShop · Đơn hàng của tôi</span>
        </div>
        <span className="text-xs text-slate-500">Đăng nhập: {actor ?? 'ẩn danh'}</span>
      </div>

      <section aria-label="Đơn hàng của tôi" className="flex flex-col gap-1.5">
        {orders.length === 0 && <p className="text-xs text-slate-500">Chưa có đơn hàng nào.</p>}
        {orders.map((order) => (
          <button
            key={order.id}
            type="button"
            disabled={isExecuting}
            onClick={() => openOrder(order.id)}
            className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:border-brand-300 hover:bg-brand-50/50 disabled:cursor-not-allowed"
          >
            <span className="font-semibold">Đơn #{order.id}</span>
            <span>
              {order.status} · ${order.totalAmount.toFixed(2)}
            </span>
          </button>
        ))}
      </section>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label
          htmlFor="idor-order-id"
          className="flex flex-1 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>minishop.local/orders/</span>
          <input
            key={`o-${String(inputFlashSeq)}`}
            id="idor-order-id"
            type="number"
            aria-label="Mã đơn hàng trên URL"
            value={orderIdText}
            onChange={(event) => onPayloadChange({ ...payload, order_id: event.target.value })}
            className={`w-20 bg-transparent text-slate-900 focus:outline-none ${flashClass}`}
          />
        </label>
        <button
          type="submit"
          disabled={isExecuting || orderId === null}
          className="cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExecuting ? 'Đang mở...' : 'Mở đơn'}
        </button>
      </form>

      <OrderDetail lookup={lookup} actor={actor} />
    </div>
  );
}
