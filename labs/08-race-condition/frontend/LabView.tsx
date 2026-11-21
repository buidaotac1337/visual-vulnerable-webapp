import { useEffect, useRef, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { TicketPercent, Zap } from 'lucide-react';

import { LabCard, PrimaryButton, TextField } from '@/components';
import type { LabExecutionResponse, LabPayload, LabViewProps } from '@/types';

import { BurstSummary } from './BurstSummary';
import {
  buildRenderSteps,
  buildSendStep,
  clampBurst,
  formatMoney,
  readCouponCatalog,
  summarizeBurst,
} from './couponData';
import type { BurstResult, CouponCatalog, CouponSummary } from './couponData';

const LAB_ID = '08-race-condition';
const BURST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const SELECT_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50';

function couponBadge(coupon: CouponSummary): {
  label: string;
  badgeClass: string;
  boxClass: string;
} {
  if (coupon.usedCount > coupon.maxUses) {
    return {
      label: 'Vượt giới hạn!',
      badgeClass: 'bg-danger-100 text-danger-800',
      boxClass: 'border-danger-300 bg-danger-50 text-danger-900',
    };
  }
  if (coupon.usedCount >= coupon.maxUses) {
    return {
      label: 'Hết lượt',
      badgeClass: 'bg-slate-200 text-slate-700',
      boxClass: 'border-slate-200 bg-slate-50 text-slate-600',
    };
  }
  return {
    label: 'Còn lượt',
    badgeClass: 'bg-safe-50 text-safe-700',
    boxClass: 'border-slate-200 bg-white text-slate-800 hover:border-brand-300',
  };
}

/** Load coupons and actor balance silently on mount and after reset/actor/mode/burst updates. */
function useCouponCatalog(props: LabViewProps, reloadSeq: number): CouponCatalog {
  const { actor, mode, dbResetSeq, onExecute } = props;
  const [catalog, setCatalog] = useState<CouponCatalog>({ coupons: [], balance: null });
  const executeRef = useRef(onExecute);
  executeRef.current = onExecute;

  useEffect(() => {
    let active = true;
    void executeRef.current('load_coupons', {}, { silent: true }).then((response) => {
      if (active && response?.ok) {
        setCatalog(readCouponCatalog(response.data));
      }
    });
    return () => {
      active = false;
    };
  }, [actor, mode, dbResetSeq, reloadSeq]);

  return catalog;
}

/**
 * Interactive MiniShop coupon redemption and concurrent burst lab view (Lab 08).
 *
 * @param props - Standardized VVWA LabViewProps injected by SandboxPane.
 * @returns Rendered coupon inventory, burst controls, and race condition summary.
 */
export function LabView(props: LabViewProps): JSX.Element {
  const { mode, actor, payload, onPayloadChange, inputFlashSeq, dbResetSeq, isExecuting } = props;
  const [reloadSeq, setReloadSeq] = useState<number>(0);
  const [burstSummary, setBurstSummary] = useState<BurstResult | null>(null);
  const catalog = useCouponCatalog(props, reloadSeq);

  useEffect(() => {
    setBurstSummary(null);
  }, [actor, mode, dbResetSeq]);

  const code = typeof payload.code === 'string' ? payload.code : '';
  const burst = clampBurst(payload.burst);
  const normalizedCode = code.trim().toUpperCase();
  const selectedCoupon = catalog.coupons.find((item) => item.code === normalizedCode);

  const update = (patch: LabPayload): void => onPayloadChange({ ...payload, ...patch });

  // @snippet:start
  const applyCoupon = async (targetCode: string, burstCount: number): Promise<void> => {
    const total = clampBurst(burstCount);
    const remaining = selectedCoupon
      ? Math.max(0, selectedCoupon.maxUses - selectedCoupon.usedCount)
      : null;
    const traceOptions = {
      frontendStepsBefore: [buildSendStep(LAB_ID, mode, targetCode, total)],
      // @step:fe-render-burst
      frontendStepsAfter: (response: LabExecutionResponse) => buildRenderSteps(response, total),
    };
    // @step:fe-send-burst
    const requests = Array.from({ length: total }, (_, index) =>
      props.onExecute(
        'apply_coupon',
        { code: targetCode },
        index === total - 1 ? traceOptions : { silent: true },
      ),
    );
    const responses = await Promise.all(requests);
    setBurstSummary(summarizeBurst(responses, targetCode, remaining));
    setReloadSeq((seq) => seq + 1);
  };
  // @snippet:end

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void applyCoupon(normalizedCode, burst);
  };

  return (
    <LabCard
      title="MiniShop · Mã giảm giá"
      icon={<TicketPercent className="h-4 w-4" aria-hidden="true" />}
      headerRight={
        <span className="text-xs text-slate-500">
          {actor ?? 'ẩn danh'} · Số dư:{' '}
          <strong className="text-slate-900">
            {catalog.balance === null ? '—' : formatMoney(catalog.balance)}
          </strong>
        </span>
      }
    >
      <section aria-label="Danh sách mã giảm giá" className="grid gap-2 sm:grid-cols-2">
        {catalog.coupons.map((coupon) => {
          const style = couponBadge(coupon);
          return (
            <button
              key={coupon.id}
              type="button"
              disabled={isExecuting}
              onClick={() => update({ code: coupon.code })}
              className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2 text-left text-xs disabled:cursor-not-allowed ${style.boxClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <code className="font-semibold">{coupon.code}</code>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.badgeClass}`}
                >
                  {style.label}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>
                  -{coupon.discountPercent}% (+{formatMoney(coupon.discountPercent)})
                </span>
                <span>
                  Đã dùng: <strong>{coupon.usedCount}</strong>/{coupon.maxUses}
                </span>
              </div>
            </button>
          );
        })}
      </section>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="rc-code"
            label="Mã giảm giá"
            value={code}
            disabled={isExecuting}
            placeholder="WELCOME10"
            mono
            flashSeq={inputFlashSeq}
            onChange={(value) => update({ code: value })}
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="rc-burst" className="text-xs font-medium text-slate-700">
              Số request đồng thời
            </label>
            <select
              id="rc-burst"
              disabled={isExecuting}
              value={burst}
              onChange={(event) => update({ burst: Number(event.target.value) })}
              className={SELECT_CLASS}
            >
              {BURST_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count === 1 ? '1 request (tuần tự)' : `${String(count)} request đồng thời`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <PrimaryButton
          type="submit"
          icon={<Zap className="h-3.5 w-3.5" aria-hidden="true" />}
          isBusy={isExecuting}
          busyLabel={burst > 1 ? `Đang bắn ${String(burst)} request...` : 'Đang áp mã...'}
          className="self-end"
        >
          {burst > 1 ? `Bắn đồng thời ${String(burst)} request` : 'Áp mã'}
        </PrimaryButton>
      </form>

      <BurstSummary summary={burstSummary} />
    </LabCard>
  );
}
