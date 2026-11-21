import type { LabPayload } from '@/types';

import type { Product } from './cartData';

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

const QUANTITY_RE = /^-?\d+$/;
const PRICE_RE = /^-?(\d+(\.\d*)?|\.\d+)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asText(value: unknown): string {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
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
 * Whether a typed quantity is a whole number (negative allowed: that is the attack).
 *
 * @param text - Quantity as typed.
 * @returns True when the browser can send it as an integer.
 */
export function isValidQuantity(text: string): boolean {
  return QUANTITY_RE.test(text.trim());
}

/**
 * Whether a typed unit price is a decimal number such as '45', '1.5', or '.5'.
 *
 * @param text - Price as typed.
 * @returns True when the browser can send it as a number.
 */
export function isValidPrice(text: string): boolean {
  return PRICE_RE.test(text.trim());
}

/**
 * Line total shown in the cart, using the same validity rules as the request body.
 *
 * @param line - Cart line.
 * @returns Price × quantity, or null while a field is empty or not a number.
 */
export function lineTotal(line: CartLine): number | null {
  if (!isValidQuantity(line.quantity) || !isValidPrice(line.price)) {
    return null;
  }
  return Number(line.price) * Number(line.quantity);
}

/** Highlights shown on one cart row. */
export interface LineFlags {
  /** Catalog price to show under the name when the submitted price was edited, else null. */
  listedPrice: number | null;
  priceBad: boolean;
  quantityBad: boolean;
}

/**
 * Work out which cart fields to highlight.
 *
 * @param line - Cart line.
 * @param product - Catalog product of the line, if known.
 * @returns Row highlights.
 */
export function lineFlags(line: CartLine, product: Product | undefined): LineFlags {
  const priceValid = isValidPrice(line.price);
  const edited = product !== undefined && priceValid && Number(line.price) !== product.price;
  return {
    listedPrice: edited ? product.price : null,
    priceBad: edited || !priceValid,
    quantityBad: !isValidQuantity(line.quantity) || Number(line.quantity) <= 0,
  };
}

/**
 * Build the checkout request body the browser sends, as numbers.
 *
 * @param lines - Cart lines.
 * @returns Request items, or null while the cart is empty or a field is not a number.
 */
export function toRequestItems(lines: readonly CartLine[]): RequestItem[] | null {
  if (lines.length === 0 || lines.some((line) => lineTotal(line) === null)) {
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
