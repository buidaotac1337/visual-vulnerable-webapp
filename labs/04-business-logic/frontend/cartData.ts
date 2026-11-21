import type { LabExecutionResponse, LabPayload, TraceStepDraft } from '@/types';

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

/** Cart line as held in the form; values stay as typed until checkout. */
export interface CartLine {
  productId: number;
  quantity: string;
  price: string;
}

/** Cart line exactly as the browser sends it in the checkout request body. */
export interface RequestItem {
  product_id: number;
  quantity: number;
  price: number;
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

const QUANTITY_RE = /^-?\d+$/;
const PRICE_RE = /^-?\d+(\.\d+)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asText(value: unknown): string {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
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
 * Read the cart held in the sandbox payload.
 *
 * @param payload - Sandbox payload with an 'items' array.
 * @returns Cart lines in form order.
 */
export function readCart(payload: LabPayload): CartLine[] {
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items.filter(isRecord).map((raw) => ({
    productId: Number(raw.product_id),
    quantity: asText(raw.quantity),
    price: asText(raw.price),
  }));
}

/**
 * Turn the cart into the payload shape stored by the sandbox.
 *
 * @param lines - Cart lines.
 * @returns Raw items for LabPayload.items.
 */
export function writeCart(lines: readonly CartLine[]): Record<string, unknown>[] {
  return lines.map((line) => ({
    product_id: line.productId,
    quantity: line.quantity,
    price: line.price,
  }));
}

/**
 * Build the checkout request body the browser sends, as numbers.
 *
 * @param lines - Cart lines.
 * @returns Request items, or null while the cart is empty or a field is not a number.
 */
export function toRequestItems(lines: readonly CartLine[]): RequestItem[] | null {
  const valid = lines.every(
    (line) => QUANTITY_RE.test(line.quantity.trim()) && PRICE_RE.test(line.price.trim()),
  );
  if (lines.length === 0 || !valid) {
    return null;
  }
  return lines.map((line) => ({
    product_id: line.productId,
    quantity: Number(line.quantity),
    price: Number(line.price),
  }));
}

/**
 * Subtotal computed by the browser from the prices and quantities it is about to send.
 *
 * @param items - Request items.
 * @returns Sum of price × quantity.
 */
export function clientSubtotal(items: readonly RequestItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
  const fair = fairTotal(result, products);
  if (Math.abs(fair - total) > 0.005) {
    return `Giá niêm yết là ${formatMoney(fair)}, server đã tính theo đơn giá trình duyệt gửi lên.`;
  }
  return null;
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
      title: note ? 'Đơn hàng được chấp nhận với giá sai' : 'Hiển thị xác nhận đơn hàng',
      detail: note ? `${order} ${note}` : order,
    },
  ];
}
