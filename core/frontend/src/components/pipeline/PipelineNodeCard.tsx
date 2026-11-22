import type { JSX } from 'react';
import { Database, Globe, Server } from 'lucide-react';

import type { PipelineNodeModel, TraceLayer, TraceStep } from '@/types';

import {
  NODE_ACTIVE_CLASSES,
  NODE_COMPLETED_CLASSES,
  NODE_ICON_CLASSES,
  SOLID_DOT_CLASSES,
} from './pipelineStyles';

interface PipelineNodeCardProps {
  node: PipelineNodeModel;
  trace: readonly TraceStep[];
  activeIndex: number;
  isPlaying: boolean;
  blockedBeforeDb: boolean;
  isSelfLoop: boolean;
  onSelectLayer: (layer: TraceLayer) => void;
  onOpenText: (anchorEl: HTMLElement, heading: string, body: string, isCode?: boolean) => void;
  onScheduleClose: () => void;
}

function renderLayerIcon(layer: TraceLayer, tintClass: string): JSX.Element {
  const cls = `h-[15px] w-[15px] shrink-0 ${tintClass}`;
  switch (layer) {
    case 'frontend':
      return <Globe className={cls} aria-hidden="true" />;
    case 'backend':
      return <Server className={cls} aria-hidden="true" />;
    case 'database':
      return <Database className={cls} aria-hidden="true" />;
  }
}

function resolveNodeSurfaceClass(node: PipelineNodeModel, isSelfLoop: boolean): string {
  const halo = node.visualState === 'active' && isSelfLoop ? 'vvwa-node-halo' : '';
  if (node.visualState === 'active') {
    return `${NODE_ACTIVE_CLASSES[node.status]} ${halo}`;
  }
  if (node.visualState === 'completed') {
    return NODE_COMPLETED_CLASSES[node.status];
  }
  // No opacity: idle nodes must stay readable (WCAG AA); dashed border marks idle state.
  return 'border-dashed border-slate-300 bg-white';
}

function resolveSubtitle(node: PipelineNodeModel, blockedBeforeDb: boolean): string {
  if (node.latestTitle) {
    return node.latestTitle;
  }
  if (node.layer === 'database' && blockedBeforeDb) {
    return 'Không bị chạm';
  }
  return 'Đang chờ...';
}

/**
 * Render one clickable architectural layer card inside FlowPipeline (MiniShop UI,
 * FastAPI, or PostgreSQL) with step progress dots and truncated latest step subtitle.
 *
 * @param props - Derived node state, trace steps, playback flags, and interaction callbacks.
 * @returns Rendered node button element.
 */
export function PipelineNodeCard({
  node,
  trace,
  activeIndex,
  isPlaying,
  blockedBeforeDb,
  isSelfLoop,
  onSelectLayer,
  onOpenText,
  onScheduleClose,
}: PipelineNodeCardProps): JSX.Element {
  const subtitle = resolveSubtitle(node, blockedBeforeDb);
  const iconTint = node.visualState === 'idle' ? 'text-slate-500' : NODE_ICON_CLASSES[node.status];
  const activeStepStatus = trace[activeIndex]?.status ?? node.status;

  return (
    <button
      type="button"
      disabled={!node.hasSteps}
      aria-label={node.label}
      onClick={() => onSelectLayer(node.layer)}
      className={`vvwa-node-btn relative flex min-w-0 cursor-pointer flex-col justify-between gap-1.5 rounded-[10px] border-[1.5px] px-2.5 py-2.5 text-left transition-colors duration-150 hover:enabled:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-default ${resolveNodeSurfaceClass(node, isSelfLoop)}`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          {renderLayerIcon(node.layer, iconTint)}
          <span className="truncate text-xs font-bold text-slate-900">
            <span className="vvwa-label-wide">{node.label}</span>
            <span className="vvwa-label-narrow" aria-hidden="true">
              {node.narrowLabel}
            </span>
          </span>
        </span>
        {node.visualState === 'active' && (
          <span
            aria-hidden="true"
            className={`h-[7px] w-[7px] shrink-0 rounded-full ${SOLID_DOT_CLASSES[activeStepStatus]} ${isPlaying ? 'vvwa-dot-pulse' : ''}`}
          />
        )}
      </div>

      <div
        onMouseEnter={(event) => {
          const target = event.currentTarget;
          if (target.scrollWidth > target.clientWidth + 1) {
            onOpenText(target, node.label, subtitle, false);
          }
        }}
        onMouseLeave={onScheduleClose}
        className={`min-h-[18px] truncate text-xs ${
          node.visualState === 'idle' ? 'text-slate-500' : 'text-slate-700'
        }`}
      >
        {subtitle}
      </div>

      <div className="flex items-center justify-between gap-1.5 text-[11px] text-slate-500">
        <span>{String(node.stepCount)} bước</span>
        <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
          {node.stepIndices.map((stepIdx) => {
            const step = trace[stepIdx];
            const isSeen = stepIdx <= activeIndex;
            const isCurr = stepIdx === activeIndex;
            const dotTone = isSeen && step ? SOLID_DOT_CLASSES[step.status] : 'bg-slate-300';
            return (
              <span
                key={stepIdx}
                className={`h-1.5 w-1.5 rounded-full ${dotTone} ${
                  isCurr ? 'scale-125 ring-2 ring-slate-900/15' : ''
                }`}
              />
            );
          })}
        </span>
      </div>
    </button>
  );
}
