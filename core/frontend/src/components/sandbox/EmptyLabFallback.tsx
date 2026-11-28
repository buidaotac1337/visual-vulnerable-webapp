import { useEffect, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { FolderOpen, Play } from 'lucide-react';

import { isBackendVerifyTest } from '@/lib';
import type { LabViewProps } from '@/types';

import { LabCard, PrimaryButton, ResultNotice, TextField } from '../ui';

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
  const defaultAction = lab.verifyTests.find(isBackendVerifyTest)?.action ?? 'execute';
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
    <LabCard
      title={`MiniShop Generic Sandbox (${mode})`}
      headerRight={
        <span className="rounded-full bg-neutral px-2 py-0.5 text-xs font-medium text-subtle">
          Chưa có LabView.tsx
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <TextField
          id="vvwa-generic-action"
          label={`Tên hàm Action (trong backend/${mode}.py)`}
          value={actionName}
          onChange={setActionName}
          mono
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-subtle" htmlFor="vvwa-generic-payload">
            JSON Payload
          </label>
          <textarea
            key={inputFlashSeq}
            id="vvwa-generic-payload"
            rows={5}
            value={rawJson}
            onChange={(event) => setRawJson(event.target.value)}
            className={`rounded-large border border-input bg-surface-sunken p-2.5 text-xs text-default focus:border-focused focus:bg-input focus:outline-none ${
              inputFlashSeq > 0 ? 'vvwa-input-flash' : ''
            } font-mono`}
          />
          {parseError && <ResultNotice tone="danger">{parseError}</ResultNotice>}
        </div>

        <PrimaryButton
          type="submit"
          icon={<Play className="h-3.5 w-3.5" aria-hidden="true" />}
          isBusy={isExecuting}
          busyLabel="Đang thực thi..."
          className="self-start"
        >
          Gửi yêu cầu
        </PrimaryButton>
      </form>
    </LabCard>
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
    <div className="flex flex-col items-start gap-3 rounded-xlarge border border-dashed border-default bg-surface-raised p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-default">
        <FolderOpen className="h-5 w-5 text-brand" aria-hidden="true" />
        <span>
          {props.isLoading
            ? 'Đang quét danh sách bài lab...'
            : 'MiniShop Sandbox sẵn sàng — chưa có bài lab trong labs/'}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-subtle">
        Thêm thư mục bài học đầu tiên theo chuẩn{' '}
        <code className="rounded-small bg-neutral px-1.5 py-0.5 text-xs text-default font-mono">
          labs/&lt;id&gt;-&lt;slug&gt;/
        </code>{' '}
        gồm <code className="font-mono">meta.json</code>,{' '}
        <code className="font-mono">backend/vulnerable.py</code>,{' '}
        <code className="font-mono">backend/secure.py</code> và{' '}
        <code className="font-mono">frontend/LabView.tsx</code>. Hệ thống sẽ tự động nhận diện và
        hiển thị ngay tại đây.
      </p>
    </div>
  );
}
