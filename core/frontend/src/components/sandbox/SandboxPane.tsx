import { Component, Suspense } from 'react';
import type { JSX, ReactNode } from 'react';

import { getLazyLabView } from '@/lib';
import type {
  ExecuteActionOptions,
  LabExecutionResponse,
  LabMetadata,
  LabMode,
  LabPayload,
  PipelineNodeModel,
  SamplePayload,
  TraceLayer,
  TraceOutcome,
} from '@/types';

import { FlowPipeline } from '../pipeline';
import { EmptyLabFallback } from './EmptyLabFallback';
import { PayloadChipBar } from './PayloadChipBar';

interface SandboxPaneProps {
  isLoadingLabs: boolean;
  lab: LabMetadata | null;
  mode: LabMode;
  payload: LabPayload;
  inputFlashSeq: number;
  dbResetSeq: number;
  isExecuting: boolean;
  lastResponse: LabExecutionResponse | null;
  pipelineNodes: readonly PipelineNodeModel[];
  onPayloadChange: (next: LabPayload) => void;
  onSelectSamplePayload: (sample: SamplePayload) => void;
  onExecute: (
    action: string,
    overridePayload?: LabPayload,
    options?: ExecuteActionOptions,
  ) => Promise<LabExecutionResponse | null>;
  onSelectPipelineLayer: (layer: TraceLayer) => void;
}

const OUTCOME_BADGE: Record<TraceOutcome, { label: string; className: string }> = {
  exploited: { label: 'BỊ KHAI THÁC (EXPLOITED)', className: 'bg-red-100 text-red-700' },
  blocked: { label: 'ĐÃ CHẶN (BLOCKED)', className: 'bg-emerald-100 text-emerald-700' },
  normal: { label: 'BÌNH THƯỜNG (NORMAL)', className: 'bg-slate-100 text-slate-700' },
  error: { label: 'LỖI THỰC THI (ERROR)', className: 'bg-amber-100 text-amber-800' },
};

interface BoundaryState {
  hasError: boolean;
  message: string;
}

class LabViewErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  public constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  public static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, message: error.message };
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <p className="font-semibold">Lỗi hiển thị LabView.tsx:</p>
          <p className="mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
            {this.state.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Render the Light-surface MiniShop Sandbox column housing FlowPipeline,
 * dynamic LabView plugin (or fallback), 1-click PayloadChipBar, and API output.
 *
 * @param props - Active lab, execution state, pipeline nodes, and callbacks.
 * @returns Rendered SandboxPane column content.
 */
export function SandboxPane({
  isLoadingLabs,
  lab,
  mode,
  payload,
  inputFlashSeq,
  dbResetSeq,
  isExecuting,
  lastResponse,
  pipelineNodes,
  onPayloadChange,
  onSelectSamplePayload,
  onExecute,
  onSelectPipelineLayer,
}: SandboxPaneProps): JSX.Element {
  const LazyLabView = lab ? getLazyLabView(lab.id) : null;
  const outcomeStyle = lastResponse ? OUTCOME_BADGE[lastResponse.meta.outcome] : null;

  return (
    <div className="flex flex-col gap-4">
      <FlowPipeline nodes={pipelineNodes} onSelectLayer={onSelectPipelineLayer} />

      {lab && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold text-slate-900">{lab.title}</h1>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700">
              {lab.category}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              {lab.difficulty}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">{lab.summary}</p>
        </div>
      )}

      {!lab ? (
        <EmptyLabFallback kind="no-labs" isLoading={isLoadingLabs} />
      ) : LazyLabView ? (
        <LabViewErrorBoundary key={lab.id}>
          <Suspense
            fallback={
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-xs text-slate-500">
                Đang nạp giao diện MiniShop cho {lab.id}...
              </div>
            }
          >
            <LazyLabView
              key={lab.id}
              lab={lab}
              mode={mode}
              payload={payload}
              onPayloadChange={onPayloadChange}
              inputFlashSeq={inputFlashSeq}
              dbResetSeq={dbResetSeq}
              isExecuting={isExecuting}
              lastResponse={lastResponse}
              onExecute={onExecute}
            />
          </Suspense>
        </LabViewErrorBoundary>
      ) : (
        <EmptyLabFallback
          key={lab.id}
          kind="generic-runner"
          lab={lab}
          mode={mode}
          payload={payload}
          onPayloadChange={onPayloadChange}
          inputFlashSeq={inputFlashSeq}
          dbResetSeq={dbResetSeq}
          isExecuting={isExecuting}
          lastResponse={lastResponse}
          onExecute={onExecute}
        />
      )}

      {lab && <PayloadChipBar payloads={lab.samplePayloads} onSelect={onSelectSamplePayload} />}

      {lastResponse && outcomeStyle && (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Phản hồi từ hệ thống
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${outcomeStyle.className}`}
            >
              {outcomeStyle.label}
            </span>
          </div>
          <pre
            className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-800"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {JSON.stringify(lastResponse.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
