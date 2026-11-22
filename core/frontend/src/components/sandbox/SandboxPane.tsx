import { Component, memo, Suspense } from 'react';
import type { JSX, ReactNode } from 'react';

import type { LabStepProgress } from '@/hooks';
import { getLazyLabView } from '@/lib';
import type {
  ExecuteActionOptions,
  InspectorTab,
  LabExecutionResponse,
  LabMetadata,
  LabMode,
  LabPayload,
  LastExecutionRequest,
  PipelineNodeModel,
  PlaybackStatus,
  SamplePayload,
  TraceLayer,
  TracePlaybackSpeed,
  TraceStep,
} from '@/types';

import { LabBeginnerCard } from '../guide';
import { LabStepperCard, WelcomeBanner } from '../learning';
import { FlowPipeline } from '../pipeline';
import { ActorSwitcher } from './ActorSwitcher';
import { EmptyLabFallback } from './EmptyLabFallback';
import { OutcomeCoachPanel } from './OutcomeCoachPanel';
import { PayloadChipBar } from './PayloadChipBar';

interface SandboxPaneProps {
  isLoadingLabs: boolean;
  lab: LabMetadata | null;
  mode: LabMode;
  activeTab?: InspectorTab;
  hasFrontendSink?: boolean;
  actors: readonly string[];
  actor: string | null;
  payload: LabPayload;
  inputFlashSeq: number;
  dbResetSeq: number;
  isExecuting: boolean;
  lastRequest: LastExecutionRequest | null;
  lastResponse: LabExecutionResponse | null;
  pipelineNodes: readonly PipelineNodeModel[];
  trace: readonly TraceStep[];
  activeTraceIndex: number;
  playbackStatus: PlaybackStatus;
  playbackSpeed: TracePlaybackSpeed;
  showWelcomeBanner?: boolean;
  labProgress?: LabStepProgress;
  onPayloadChange: (next: LabPayload) => void;
  onChangeActor: (name: string) => void;
  onSelectSamplePayload: (sample: SamplePayload) => void;
  onExecute: (
    action: string,
    overridePayload?: LabPayload,
    options?: ExecuteActionOptions,
  ) => Promise<LabExecutionResponse | null>;
  onSelectPipelineLayer: (layer: TraceLayer) => void;
  onSelectPipelineStep: (index: number) => void;
  onDismissWelcome?: () => void;
  onOpenCatalog?: () => void;
  onOpenGlossary?: (termId?: string) => void;
  onSwitchMode?: (mode: LabMode) => void;
  onOpenDiff?: () => void;
  onOpenVerify?: () => void;
}

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
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-xs text-danger-700">
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

function renderLabViewSlot(props: SandboxPaneProps): JSX.Element {
  const { lab, isLoadingLabs } = props;
  if (!lab) {
    return <EmptyLabFallback kind="no-labs" isLoading={isLoadingLabs} />;
  }
  const LazyLabView = getLazyLabView(lab.id);
  const sharedProps = {
    lab,
    mode: props.mode,
    actor: props.actor,
    payload: props.payload,
    onPayloadChange: props.onPayloadChange,
    inputFlashSeq: props.inputFlashSeq,
    dbResetSeq: props.dbResetSeq,
    isExecuting: props.isExecuting,
    lastResponse: props.lastResponse,
    onExecute: props.onExecute,
  };
  if (!LazyLabView) {
    return <EmptyLabFallback key={lab.id} kind="generic-runner" {...sharedProps} />;
  }
  return (
    <LabViewErrorBoundary key={lab.id}>
      <Suspense
        fallback={
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-xs text-slate-500">
            Đang nạp giao diện MiniShop cho {lab.id}...
          </div>
        }
      >
        <LazyLabView key={lab.id} {...sharedProps} />
      </Suspense>
    </LabViewErrorBoundary>
  );
}

function renderBeginnerGuidance(props: SandboxPaneProps): JSX.Element | null {
  const { lab, labProgress, onSwitchMode, onOpenDiff, onOpenVerify, onOpenGlossary } = props;
  if (!lab) {
    return null;
  }
  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-semibold text-slate-900">{lab.title}</h1>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
            {lab.category}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {lab.difficulty}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-slate-600">{lab.summary}</p>
      </div>

      {onOpenGlossary && (
        <LabBeginnerCard key={`guide-${lab.id}`} lab={lab} onOpenTerm={onOpenGlossary} />
      )}

      {labProgress && onSwitchMode && onOpenDiff && onOpenVerify && (
        <LabStepperCard
          key={`stepper-${lab.id}`}
          labTitle={lab.title}
          progress={labProgress}
          mode={props.mode}
          activeTab={props.activeTab ?? 'backend'}
          defaultExpanded={false}
          onSwitchMode={onSwitchMode}
          onOpenDiff={onOpenDiff}
          onOpenVerify={onOpenVerify}
        />
      )}
    </>
  );
}

/**
 * Render the Light-surface MiniShop Sandbox column housing onboarding guidance,
 * FlowPipeline, beginner lab briefing & 4-step checklist, dynamic LabView plugin,
 * 1-click PayloadChipBar, and contextual OutcomeCoachPanel.
 *
 * @param props - Active lab, execution state, pipeline nodes, progress, and callbacks.
 * @returns Rendered SandboxPane column content.
 */
function SandboxPaneInner(props: SandboxPaneProps): JSX.Element {
  const { lab, mode, actors, actor, isExecuting, lastRequest, lastResponse } = props;

  return (
    <div className="flex flex-col gap-4">
      {props.showWelcomeBanner &&
        props.onOpenCatalog &&
        props.onOpenGlossary &&
        props.onDismissWelcome && (
          <WelcomeBanner
            isVisible
            onOpenCatalog={props.onOpenCatalog}
            onOpenGlossary={() => props.onOpenGlossary?.()}
            onDismiss={props.onDismissWelcome}
          />
        )}

      <FlowPipeline
        nodes={props.pipelineNodes}
        trace={props.trace}
        activeIndex={props.activeTraceIndex}
        playbackStatus={props.playbackStatus}
        playbackSpeed={props.playbackSpeed}
        lastRequest={lastRequest}
        lastResponse={lastResponse}
        onSelectLayer={props.onSelectPipelineLayer}
        onSelectStep={props.onSelectPipelineStep}
      />

      {renderBeginnerGuidance(props)}

      {lab && (
        <ActorSwitcher
          actors={actors}
          actor={actor}
          disabled={isExecuting}
          onChange={props.onChangeActor}
        />
      )}

      {renderLabViewSlot(props)}

      {lab && (
        <PayloadChipBar
          key={`chips-${lab.id}`}
          payloads={lab.samplePayloads}
          onSelect={props.onSelectSamplePayload}
        />
      )}

      {lastResponse && (
        <OutcomeCoachPanel
          mode={mode}
          response={lastResponse}
          hasFrontendSink={props.hasFrontendSink}
          onSwitchMode={props.onSwitchMode}
          onOpenDiff={props.onOpenDiff}
          onOpenVerify={props.onOpenVerify}
        />
      )}
    </div>
  );
}

/**
 * Memoized MiniShop Sandbox column housing onboarding guidance, FlowPipeline,
 * beginner lab briefing, 4-step checklist, dynamic LabView plugin, and OutcomeCoachPanel.
 */
export const SandboxPane = memo(SandboxPaneInner);
