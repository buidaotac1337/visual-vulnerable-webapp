import { Component, memo, Suspense } from 'react';
import type { JSX, ReactNode } from 'react';

import type { LabStepProgress } from '@/hooks';
import { getLazyLabView, UI_LABELS } from '@/lib';
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
  /** Song song view: show the run-order note and skip single-mode coaching (ADR-0010). */
  isCompare?: boolean;
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
        <div className="rounded-xlarge border border-danger-subtle bg-danger p-4 text-xs text-danger">
          <p className="font-semibold">Lỗi hiển thị LabView.tsx:</p>
          <p className="mt-1 font-mono">{this.state.message}</p>
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
          <div className="rounded-xlarge border border-default bg-surface-raised p-6 text-xs text-subtlest">
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
      <div className="rounded-xlarge border border-default bg-surface-raised p-4 shadow-raised">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-semibold text-default">{lab.title}</h1>
          <span className="rounded-full bg-brand-subtlest px-2.5 py-0.5 text-xs font-medium text-brand">
            {lab.category}
          </span>
          <span className="rounded-full bg-neutral px-2.5 py-0.5 text-xs font-medium text-subtle">
            {lab.difficulty}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-subtle">{lab.summary}</p>
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

function renderCompareNote({ lab, isCompare }: SandboxPaneProps): JSX.Element | null {
  if (!lab || isCompare !== true) {
    return null;
  }
  return (
    <p
      role="note"
      className="rounded-large border border-brand-subtle bg-brand-subtlest px-3 py-2 text-xs text-brand"
    >
      {UI_LABELS.compareSandboxNote.text}
    </p>
  );
}

function renderOutcomeCoach(props: SandboxPaneProps): JSX.Element | null {
  if (!props.lastResponse || props.isCompare === true) {
    return null;
  }
  return (
    <OutcomeCoachPanel
      mode={props.mode}
      response={props.lastResponse}
      hasFrontendSink={props.hasFrontendSink}
      onSwitchMode={props.onSwitchMode}
      onOpenDiff={props.onOpenDiff}
      onOpenVerify={props.onOpenVerify}
    />
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
  const { lab, actors, actor, isExecuting, lastRequest, lastResponse } = props;

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

      {renderCompareNote(props)}

      {renderLabViewSlot(props)}

      {lab && (
        <PayloadChipBar
          key={`chips-${lab.id}`}
          payloads={lab.samplePayloads}
          onSelect={props.onSelectSamplePayload}
        />
      )}

      {renderOutcomeCoach(props)}
    </div>
  );
}

/**
 * Memoized MiniShop Sandbox column housing onboarding guidance, FlowPipeline,
 * beginner lab briefing, 4-step checklist, dynamic LabView plugin, and OutcomeCoachPanel.
 */
export const SandboxPane = memo(SandboxPaneInner);
