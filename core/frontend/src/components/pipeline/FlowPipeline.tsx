import { Fragment } from 'react';
import type { JSX } from 'react';
import { ArrowRight, Database, Globe, Server } from 'lucide-react';

import type { PipelineNodeModel, TraceLayer, TraceStatus } from '@/types';

interface FlowPipelineProps {
  nodes: readonly PipelineNodeModel[];
  onSelectLayer: (layer: TraceLayer) => void;
}

const LAYER_ICONS: Record<TraceLayer, JSX.Element> = {
  frontend: <Globe className="h-4 w-4" aria-hidden="true" />,
  backend: <Server className="h-4 w-4" aria-hidden="true" />,
  database: <Database className="h-4 w-4" aria-hidden="true" />,
};

const ACTIVE_NODE_STYLES: Record<TraceStatus, string> = {
  info: 'border-info-500 bg-info-50 text-info-700 ring-4 ring-info-500/20',
  warning: 'border-warning-500 bg-warning-50 text-warning-800 ring-4 ring-warning-500/20',
  danger: 'border-danger-500 bg-danger-50 text-danger-700 ring-4 ring-danger-500/25',
  safe: 'border-safe-500 bg-safe-50 text-safe-700 ring-4 ring-safe-500/25',
};

const COMPLETED_NODE_STYLES: Record<TraceStatus, string> = {
  info: 'border-info-400 bg-info-50/70 text-info-700',
  warning: 'border-warning-400 bg-warning-50/70 text-warning-800',
  danger: 'border-danger-400 bg-danger-50/80 text-danger-700',
  safe: 'border-safe-400 bg-safe-50/80 text-safe-700',
};

function getNodeClassName(node: PipelineNodeModel): string {
  if (node.visualState === 'active') {
    return ACTIVE_NODE_STYLES[node.status];
  }
  if (node.visualState === 'completed') {
    return COMPLETED_NODE_STYLES[node.status];
  }
  // No opacity: idle nodes must stay readable (WCAG AA); the dashed border marks them as idle.
  return 'border-dashed border-slate-300 bg-white text-slate-600';
}

/**
 * Render the 3-node clickable architectural FlowPipeline (MiniShop UI -> FastAPI -> PostgreSQL)
 * that lights up in sync with the active execution trace.
 *
 * @param props - Derived PipelineNodeModel items and node click callback.
 * @returns Rendered FlowPipeline section.
 */
export function FlowPipeline({ nodes, onSelectLayer }: FlowPipelineProps): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Luồng thực thi trực quan (Live Pipeline)
        </h2>
        <span className="text-xs text-slate-600">Bấm vào từng bước để xem dòng code</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {nodes.map((node, index) => (
          <Fragment key={node.layer}>
            {index > 0 && (
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
            )}
            <button
              type="button"
              disabled={!node.hasSteps}
              onClick={() => onSelectLayer(node.layer)}
              className={`flex min-w-[130px] flex-1 cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-all duration-150 disabled:cursor-default ${getNodeClassName(node)}`}
            >
              <span className="flex items-center gap-1.5">
                {LAYER_ICONS[node.layer]}
                <span>{node.label}</span>
              </span>
              {node.hasSteps && (
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-xs font-bold">
                  {node.stepCount}
                </span>
              )}
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
