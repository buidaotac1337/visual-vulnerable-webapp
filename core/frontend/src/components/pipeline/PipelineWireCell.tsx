import type { JSX } from 'react';
import { ShieldCheck } from 'lucide-react';

import type { PipelineLaneModel, PipelineWireKey, PipelineWirePair } from '@/types';

import {
  LANE_ARROW_ACTIVE_CLASSES,
  LANE_LABEL_ACTIVE_CLASSES,
  LANE_LINE_ACTIVE_CLASSES,
  PACKET_DOT_ACTIVE_CLASSES,
} from './pipelineStyles';

interface PipelineWireCellProps {
  wire: PipelineWirePair;
  onHoverWire: (anchorEl: HTMLElement, key: PipelineWireKey) => void;
  onLeaveWire: () => void;
  onBlurWire: (relatedTarget: EventTarget | null) => void;
  onClickWire: (anchorEl: HTMLElement, key: PipelineWireKey) => void;
}

interface LaneButtonProps {
  lane: PipelineLaneModel;
  onHoverWire: (anchorEl: HTMLElement, key: PipelineWireKey) => void;
  onLeaveWire: () => void;
  onBlurWire: (relatedTarget: EventTarget | null) => void;
  onClickWire: (anchorEl: HTMLElement, key: PipelineWireKey) => void;
}

function renderLaneLabel(lane: PipelineLaneModel): JSX.Element {
  const activeClass =
    lane.state === 'active' ? LANE_LABEL_ACTIVE_CLASSES[lane.tone] : 'font-medium text-slate-500';
  return (
    <span
      className={`vvwa-wire-label whitespace-nowrap text-[10.5px] leading-tight ${activeClass}`}
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      <span className="vvwa-label-wide">{lane.label}</span>
      <span className="vvwa-label-narrow" aria-hidden="true">
        {lane.narrowLabel}
      </span>
    </span>
  );
}

function renderBlockedRail(lane: PipelineLaneModel): JSX.Element {
  return (
    <div className="relative flex h-[11px] w-full items-center">
      <div className="h-0 w-full border-t-[1.5px] border-dashed border-safe-500" />
      <span className="vvwa-wire-gate absolute top-1/2 left-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 whitespace-nowrap rounded-full border border-safe-200 bg-safe-50 px-1.5 text-[10.5px] font-semibold text-safe-700">
        <ShieldCheck className="h-[11px] w-[11px] shrink-0" aria-hidden="true" />
        <span className="vvwa-label-wide">{lane.gateLabel ?? 'Chặn DB'}</span>
        <span className="vvwa-label-narrow" aria-hidden="true">
          {lane.narrowGateLabel ?? 'Chặn'}
        </span>
      </span>
    </div>
  );
}

function resolveRailClasses(lane: PipelineLaneModel): { lineClass: string; arrowClass: string } {
  if (lane.state === 'active') {
    return {
      lineClass: LANE_LINE_ACTIVE_CLASSES[lane.tone],
      arrowClass: LANE_ARROW_ACTIVE_CLASSES[lane.tone],
    };
  }
  if (lane.state === 'passed') {
    return { lineClass: 'bg-slate-300', arrowClass: 'text-slate-500' };
  }
  return { lineClass: 'bg-slate-200', arrowClass: 'text-slate-300' };
}

function renderLaneRail(lane: PipelineLaneModel): JSX.Element {
  if (lane.state === 'blocked') {
    return renderBlockedRail(lane);
  }
  const { lineClass, arrowClass } = resolveRailClasses(lane);
  const isReverse = lane.direction === 'reverse';
  const dotAnim = isReverse ? 'vvwa-packet-reverse' : 'vvwa-packet-forward';

  return (
    <div className="relative flex h-[11px] w-full items-center">
      <div className={`h-0.5 w-full rounded-full ${lineClass}`} />
      {lane.state === 'active' && (
        <span
          aria-hidden="true"
          className={`absolute top-1/2 left-0 h-[7px] w-[7px] -translate-y-1/2 rounded-full ${PACKET_DOT_ACTIVE_CLASSES[lane.tone]} ${dotAnim}`}
        />
      )}
      <span
        aria-hidden="true"
        className={`absolute text-[10px] leading-none ${isReverse ? '-left-px' : '-right-px'} ${arrowClass}`}
      >
        {isReverse ? '◂' : '▸'}
      </span>
    </div>
  );
}

function LaneButton({
  lane,
  onHoverWire,
  onLeaveWire,
  onBlurWire,
  onClickWire,
}: LaneButtonProps): JSX.Element {
  const isBlocked = lane.state === 'blocked';
  const ariaLabel = isBlocked
    ? 'Xem chi tiết chặng bị chặn trước PostgreSQL'
    : `Xem gói tin ${lane.label}`;

  return (
    <button
      type="button"
      data-wire-key={lane.key}
      aria-label={ariaLabel}
      onMouseEnter={(event) => onHoverWire(event.currentTarget, lane.key)}
      onFocus={(event) => onHoverWire(event.currentTarget, lane.key)}
      onMouseLeave={onLeaveWire}
      onBlur={(event) => onBlurWire(event.relatedTarget)}
      onClick={(event) => onClickWire(event.currentTarget, lane.key)}
      className={`vvwa-wire-lane flex w-full min-w-0 cursor-pointer flex-col items-center gap-0.5 rounded-md border border-transparent px-[3px] py-[2px] transition-colors hover:border-slate-200 hover:bg-slate-100 focus-visible:border-brand-500 focus-visible:bg-slate-100 focus-visible:outline-none ${
        lane.state === 'muted' ? 'opacity-45' : ''
      }`}
    >
      {lane.direction === 'forward' ? (
        <>
          {renderLaneLabel(lane)}
          {renderLaneRail(lane)}
        </>
      ) : (
        <>
          {renderLaneRail(lane)}
          {renderLaneLabel(lane)}
        </>
      )}
    </button>
  );
}

/**
 * Render a dual-lane directional wire cell (top outbound request/SQL lane and bottom
 * return response/DB result lane) connecting two adjacent FlowPipeline nodes.
 *
 * @param props - Forward/reverse lane models and hover/click handlers.
 * @returns Rendered wire cell container.
 */
export function PipelineWireCell({
  wire,
  onHoverWire,
  onLeaveWire,
  onBlurWire,
  onClickWire,
}: PipelineWireCellProps): JSX.Element {
  return (
    <div className="vvwa-wire-cell flex min-w-0 flex-col justify-center gap-1.5 px-[5px]">
      <LaneButton
        lane={wire.forward}
        onHoverWire={onHoverWire}
        onLeaveWire={onLeaveWire}
        onBlurWire={onBlurWire}
        onClickWire={onClickWire}
      />
      <LaneButton
        lane={wire.reverse}
        onHoverWire={onHoverWire}
        onLeaveWire={onLeaveWire}
        onBlurWire={onBlurWire}
        onClickWire={onClickWire}
      />
    </div>
  );
}
