import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { CheckCircle2, RefreshCw, X, XCircle } from 'lucide-react';

import type { LabMode, VerifyLabResponse, VerifyTestResult } from '@/types';

interface VerifyModalProps {
  isOpen: boolean;
  labTitle: string;
  /** True when the lab declares frontend verifyTests, so the subtitle mentions vulnerable.tsx. */
  hasFrontendTests?: boolean;
  /** Workspace mode; in Secure mode the modal reminds that vulnerable.py is what gets graded. */
  mode?: LabMode;
  isLoading: boolean;
  result: VerifyLabResponse | null;
  error: string | null;
  onRerun: () => void;
  onClose: () => void;
}

const LAYER_BADGE: Record<'backend' | 'frontend', { label: string; className: string }> = {
  backend: { label: 'Backend', className: 'bg-sky-100 text-sky-800' },
  frontend: { label: 'Frontend', className: 'bg-violet-100 text-violet-800' },
};

const MONO = { fontFamily: 'var(--font-mono)' } as const;

/** Reminder shown in Secure mode: grading always targets the student's vulnerable.py. */
function SecureModeNote({ mode }: { mode: LabMode }): JSX.Element | null {
  if (mode !== 'secure') {
    return null;
  }
  return (
    <p
      role="note"
      className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"
    >
      Bạn đang xem chế độ Secure, nhưng Test My Fix luôn chấm{' '}
      <code style={MONO}>vulnerable.py</code> (bài làm của bạn), không chấm{' '}
      <code style={MONO}>secure.py</code>.
    </p>
  );
}

function VerifySubtitle({ hasFrontendTests }: { hasFrontendTests: boolean }): JSX.Element {
  return (
    <p className="text-xs text-slate-600">
      Chấm bài làm của bạn trong <code style={MONO}>backend/vulnerable.py</code> (Reset DB sạch
      trước mỗi test)
      {hasFrontendTests ? (
        <>
          {' '}
          và <code style={MONO}>vulnerable.tsx</code> (render trong document trơ, payload không
          chạy)
        </>
      ) : null}
    </p>
  );
}

function summaryMessage(result: VerifyLabResponse): string {
  if (result.total === 0) {
    return 'Bài lab này chưa khai báo verifyTests nào trong meta.json.';
  }
  return result.passed
    ? 'Tuyệt vời! Bản vá của bạn đã vượt qua toàn bộ kiểm thử.'
    : 'Bản vá chưa đạt yêu cầu — hãy xem chi tiết bên dưới.';
}

function ResultTarget({ item }: { item: VerifyTestResult }): JSX.Element {
  const layer = item.layer ?? 'backend';
  const badge = LAYER_BADGE[layer];
  return (
    <span className="flex items-center gap-1.5">
      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${badge.className}`}>
        {badge.label}
      </span>
      <span
        className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-600"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {layer === 'frontend' ? `<${item.action} />` : `${item.action}()`}
      </span>
    </span>
  );
}

/**
 * Render the native <dialog> Test My Fix modal presenting automated verification results:
 * backend tests on backend/vulnerable.py (clean DB per test) and frontend tests on
 * frontend/vulnerable.tsx rendered in an inert document (ADR-0006).
 *
 * @param props - Open state, verification report, error state, and modal callbacks.
 * @returns Rendered VerifyModal dialog element, or null when closed.
 */
export function VerifyModal({
  isOpen,
  labTitle,
  hasFrontendTests = false,
  mode = 'vulnerable',
  isLoading,
  result,
  error,
  onRerun,
  onClose,
}: VerifyModalProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen || dialog.open) {
      return;
    }
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="vvwa-verify-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <div>
          <h2 id="vvwa-verify-title" className="text-base font-semibold text-slate-900">
            Test My Fix — {labTitle}
          </h2>
          <VerifySubtitle hasFrontendTests={hasFrontendTests} />
          <SecureModeNote mode={mode} />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng hộp thoại kiểm thử"
          className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="max-h-[65vh] overflow-y-auto p-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" />
            <span>Đang chạy bộ kiểm thử verifyTests...</span>
          </div>
        ) : error && !result ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
            {error}
          </div>
        ) : result ? (
          <div className="flex flex-col gap-3">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
                Không chạy được kiểm thử backend: {error}
              </div>
            )}
            <div
              className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-semibold ${
                result.passed
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              <span>{summaryMessage(result)}</span>
              <span>
                {result.passed_count} / {result.total} PASS
              </span>
            </div>

            {result.results.map((item) => (
              <div
                key={`${item.layer ?? 'backend'}-${item.action}-${item.name}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    {item.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
                    )}
                    <span>{item.name}</span>
                  </div>
                  <ResultTarget item={item} />
                </div>

                {item.error && (
                  <p
                    className="mt-2 rounded bg-red-100/70 px-2.5 py-1.5 text-red-800"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {item.error}
                  </p>
                )}

                {!item.passed && !item.error && (
                  <div
                    className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    <pre className="overflow-x-auto rounded bg-white p-2 text-xs text-emerald-700">
                      {`Expected:\n${JSON.stringify(item.expected, null, 2)}`}
                    </pre>
                    <pre className="overflow-x-auto rounded bg-white p-2 text-xs text-red-700">
                      {`Actual:\n${JSON.stringify(item.actual, null, 2)}`}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
        <button
          type="button"
          onClick={onRerun}
          disabled={isLoading}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
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
    </dialog>
  );
}
