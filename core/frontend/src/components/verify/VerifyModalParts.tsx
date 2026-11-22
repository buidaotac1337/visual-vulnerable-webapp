import type { JSX } from 'react';
import { ArrowRight, CheckCircle2, GitCompare, RefreshCw, XCircle } from 'lucide-react';

import type { LabMode, VerifyLabResponse, VerifyTestResult } from '@/types';

const LAYER_BADGE: Record<'backend' | 'frontend', { label: string; className: string }> = {
  backend: { label: 'Backend', className: 'bg-sky-100 text-sky-800' },
  frontend: { label: 'Frontend', className: 'bg-violet-100 text-violet-800' },
};

const MONO = { fontFamily: 'var(--font-mono)' } as const;

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
      className="mt-2 rounded-md border border-warning-300 bg-warning-50 px-2.5 py-1.5 text-xs text-warning-900"
    >
      Bạn đang xem chế độ Secure, nhưng Test My Fix luôn chấm bài làm của bạn (
      <code style={MONO}>vulnerable.py</code>
      {hasFrontendTests ? (
        <>
          , <code style={MONO}>vulnerable.tsx</code>
        </>
      ) : null}
      ), không chấm <code style={MONO}>secure.py</code>
      {hasFrontendTests ? (
        <>
          {' '}
          hay <code style={MONO}>secure.tsx</code>
        </>
      ) : null}
      .
    </p>
  );
}

/** Subtitle listing which vulnerable.* files are graded by Test My Fix. */
export function VerifySubtitle({ hasFrontendTests }: { hasFrontendTests: boolean }): JSX.Element {
  return (
    <p className="text-xs text-slate-600">
      Chấm bài làm của bạn trong <code style={MONO}>backend/vulnerable.py</code> (Reset DB sạch
      trước mỗi test)
      {hasFrontendTests ? (
        <>
          {' '}
          và <code style={MONO}>frontend/vulnerable.tsx</code> (render trong document trơ, payload
          không chạy)
        </>
      ) : null}
    </p>
  );
}

function ResultItemRow({ item }: { item: VerifyTestResult }): JSX.Element {
  const layer = item.layer ?? 'backend';
  const badge = LAYER_BADGE[layer];
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          {item.passed ? (
            <CheckCircle2 className="h-4 w-4 text-safe-600" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4 text-danger-600" aria-hidden="true" />
          )}
          <span>{item.name}</span>
        </div>
        <span className="flex items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${badge.className}`}>
            {badge.label}
          </span>
          <span className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-600" style={MONO}>
            {layer === 'frontend' ? `<${item.action} />` : `${item.action}()`}
          </span>
        </span>
      </div>
      {item.error && (
        <p className="mt-2 rounded bg-danger-100/70 px-2.5 py-1.5 text-danger-800" style={MONO}>
          {item.error}
        </p>
      )}
      {!item.passed && !item.error && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" style={MONO}>
          <pre className="overflow-x-auto rounded bg-white p-2 text-xs text-safe-700">
            {`Expected:\n${JSON.stringify(item.expected, null, 2)}`}
          </pre>
          <pre className="overflow-x-auto rounded bg-white p-2 text-xs text-danger-700">
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
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <RefreshCw className="h-4 w-4 animate-spin text-brand-600" aria-hidden="true" />
        <span>Đang chạy bộ kiểm thử verifyTests...</span>
      </div>
    );
  }
  if (error && !result) {
    return (
      <div className="rounded-lg border border-danger-200 bg-danger-50 p-3.5 text-xs text-danger-700">
        {error}
      </div>
    );
  }
  if (!result) return null;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-3.5 text-xs text-danger-700">
          Không chạy được kiểm thử backend: {error}
        </div>
      )}
      <div
        className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-semibold ${
          result.passed
            ? 'border-safe-200 bg-safe-50 text-safe-800'
            : 'border-danger-200 bg-danger-50 text-danger-800'
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
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {result && !result.passed && onOpenDiff && (
          <button
            type="button"
            onClick={() => {
              onOpenDiff();
              onClose();
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
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
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-safe-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-safe-700"
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
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Chạy lại kiểm thử</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
