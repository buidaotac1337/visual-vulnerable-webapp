import type { JSX } from 'react';
import { ShieldBan } from 'lucide-react';

import { ResultNotice } from '@/components';

import { formatMoney } from './couponData';
import type { BurstResult } from './couponData';

export interface BurstSummaryProps {
  /** Aggregated outcome of the latest single or concurrent coupon batch, or null. */
  summary: BurstResult | null;
}

function renderAppliedNotice(summary: BurstResult): JSX.Element {
  const used = `${String(summary.latestUsedCount ?? 1)}/${String(summary.latestMaxUses ?? 1)}`;
  const balance = summary.latestBalance === null ? '—' : formatMoney(summary.latestBalance);
  return (
    <ResultNotice tone="safe" title="Áp mã giảm giá thành công">
      <p>
        Mã <code>{summary.code}</code> (+{formatMoney(summary.totalBonus)}) · lượt dùng {used} · số
        dư {balance}.
      </p>
    </ResultNotice>
  );
}

function renderStatusNotice(summary: BurstResult): JSX.Element {
  if (summary.overLimit) {
    return (
      <ResultNotice tone="danger" title="Phát hiện Race Condition — Vượt giới hạn lượt dùng!">
        <p>
          {summary.succeeded}/{summary.total} request áp mã <code>{summary.code}</code> đã thành
          công đồng thời (tổng thưởng +{formatMoney(summary.totalBonus)}), vượt quá giới hạn cho
          phép!
        </p>
      </ResultNotice>
    );
  }
  if (summary.errors > 0 && summary.succeeded === 0) {
    return (
      <ResultNotice tone="warning" title="Yêu cầu gặp lỗi thực thi">
        <p>{summary.firstError ?? 'Không thể hoàn tất yêu cầu áp mã.'}</p>
      </ResultNotice>
    );
  }
  if (summary.total > 1 && summary.blockedByLock > 0) {
    return (
      <ResultNotice tone="safe" title="Đã chặn Race Condition an toàn">
        <p>
          Khóa hàng chỉ cho phép {summary.succeeded}/{summary.total} request hợp lệ và chặn gọn{' '}
          {summary.blockedByLock} request dư đồng thời.
        </p>
      </ResultNotice>
    );
  }
  if (summary.succeeded > 0) {
    return renderAppliedNotice(summary);
  }
  return (
    <ResultNotice
      tone="neutral"
      icon={<ShieldBan className="h-4 w-4 shrink-0 text-subtlest" aria-hidden="true" />}
    >
      {summary.firstError ?? 'Không thể áp mã giảm giá.'}
    </ResultNotice>
  );
}

/**
 * Render concurrent burst counters and security outcome notice for Lab 08.
 *
 * @param props - Aggregated single/burst execution summary.
 * @returns Rendered metrics and ResultNotice banner.
 */
export function BurstSummary({ summary }: BurstSummaryProps): JSX.Element {
  if (!summary) {
    return (
      <p className="text-xs text-subtlest">
        Chọn mã giảm giá và số lượng request đồng thời, sau đó bấm <strong>Áp mã</strong> hoặc dùng
        payload mẫu.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {summary.total > 1 ? (
        <dl
          aria-label="Thống kê batch request"
          className="grid grid-cols-3 gap-2 rounded-large border border-default bg-surface-sunken p-2.5 text-center text-xs"
        >
          <div>
            <dt className="text-subtlest">Tổng request</dt>
            <dd className="mt-0.5 text-sm font-semibold text-default">{summary.total}</dd>
          </div>
          <div>
            <dt className="text-subtlest">Thành công</dt>
            <dd
              className={`mt-0.5 text-sm font-semibold ${
                summary.overLimit ? 'text-danger' : 'text-success'
              }`}
            >
              {summary.succeeded}
            </dd>
          </div>
          <div>
            <dt className="text-subtlest">Bị chặn</dt>
            <dd className="mt-0.5 text-sm font-semibold text-subtle">{summary.blocked}</dd>
          </div>
        </dl>
      ) : null}

      {renderStatusNotice(summary)}
    </div>
  );
}
