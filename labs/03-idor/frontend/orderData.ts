import type { LabExecutionResponse, TraceStepDraft } from '@/types';

/** One line of an order. */
export interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

/** Order detail returned by view_order. */
export interface OrderDetailData {
  id: number;
  owner: string;
  status: string;
  totalAmount: number;
  shippingAddress: string;
  createdAt: string;
  items: OrderItem[];
}

/** Row of the 'Đơn hàng của tôi' list returned by list_orders. */
export interface OrderSummary {
  id: number;
  status: string;
  totalAmount: number;
}

/** Parsed view_order result. */
export interface OrderLookup {
  found: boolean;
  order: OrderDetailData | null;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toItem(value: unknown): OrderItem | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    name: String(value.name ?? ''),
    quantity: Number(value.quantity),
    unitPrice: Number(value.unit_price),
  };
}

function toOrder(value: unknown): OrderDetailData | null {
  if (!isRecord(value)) {
    return null;
  }
  const items = Array.isArray(value.items) ? value.items : [];
  return {
    id: Number(value.id),
    owner: String(value.owner ?? ''),
    status: String(value.status ?? ''),
    totalAmount: Number(value.total_amount),
    shippingAddress: String(value.shipping_address ?? ''),
    createdAt: String(value.created_at ?? ''),
    items: items.map(toItem).filter((item) => item !== null),
  };
}

/**
 * Read a view_order response.
 *
 * @param data - Response data, or undefined.
 * @returns Parsed lookup, or null when the response is not a view_order result.
 */
export function readOrderLookup(data: Record<string, unknown> | undefined): OrderLookup | null {
  if (!data || typeof data.found !== 'boolean') {
    return null;
  }
  return {
    found: data.found,
    order: toOrder(data.order),
    error: typeof data.error === 'string' ? data.error : null,
  };
}

/**
 * Read a list_orders response.
 *
 * @param data - Response data, or undefined.
 * @returns Order summaries (empty when the response carries none).
 */
export function readOrderList(data: Record<string, unknown> | undefined): OrderSummary[] {
  const orders = Array.isArray(data?.orders) ? data.orders : [];
  return orders.filter(isRecord).map((row) => ({
    id: Number(row.id),
    status: String(row.status ?? ''),
    totalAmount: Number(row.total_amount),
  }));
}

/**
 * Describe what the order page shows to the logged-in persona.
 *
 * @param response - view_order response.
 * @param actor - Persona currently logged in, or null.
 * @returns Frontend trace step appended after the backend trace.
 */
export function buildRenderSteps(
  response: LabExecutionResponse,
  actor: string | null,
): TraceStepDraft[] {
  const lookup = readOrderLookup(response.data);
  const order = lookup?.order;
  if (!order) {
    return [
      {
        layer: 'frontend',
        tag: 'fe-render-order',
        status: 'info',
        title: 'Hiển thị "Không tìm thấy đơn hàng"',
        detail: lookup?.error ?? 'Không có dữ liệu đơn hàng.',
      },
    ];
  }
  const foreign = order.owner !== actor;
  return [
    {
      layer: 'frontend',
      tag: 'fe-render-order',
      status: foreign ? 'danger' : 'info',
      title: foreign ? 'Giao diện hiển thị đơn của người khác' : 'Hiển thị đơn hàng',
      detail: foreign
        ? `${actor ?? 'Ẩn danh'} đang xem đơn #${String(order.id)} của ${order.owner}: ${order.shippingAddress}`
        : `Đơn #${String(order.id)} của ${order.owner}.`,
    },
  ];
}
