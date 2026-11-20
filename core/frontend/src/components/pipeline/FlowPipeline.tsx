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
  info: 'border-blue-500 bg-blue-50 text-blue-700 ring-4 ring-blue-500/20',
  warning: 'border-amber-500 bg-amber-50 text-amber-800 ring-4 ring-amber-500/20',
  danger: 'border-red-500 bg-red-50 text-red-700 ring-4 ring-red-500/25',
  safe: 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-4 ring-emerald-500/25',
};

const COMPLETED_NODE_STYLES: Record<TraceStatus, string> = {
  info: 'border-blue-400 bg-blue-50/70 text-blue-700',
  warning: 'border-amber-400 bg-amber-50/70 text-amber-800',
  danger: 'border-red-400 bg-red-50/80 text-red-700',
  safe: 'border-emerald-400 bg-emerald-50/80 text-emerald-700',
};

function getNodeClassName(node: PipelineNodeModel): string {
  if (node.visualState === 'active') {
    return ACTIVE_NODE_STYLES[node.status];
  }
  if (node.visualState === 'completed') {
    return COMPLETED_NODE_STYLES[node.status];
  }
  return 'border-slate-200 bg-white text-slate-500 opacity-65';
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
        <span className="text-[11px] text-slate-400">Bấm vào từng bước để xem dòng code</span>
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
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-bold">
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
