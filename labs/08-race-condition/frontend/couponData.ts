import type { LabExecutionResponse, LabMode, TraceStepDraft } from '@/types';

/** MiniShop coupon row returned by load_coupons. */
export interface CouponSummary {
  id: number;
  code: string;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
}

/** Combined coupon inventory and active actor balance. */
export interface CouponCatalog {
  coupons: CouponSummary[];
  balance: number | null;
}

/** Parsed result of one apply_coupon response. */
export interface ApplyResult {
  applied: boolean;
  code: string;
  bonus: number;
  usedCount: number | null;
  maxUses: number | null;
  overLimit: boolean;
  balance: number | null;
  error: string | null;
}

/** Aggregated statistics for a single or concurrent burst of apply_coupon calls. */
export interface BurstResult {
  code: string;
  total: number;
  succeeded: number;
  blocked: number;
  blockedByLock: number;
  errors: number;
  overLimit: boolean;
  totalBonus: number;
  latestUsedCount: number | null;
  latestMaxUses: number | null;
  latestBalance: number | null;
  firstError: string | null;
}

const MIN_BURST = 1;
const MAX_BURST = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Clamp a burst count payload value into the safe UI range [1, 10].
 *
 * @param raw - Untyped value from payload.burst.
 * @returns Integer between 1 and 10 inclusive.
 */
export function clampBurst(raw: unknown): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return MIN_BURST;
  }
  return Math.max(MIN_BURST, Math.min(MAX_BURST, Math.trunc(num)));
}

/**
 * Format USD dollar amounts consistently across the MiniShop coupon UI.
 *
 * @param amount - Numeric dollar amount.
 * @returns Formatted currency string (e.g., '$510.00').
 */
export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Parse a load_coupons execution data dictionary into typed coupons and balance.
 *
 * @param data - Raw response.data from load_coupons, or undefined.
 * @returns Typed CouponCatalog with balance.
 */
export function readCouponCatalog(data: Record<string, unknown> | undefined): CouponCatalog {
  const rawCoupons = Array.isArray(data?.coupons) ? data.coupons : [];
  return {
    coupons: rawCoupons.filter(isRecord).map((row) => ({
      id: Number(row.id),
      code: String(row.code ?? ''),
      discountPercent: Number(row.discount_percent ?? 0),
      maxUses: Number(row.max_uses ?? 1),
      usedCount: Number(row.used_count ?? 0),
    })),
    balance: asNullableNumber(data?.balance),
  };
}

/**
 * Parse one apply_coupon response data object into a typed ApplyResult.
 *
 * @param data - Raw response.data object, or undefined.
 * @returns Parsed ApplyResult, or null if the response is not from apply_coupon.
 */
export function readApplyResult(data: Record<string, unknown> | undefined): ApplyResult | null {
  if (!data || typeof data.applied !== 'boolean') {
    return null;
  }
  return {
    applied: data.applied,
    code: String(data.code ?? ''),
    bonus: Number(data.bonus ?? 0),
    usedCount: asNullableNumber(data.used_count),
    maxUses: asNullableNumber(data.max_uses),
    overLimit: Boolean(data.over_limit),
    balance: asNullableNumber(data.balance),
    error: typeof data.error === 'string' ? data.error : null,
  };
}

function recordApplied(acc: BurstResult, resp: LabExecutionResponse, parsed: ApplyResult): void {
  acc.succeeded += 1;
  acc.totalBonus += parsed.bonus;
  if (parsed.usedCount !== null) {
    acc.latestUsedCount = Math.max(acc.latestUsedCount ?? 0, parsed.usedCount);
  }
  acc.latestMaxUses ??= parsed.maxUses;
  if (parsed.balance !== null) {
    acc.latestBalance = Math.max(acc.latestBalance ?? 0, parsed.balance);
  }
  if (parsed.overLimit || resp.meta.outcome === 'exploited') {
    acc.overLimit = true;
  }
}

function recordError(acc: BurstResult, resp: LabExecutionResponse | null, fallback: string): void {
  acc.errors += 1;
  const raw = resp?.data.error;
  acc.firstError ??= typeof raw === 'string' ? raw : fallback;
}

function recordBlocked(acc: BurstResult, resp: LabExecutionResponse, parsed: ApplyResult): void {
  acc.blocked += 1;
  if (resp.meta.outcome === 'blocked') {
    acc.blockedByLock += 1;
  }
  acc.firstError ??= parsed.error;
}

function recordResponse(acc: BurstResult, resp: LabExecutionResponse | null): void {
  if (!resp || !resp.ok || resp.meta.outcome === 'error') {
    recordError(acc, resp, 'Lỗi thực thi yêu cầu.');
    return;
  }
  const parsed = readApplyResult(resp.data);
  if (!parsed) {
    recordError(acc, resp, 'Phản hồi không hợp lệ.');
    return;
  }
  if (parsed.applied) {
    recordApplied(acc, resp, parsed);
    return;
  }
  recordBlocked(acc, resp, parsed);
}

/**
 * Aggregate outcomes across 1..N concurrent apply_coupon responses.
 *
 * @param responses - Parallel responses returned by Promise.all.
 * @param code - Target coupon code submitted in the burst.
 * @param remainingBefore - Known remaining coupon uses prior to the burst, or null.
 * @returns Aggregated BurstResult for BurstSummary rendering.
 */
export function summarizeBurst(
  responses: readonly (LabExecutionResponse | null)[],
  code: string,
  remainingBefore: number | null,
): BurstResult {
  const acc: BurstResult = {
    code,
    total: responses.length,
    succeeded: 0,
    blocked: 0,
    blockedByLock: 0,
    errors: 0,
    overLimit: false,
    totalBonus: 0,
    latestUsedCount: null,
    latestMaxUses: null,
    latestBalance: null,
    firstError: null,
  };
  for (const resp of responses) {
    recordResponse(acc, resp);
  }
  if (remainingBefore !== null && acc.succeeded > remainingBefore) {
    acc.overLimit = true;
  }
  return acc;
}

/**
 * Build the frontend pre-execution trace step highlighting concurrent dispatch.
 *
 * @param labId - Kebab-case lab identifier.
 * @param mode - Active workspace mode.
 * @param code - Normalized coupon code.
 * @param burst - Number of parallel HTTP requests dispatched.
 * @returns Draft trace step attached to @step:fe-send-burst.
 */
export function buildSendStep(
  labId: string,
  mode: LabMode,
  code: string,
  burst: number,
): TraceStepDraft {
  return {
    layer: 'frontend',
    tag: 'fe-send-burst',
    status: 'info',
    title:
      burst > 1
        ? `Bắn đồng thời ${String(burst)} request áp mã ${code}`
        : `Gửi yêu cầu áp mã ${code}`,
    detail: `POST /api/labs/${labId}/${mode}/apply_coupon (${String(burst)}x Promise.all)`,
  };
}

function renderStep(
  status: TraceStepDraft['status'],
  title: string,
  detail: string,
): TraceStepDraft {
  return { layer: 'frontend', tag: 'fe-render-burst', status, title, detail };
}

/**
 * Build frontend post-execution trace steps for CodeInspector after apply_coupon completes.
 *
 * @param response - Representative non-silent execution response.
 * @param burst - Number of requests dispatched in the batch.
 * @returns Draft trace steps attached to @step:fe-render-burst.
 */
export function buildRenderSteps(response: LabExecutionResponse, burst: number): TraceStepDraft[] {
  const result = readApplyResult(response.data);
  if (!result) {
    return [];
  }
  if (result.overLimit || response.meta.outcome === 'exploited') {
    const detail = `${result.code}: used_count=${String(result.usedCount)}/${String(result.maxUses)}`;
    return [renderStep('danger', 'Cảnh báo vượt giới hạn lượt dùng mã!', detail)];
  }
  if (!result.applied) {
    const status = response.meta.outcome === 'blocked' ? 'safe' : 'info';
    const title = burst > 1 ? 'Request dư bị chặn bởi khóa giao dịch' : 'Yêu cầu áp mã bị từ chối';
    return [renderStep(status, title, result.error ?? 'Không thể áp mã giảm giá.')];
  }
  const detail = `${result.code}: +${formatMoney(result.bonus)} -> ${formatMoney(result.balance ?? 0)}`;
  return [renderStep('info', 'Cập nhật ví và trạng thái mã giảm giá', detail)];
}
