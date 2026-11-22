import { memo, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';

import { derivePipelineModel } from '@/lib';
import type {
  LabExecutionResponse,
  LastExecutionRequest,
  PipelineNodeModel,
  PipelineWireKey,
  PlaybackStatus,
  TraceLayer,
  TracePlaybackSpeed,
  TraceStep,
} from '@/types';

import { PipelineJourneyList } from './PipelineJourneyList';
import { PipelineNodeCard } from './PipelineNodeCard';
import { PipelinePacketStrip } from './PipelinePacketStrip';
import { PipelinePopover } from './PipelinePopover';
import { PIPELINE_STATUS_LABELS, STATUS_PILL_CLASSES } from './pipelineStyles';
import { PipelineWireCell } from './PipelineWireCell';
import { usePipelinePopover } from './usePipelinePopover';

/** Public props for the 3-tier FlowPipeline (Full Data Journey) visualizer. */
export interface FlowPipelineProps {
  nodes: readonly PipelineNodeModel[];
  trace?: readonly TraceStep[];
  activeIndex?: number;
  playbackStatus?: PlaybackStatus;
  playbackSpeed?: TracePlaybackSpeed;
  lastRequest?: LastExecutionRequest | null;
  lastResponse?: LabExecutionResponse | null;
  onSelectLayer: (layer: TraceLayer) => void;
  onSelectStep?: (index: number) => void;
}

const SPEED_DISPLAY: Record<TracePlaybackSpeed, string> = {
  manual: 'Tay',
  '0.5x': '0.5×',
  '1x': '1×',
  '2x': '2×',
};

function resolveHeaderPill(
  activeStep: TraceStep | null,
  playbackStatus: PlaybackStatus,
  playbackSpeed: TracePlaybackSpeed,
): { label: string; className: string } {
  if (!activeStep) {
    return {
      label: 'Sẵn sàng',
      className: 'border-slate-200 bg-slate-100 text-slate-600',
    };
  }
  const label =
    playbackStatus === 'playing'
      ? `Đang chạy · ${SPEED_DISPLAY[playbackSpeed]}`
      : PIPELINE_STATUS_LABELS[activeStep.status];
  return {
    label,
    className: STATUS_PILL_CLASSES[activeStep.status],
  };
}

interface PipelineHeaderProps {
  pill: { label: string; className: string };
  totalSteps: number;
  activeIndex: number;
}

function PipelineHeader({ pill, totalSteps, activeIndex }: PipelineHeaderProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 pt-3 pb-2.5">
      <div className="flex items-center gap-2">
        <h2 className="m-0 text-xs font-bold uppercase tracking-wider text-slate-500">
          Luồng thực thi trực quan
        </h2>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide ${pill.className}`}
        >
          {pill.label}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {totalSteps > 0 && activeIndex >= 0 && (
          <span
            className="text-xs font-semibold text-slate-700"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Bước {String(activeIndex + 1)} / {String(totalSteps)}
          </span>
        )}
        <span className="vvwa-pipeline-hint text-xs text-slate-500">Rê mũi tên xem payload</span>
      </div>
    </div>
  );
}

interface PipelineTrackProps {
  nodes: readonly PipelineNodeModel[];
  trace: readonly TraceStep[];
  activeIndex: number;
  isPlaying: boolean;
  model: ReturnType<typeof derivePipelineModel>;
  popover: ReturnType<typeof usePipelinePopover>;
  onSelectLayer: (layer: TraceLayer) => void;
  onClickWire: (anchorEl: HTMLElement, key: PipelineWireKey) => void;
}

function PipelineTrack({
  nodes,
  trace,
  activeIndex,
  isPlaying,
  model,
  popover,
  onSelectLayer,
  onClickWire,
}: PipelineTrackProps): JSX.Element | null {
  const [frontendNode, backendNode, databaseNode] = nodes;
  if (!frontendNode || !backendNode || !databaseNode) {
    return null;
  }
  const sharedNodeProps = {
    trace,
    activeIndex,
    isPlaying,
    blockedBeforeDb: model.blockedBeforeDb,
    isSelfLoop: model.isSelfLoop,
    onSelectLayer,
    onOpenText: popover.openText,
    onScheduleClose: popover.scheduleClose,
  };
  const sharedWireProps = {
    onHoverWire: popover.openWire,
    onLeaveWire: popover.scheduleClose,
    onBlurWire: popover.onAnchorBlur,
    onClickWire,
  };
  return (
    <div className="vvwa-arch-track px-3.5 pt-0.5 pb-3" aria-label="Sơ đồ 3 tầng kiến trúc">
      <PipelineNodeCard node={frontendNode} {...sharedNodeProps} />
      <PipelineWireCell wire={model.uiBe} {...sharedWireProps} />
      <PipelineNodeCard node={backendNode} {...sharedNodeProps} />
      <PipelineWireCell wire={model.beDb} {...sharedWireProps} />
      <PipelineNodeCard node={databaseNode} {...sharedNodeProps} />
    </div>
  );
}

interface NormalizedPipelineProps {
  trace: readonly TraceStep[];
  activeIndex: number;
  playbackStatus: PlaybackStatus;
  playbackSpeed: TracePlaybackSpeed;
  lastRequest: LastExecutionRequest | null;
  lastResponse: LabExecutionResponse | null;
}

function normalizePipelineProps(props: FlowPipelineProps): NormalizedPipelineProps {
  return {
    trace: props.trace ?? [],
    activeIndex: props.activeIndex ?? -1,
    playbackStatus: props.playbackStatus ?? 'idle',
    playbackSpeed: props.playbackSpeed ?? '1x',
    lastRequest: props.lastRequest ?? null,
    lastResponse: props.lastResponse ?? null,
  };
}

function buildResetKey(lastRequest: LastExecutionRequest | null, traceLength: number): string {
  return `${lastRequest?.labId ?? ''}|${lastRequest?.mode ?? ''}|${String(traceLength === 0)}`;
}

/**
 * Render the 3-tier Full Data Journey FlowPipeline:
 * 1) 3 architectural nodes with dual-lane directional wires and hoverable compact/full payloads,
 * 2) Live Data Packet Strip for the active step,
 * 3) Collapsible chronological Full Data Journey timeline.
 *
 * @param props - Pipeline node models, active trace state, request/response envelopes, and callbacks.
 * @returns Rendered FlowPipeline card section.
 */
function FlowPipelineInner(props: FlowPipelineProps): JSX.Element {
  const { trace, activeIndex, playbackStatus, playbackSpeed, lastRequest, lastResponse } =
    normalizePipelineProps(props);

  const [journeyOpen, setJourneyOpen] = useState<boolean>(false);
  const popover = usePipelinePopover(buildResetKey(lastRequest, trace.length));

  useEffect(() => {
    if (trace.length === 0) {
      setJourneyOpen(false);
    }
  }, [trace.length]);

  const model = useMemo(
    () => derivePipelineModel(trace, activeIndex, lastRequest, lastResponse),
    [trace, activeIndex, lastRequest, lastResponse],
  );
  const pill = resolveHeaderPill(model.activeStep, playbackStatus, playbackSpeed);

  const handleClickWire = (anchorEl: HTMLElement, wireKey: PipelineWireKey): void => {
    const targetStep = model.wirePayloads[wireKey].stepIndex;
    if (targetStep !== null && props.onSelectStep) {
      props.onSelectStep(targetStep);
      popover.openWire(anchorEl, wireKey);
    }
  };

  return (
    <section
      aria-label="Luồng thực thi trực quan"
      className="vvwa-pipeline-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
    >
      <PipelineHeader pill={pill} totalSteps={trace.length} activeIndex={activeIndex} />
      <PipelineTrack
        nodes={props.nodes}
        trace={trace}
        activeIndex={activeIndex}
        isPlaying={playbackStatus === 'playing'}
        model={model}
        popover={popover}
        onSelectLayer={props.onSelectLayer}
        onClickWire={handleClickWire}
      />
      {model.activeStep && (
        <PipelinePacketStrip
          step={model.activeStep}
          hopRoute={model.hopRoute}
          onOpenText={popover.openText}
          onScheduleClose={popover.scheduleClose}
        />
      )}
      {trace.length > 0 && (
        <PipelineJourneyList
          trace={trace}
          activeIndex={activeIndex}
          isOpen={journeyOpen}
          onToggle={() => setJourneyOpen((prev) => !prev)}
          onSelectStep={(idx) => props.onSelectStep?.(idx)}
          onOpenText={popover.openText}
          onScheduleClose={popover.scheduleClose}
        />
      )}
      <PipelinePopover
        target={popover.target}
        wirePayloads={model.wirePayloads}
        activeIndex={activeIndex}
        wireDetailMode={popover.wireDetailMode}
        popoverRef={popover.popoverRef}
        onChangeWireDetailMode={popover.setWireDetailMode}
        onMouseEnter={popover.onPopoverEnter}
        onMouseLeave={popover.onPopoverLeave}
        onFocusOut={popover.onPopoverFocusOut}
      />
    </section>
  );
}

/**
 * Memoized 3-tier Full Data Journey FlowPipeline visualizer.
 */
export const FlowPipeline = memo(FlowPipelineInner);
