import type { JSX } from 'react';
import { ArrowRight, CheckCircle2, GitCompare, RefreshCw, XCircle } from 'lucide-react';

import type { LabMode, VerifyLabResponse, VerifyTestResult } from '@/types';

const LAYER_BADGE: Record<'backend' | 'frontend', { label: string; className: string }> = {
  backend: { label: 'Backend', className: 'bg-accent-blue-subtlest text-accent-blue' },
  frontend: { label: 'Frontend', className: 'bg-accent-purple-subtlest text-accent-purple' },
};

/** Reminder shown in Secure mode: grading always targets the student's vulnerable.* files. */
export function SecureModeNote({
  mode,
  hasFrontendTests,
}: {
  mode: LabMode;
  hasFrontendTests: boolean;
}): JSX.Element | null {
  if (mode !== 'secure') return null;
  return (
    <p
      role="note"
      className="mt-2 rounded-medium border border-warning-subtle bg-warning px-2.5 py-1.5 text-xs text-warning-bolder"
    >
      Bạn đang xem chế độ Secure, nhưng Test My Fix luôn chấm bài làm của bạn (
      <code className="font-mono">vulnerable.py</code>
      {hasFrontendTests ? (
        <>
          , <code className="font-mono">vulnerable.tsx</code>
        </>
      ) : null}
      ), không chấm <code className="font-mono">secure.py</code>
      {hasFrontendTests ? (
        <>
          {' '}
          hay <code className="font-mono">secure.tsx</code>
        </>
      ) : null}
      .
    </p>
  );
}

/** Subtitle listing which vulnerable.* files are graded by Test My Fix. */
export function VerifySubtitle({ hasFrontendTests }: { hasFrontendTests: boolean }): JSX.Element {
  return (
    <p className="text-xs text-subtle">
      Chấm bài làm của bạn trong <code className="font-mono">backend/vulnerable.py</code> (Reset DB
      sạch trước mỗi test)
      {hasFrontendTests ? (
        <>
          {' '}
          và <code className="font-mono">frontend/vulnerable.tsx</code> (render trong document trơ,
          payload không chạy)
        </>
      ) : null}
    </p>
  );
}

function ResultItemRow({ item }: { item: VerifyTestResult }): JSX.Element {
  const layer = item.layer ?? 'backend';
  const badge = LAYER_BADGE[layer];
  return (
    <div className="rounded-large border border-default bg-surface-sunken p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-default">
          {item.passed ? (
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4 text-danger" aria-hidden="true" />
          )}
          <span>{item.name}</span>
        </div>
        <span className="flex items-center gap-1.5">
          <span className={`rounded-small px-1.5 py-0.5 text-xs font-semibold ${badge.className}`}>
            {badge.label}
          </span>
          <span className="rounded-small bg-surface-raised px-1.5 py-0.5 text-xs text-subtle font-mono">
            {layer === 'frontend' ? `<${item.action} />` : `${item.action}()`}
          </span>
        </span>
      </div>
      {item.error && (
        <p className="mt-2 rounded-small bg-danger-subtler px-2.5 py-1.5 text-danger-bolder font-mono">
          {item.error}
        </p>
      )}
      {!item.passed && !item.error && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 font-mono">
          <pre className="overflow-x-auto rounded-small bg-surface-raised p-2 text-xs text-success">
            {`Expected:\n${JSON.stringify(item.expected, null, 2)}`}
          </pre>
          <pre className="overflow-x-auto rounded-small bg-surface-raised p-2 text-xs text-danger">
            {`Actual:\n${JSON.stringify(item.actual, null, 2)}`}
          </pre>
        </div>
      )}
    </div>
  );
}

function summaryMessage(result: VerifyLabResponse): string {
  if (result.total === 0) return 'Bài lab này chưa khai báo verifyTests nào trong meta.json.';
  return result.passed
    ? 'Tuyệt vời! Bản vá của bạn đã vượt qua toàn bộ kiểm thử.'
    : 'Bản vá chưa đạt yêu cầu — hãy xem chi tiết bên dưới.';
}

/** Main scrollable body displaying loading, error, or verifyTests pass/fail results. */
export function VerifyBody({
  isLoading,
  result,
  error,
}: {
  isLoading: boolean;
  result: VerifyLabResponse | null;
  error: string | null;
}): JSX.Element | null {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-subtle">
        <RefreshCw className="h-4 w-4 animate-spin text-brand" aria-hidden="true" />
        <span>Đang chạy bộ kiểm thử verifyTests...</span>
      </div>
    );
  }
  if (error && !result) {
    return (
      <div className="rounded-large border border-danger-subtle bg-danger p-3.5 text-xs text-danger">
        {error}
      </div>
    );
  }
  if (!result) return null;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-large border border-danger-subtle bg-danger p-3.5 text-xs text-danger">
          Không chạy được kiểm thử backend: {error}
        </div>
      )}
      <div
        className={`flex items-center justify-between rounded-large border px-4 py-3 text-sm font-semibold ${
          result.passed
            ? 'border-success-subtle bg-success text-success-bolder'
            : 'border-danger-subtle bg-danger text-danger-bolder'
        }`}
      >
        <span>{summaryMessage(result)}</span>
        <span>
          {result.passed_count} / {result.total} PASS
        </span>
      </div>
      {result.results.map((item) => (
        <ResultItemRow key={`${item.layer ?? 'backend'}-${item.action}-${item.name}`} item={item} />
      ))}
    </div>
  );
}

interface VerifyFooterProps {
  isLoading: boolean;
  result: VerifyLabResponse | null;
  onRerun: () => void;
  onClose: () => void;
  onOpenDiff?: () => void;
  onNextLab?: () => void;
  nextLabTitle?: string | null;
}

/** Modal footer with contextual Diff/Next-Lab actions alongside Rerun and Close. */
export function VerifyFooter(props: VerifyFooterProps): JSX.Element {
  const { isLoading, result, onRerun, onClose, onOpenDiff, onNextLab, nextLabTitle } = props;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-default bg-surface-sunken px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {result && !result.passed && onOpenDiff && (
          <button
            type="button"
            onClick={() => {
              onOpenDiff();
              onClose();
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-large border border-brand-subtle bg-brand-subtlest px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-subtlest-hovered"
          >
            <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Xem gợi ý ở tab Diff</span>
          </button>
        )}
        {result && result.passed && onNextLab && (
          <button
            type="button"
            onClick={() => {
              onNextLab();
              onClose();
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-large bg-success-bold px-3 py-1.5 text-xs font-semibold text-inverse hover:bg-success-bold-hovered"
          >
            <span>{nextLabTitle ? `Học tiếp: ${nextLabTitle}` : 'Bài lab tiếp theo'}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRerun}
          disabled={isLoading}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-large bg-brand-bold px-3 py-1.5 text-xs font-semibold text-inverse hover:bg-brand-bold-hovered disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Chạy lại kiểm thử</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-large border border-default bg-surface-raised px-3 py-1.5 text-xs font-medium text-subtle hover:bg-neutral-subtle-hovered"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
