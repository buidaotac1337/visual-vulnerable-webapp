import type { LabExecutionResponse, TraceStepDraft } from '@/types';

/** Catalog product returned by load_shop. */
export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

/** Shop data returned by load_shop. */
export interface ShopData {
  products: Product[];
  balance: number | null;
}

/** One line of a placed order. */
export interface OrderLine {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
}

/** Parsed checkout result. */
export interface CheckoutResult {
  placed: boolean;
  orderId: number | null;
  total: number | null;
  lines: OrderLine[];
  balance: number | null;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * Format an amount as dollars, keeping the sign of negative totals visible.
 *
 * @param value - Amount in dollars.
 * @returns Text such as '$89.00' or '-$225.00'.
 */
export function formatMoney(value: number): string {
  return value < 0 ? `-$${Math.abs(value).toFixed(2)}` : `$${value.toFixed(2)}`;
}

/**
 * Read a load_shop response.
 *
 * @param data - Response data, or undefined.
 * @returns Products and balance (empty when the response carries none).
 */
export function readShop(data: Record<string, unknown> | undefined): ShopData {
  const products = Array.isArray(data?.products) ? data.products : [];
  return {
    products: products.filter(isRecord).map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ''),
      price: Number(row.price),
      stock: Number(row.stock),
    })),
    balance: asNumberOrNull(data?.balance),
  };
}

/**
 * Read a checkout response.
 *
 * @param data - Response data, or undefined.
 * @returns Parsed result, or null when the response is not a checkout result.
 */
export function readCheckout(data: Record<string, unknown> | undefined): CheckoutResult | null {
  if (!data || typeof data.placed !== 'boolean') {
    return null;
  }
  const order = isRecord(data.order) ? data.order : null;
  const items = Array.isArray(order?.items) ? order.items : [];
  return {
    placed: data.placed,
    orderId: asNumberOrNull(order?.id),
    total: asNumberOrNull(order?.total_amount),
    lines: items.filter(isRecord).map((row) => ({
      productId: Number(row.product_id),
      name: String(row.name ?? ''),
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
    })),
    balance: asNumberOrNull(data.balance),
    error: typeof data.error === 'string' ? data.error : null,
  };
}

function fairTotal(result: CheckoutResult, products: readonly Product[]): number {
  return result.lines.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId);
    return sum + (product?.price ?? line.unitPrice) * line.quantity;
  }, 0);
}

/**
 * Explain how a placed order abused client-supplied values, if it did.
 * Shared by CheckoutSummary and buildRenderSteps so the UI and the trace never disagree.
 *
 * @param result - Parsed checkout result.
 * @param products - Catalog from load_shop.
 * @returns Warning text, or null for a fair order or a rejected checkout.
 */
export function abuseNote(result: CheckoutResult, products: readonly Product[]): string | null {
  if (!result.placed) {
    return null;
  }
  const total = result.total ?? 0;
  if (result.lines.some((line) => line.quantity <= 0)) {
    return total < 0
      ? `Số lượng âm làm tổng tiền âm: số dư được cộng thêm ${formatMoney(-total)} thay vì bị trừ.`
      : 'Món có số lượng âm hoặc bằng 0 đã được trừ vào tổng tiền.';
  }
  // Per line, like the backend: two edited prices must not hide each other in the total.
  const edited = result.lines.some((line) => {
    const product = products.find((item) => item.id === line.productId);
    return product !== undefined && Math.abs(product.price - line.unitPrice) > 0.005;
  });
  if (!edited) {
    return null;
  }
  const fair = formatMoney(fairTotal(result, products));
  return `Giá niêm yết là ${fair}, server đã tính theo đơn giá trình duyệt gửi lên.`;
}

/**
 * Describe what the checkout page shows after the response.
 *
 * @param response - checkout response.
 * @param products - Catalog from load_shop.
 * @returns Frontend trace step appended after the backend trace.
 */
export function buildRenderSteps(
  response: LabExecutionResponse,
  products: readonly Product[],
): TraceStepDraft[] {
  const result = readCheckout(response.data);
  if (!result) {
    // Not a checkout result (e.g. a runtime-error envelope): the backend trace says it all.
    return [];
  }
  if (!result.placed) {
    const detail = result.error ?? 'Không có đơn hàng nào được tạo.';
    return [
      {
        layer: 'frontend',
        tag: 'fe-render-result',
        status: 'info',
        title: 'Hiển thị lỗi thanh toán',
        detail,
      },
    ];
  }
  const order = `Đơn #${String(result.orderId)}, tổng ${formatMoney(result.total ?? 0)}.`;
  const note = abuseNote(result, products);
  return [
    {
      layer: 'frontend',
      tag: 'fe-render-result',
      status: note ? 'danger' : 'info',
      title: note ? 'Đơn hàng được chấp nhận với tổng tiền sai' : 'Hiển thị xác nhận đơn hàng',
      detail: note ? `${order} ${note}` : order,
    },
  ];
}
