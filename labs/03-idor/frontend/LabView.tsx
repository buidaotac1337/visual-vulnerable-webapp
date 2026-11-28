import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Receipt } from 'lucide-react';

import { AddressBar, LabCard } from '@/components';
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

  return (
    <LabCard
      title="MiniShop · Đơn hàng của tôi"
      icon={<Receipt className="h-4 w-4" aria-hidden="true" />}
      headerRight={<span className="text-xs text-subtlest">Đăng nhập: {actor ?? 'ẩn danh'}</span>}
    >
      <section aria-label="Đơn hàng của tôi" className="flex flex-col gap-1.5">
        {orders.length === 0 && <p className="text-xs text-subtlest">Chưa có đơn hàng nào.</p>}
        {orders.map((order) => (
          <button
            key={order.id}
            type="button"
            disabled={isExecuting}
            onClick={() => openOrder(order.id)}
            className="flex cursor-pointer items-center justify-between rounded-large border border-default px-3 py-2 text-xs text-subtle hover:border-brand-subtle hover:bg-brand-subtlest disabled:cursor-not-allowed"
          >
            <span className="font-semibold">Đơn #{order.id}</span>
            <span>
              {order.status} · ${order.totalAmount.toFixed(2)}
            </span>
          </button>
        ))}
      </section>

      <AddressBar
        id="idor-order-id"
        ariaLabel="Mã đơn hàng trên URL"
        prefix="minishop.local/orders/"
        type="number"
        value={orderIdText}
        onChange={(value) => onPayloadChange({ ...payload, order_id: value })}
        onSubmit={() => {
          if (orderId !== null) {
            openOrder(orderId);
          }
        }}
        submitLabel="Mở đơn"
        busyLabel="Đang mở..."
        isBusy={isExecuting}
        submitDisabled={orderId === null}
        flashSeq={inputFlashSeq}
        inputClassName="w-20"
      />

      <OrderDetail lookup={lookup} actor={actor} />
    </LabCard>
  );
}
