import { useEffect, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { FolderOpen, Play } from 'lucide-react';

import type { LabViewProps } from '@/types';

interface EmptyStateProps {
  kind: 'no-labs';
  isLoading: boolean;
}

interface GenericRunnerProps extends LabViewProps {
  kind: 'generic-runner';
}

type EmptyLabFallbackProps = EmptyStateProps | GenericRunnerProps;

function GenericRunnerView({
  lab,
  mode,
  payload,
  onPayloadChange,
  inputFlashSeq,
  isExecuting,
  onExecute,
}: GenericRunnerProps): JSX.Element {
  const defaultAction = lab.verifyTests[0]?.action ?? 'execute';
  const [actionName, setActionName] = useState<string>(defaultAction);
  const [rawJson, setRawJson] = useState<string>(() => JSON.stringify(payload, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    setRawJson(JSON.stringify(payload, null, 2));
    setParseError(null);
  }, [payload]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setParseError('Payload phải là một JSON object hợp lệ.');
        return;
      }
      const nextPayload = parsed as Record<string, unknown>;
      setParseError(null);
      onPayloadChange(nextPayload);
      void onExecute(actionName.trim() || defaultAction, nextPayload);
    } catch {
      setParseError('JSON không hợp lệ — hãy kiểm tra lại dấu ngoặc và dấu phẩy.');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">MiniShop Generic Sandbox ({mode})</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          Chưa có LabView.tsx
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600" htmlFor="vvwa-generic-action">
          Tên hàm Action (trong backend/{mode}.py)
        </label>
        <input
          id="vvwa-generic-action"
          type="text"
          value={actionName}
          onChange={(event) => setActionName(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
          style={{ fontFamily: 'var(--font-mono)' }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600" htmlFor="vvwa-generic-payload">
          JSON Payload
        </label>
        <textarea
          key={inputFlashSeq}
          id="vvwa-generic-payload"
          rows={5}
          value={rawJson}
          onChange={(event) => setRawJson(event.target.value)}
          className={`rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none ${
            inputFlashSeq > 0 ? 'vvwa-input-flash' : ''
          }`}
          style={{ fontFamily: 'var(--font-mono)' }}
        />
        {parseError && <p className="text-xs font-medium text-red-600">{parseError}</p>}
      </div>

      <button
        type="submit"
        disabled={isExecuting}
        className="inline-flex cursor-pointer items-center justify-center gap-1.5 self-start rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{isExecuting ? 'Đang thực thi...' : 'Gửi yêu cầu'}</span>
      </button>
    </form>
  );
}

/**
 * Render either the zero-labs onboarding state or a generic JSON runner fallback
 * when a discovered lab has not yet implemented frontend/LabView.tsx.
 *
 * @param props - Discriminated props selecting no-labs or generic-runner mode.
 * @returns Rendered fallback card inside SandboxPane.
 */
export function EmptyLabFallback(props: EmptyLabFallbackProps): JSX.Element {
  if (props.kind === 'generic-runner') {
    return <GenericRunnerView {...props} />;
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <FolderOpen className="h-5 w-5 text-indigo-600" aria-hidden="true" />
        <span>
          {props.isLoading
            ? 'Đang quét danh sách bài lab...'
            : 'MiniShop Sandbox sẵn sàng — chưa có bài lab trong labs/'}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">
        Thêm thư mục bài học đầu tiên theo chuẩn{' '}
        <code
          className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          labs/&lt;id&gt;-&lt;slug&gt;/
        </code>{' '}
        gồm <code style={{ fontFamily: 'var(--font-mono)' }}>meta.json</code>,{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>backend/vulnerable.py</code>,{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>backend/secure.py</code> và{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>frontend/LabView.tsx</code>. Hệ thống sẽ tự
        động nhận diện và hiển thị ngay tại đây.
      </p>
    </div>
  );
}
