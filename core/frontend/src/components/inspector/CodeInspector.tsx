import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { RefreshCw } from 'lucide-react';

import { resolveFrontendFile, resolveStepTarget } from '@/lib';
import type { ResolvedFrontendFile } from '@/lib';
import type {
  InspectorTab,
  LabMetadata,
  LabMode,
  LabSourceResponse,
  PlaybackStatus,
  StepHighlightTarget,
  TraceStep,
} from '@/types';

import { CodeSnippetView } from './CodeSnippetView';
import { TraceControls } from './TraceControls';
import { UnifiedDiffView } from './UnifiedDiffView';

interface CodeInspectorProps {
  lab: LabMetadata | null;
  mode: LabMode;
  activeTab: InspectorTab;
  source: LabSourceResponse | null;
  sourceError: string | null;
  isRefreshing: boolean;
  totalSteps: number;
  activeIndex: number;
  activeStep: TraceStep | null;
  playbackStatus: PlaybackStatus;
  onChangeTab: (tab: InspectorTab) => void;
  onRefreshSource: () => void;
  onPrevStep: () => void;
  onReplayTrace: () => void;
  onNextStep: () => void;
}

const TAB_ITEMS: readonly { id: InspectorTab; label: string }[] = [
  { id: 'backend', label: 'Backend (.py)' },
  { id: 'frontend', label: 'Frontend (.tsx)' },
  { id: 'diff', label: 'Diff' },
];

interface InspectorView {
  activeTab: InspectorTab;
  mode: LabMode;
  frontendFile: ResolvedFrontendFile | null;
}

function resolveFileLabel(
  { activeTab, mode, frontendFile }: InspectorView,
  hasFeDiff: boolean,
): string {
  if (activeTab === 'diff') {
    return hasFeDiff ? 'vulnerable ↔ secure (.py + .tsx)' : 'vulnerable.py ↔ secure.py';
  }
  if (activeTab === 'frontend') {
    return frontendFile?.label ?? 'frontend/LabView.tsx';
  }
  return `backend/${mode}.py`;
}

function renderDiffTab(source: LabSourceResponse): JSX.Element {
  if (source.frontend_diff == null) {
    return <UnifiedDiffView diff={source.diff} />;
  }
  return (
    <div>
      <h3 className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Backend: vulnerable.py ↔ secure.py
      </h3>
      <UnifiedDiffView diff={source.diff} />
      <h3 className="border-t border-slate-700 px-3 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Frontend: vulnerable.tsx ↔ secure.tsx
      </h3>
      <UnifiedDiffView diff={source.frontend_diff} fileLabels={['vulnerable.tsx', 'secure.tsx']} />
    </div>
  );
}

function highlightFor(
  target: StepHighlightTarget | null,
  tab: 'backend' | 'frontend',
  frontendKind?: ResolvedFrontendFile['kind'],
): number | null | undefined {
  if (target?.tab !== tab) {
    return undefined;
  }
  if (frontendKind && (target.frontendFile ?? frontendKind) !== frontendKind) {
    return undefined;
  }
  return target.lineNumber;
}

function renderSnippetForTab(
  { activeTab, mode, frontendFile }: InspectorView,
  source: LabSourceResponse,
  target: StepHighlightTarget | null,
  activeStep: TraceStep | null,
): JSX.Element {
  const isFrontend = activeTab === 'frontend' && frontendFile !== null;
  const code = isFrontend
    ? frontendFile.file.code
    : (mode === 'vulnerable' ? source.vulnerable : source.secure).code;
  const line = isFrontend
    ? highlightFor(target, 'frontend', frontendFile.kind)
    : highlightFor(target, 'backend');
  return (
    <CodeSnippetView
      code={code}
      language={isFrontend ? 'tsx' : 'python'}
      highlightedLine={line ?? null}
      activeStep={line === undefined ? null : activeStep}
    />
  );
}

function buildInspectorView(
  activeTab: InspectorTab,
  mode: LabMode,
  source: LabSourceResponse | null,
  target: StepHighlightTarget | null,
): InspectorView {
  const preferred = target?.tab === 'frontend' ? target.frontendFile : undefined;
  return { activeTab, mode, frontendFile: resolveFrontendFile(source, mode, preferred) };
}

function renderInspectorBody(
  view: InspectorView,
  source: LabSourceResponse | null,
  sourceError: string | null,
  target: StepHighlightTarget | null,
  activeStep: TraceStep | null,
): JSX.Element {
  if (sourceError) {
    return (
      <div className="m-4 rounded-lg border border-red-500/40 bg-red-950/50 p-4 text-xs text-red-200">
        {sourceError}
      </div>
    );
  }
  if (!source) {
    return (
      <div
        className="whitespace-pre-line p-6 text-xs text-slate-400"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {`# Code & Trace Inspector (${view.mode})\n# Chọn bài lab để xem mã nguồn trực tiếp với hiệu ứng sáng đèn # @step.`}
      </div>
    );
  }
  if (view.activeTab === 'diff') {
    return renderDiffTab(source);
  }
  return renderSnippetForTab(view, source, target, activeStep);
}

/**
 * Render the Dark IDE surface Code & Trace Inspector with Backend/Frontend/Diff tabs,
 * live @step glow highlighting, manual source refresh, and step playback controls.
 *
 * @param props - Active lab, source files, playback state, and inspector callbacks.
 * @returns Rendered CodeInspector panel.
 */
export function CodeInspector({
  lab,
  mode,
  activeTab,
  source,
  sourceError,
  isRefreshing,
  totalSteps,
  activeIndex,
  activeStep,
  playbackStatus,
  onChangeTab,
  onRefreshSource,
  onPrevStep,
  onReplayTrace,
  onNextStep,
}: CodeInspectorProps): JSX.Element {
  const target = resolveStepTarget(activeStep, source, mode);
  const targetTab = target?.tab ?? null;
  const activeTabRef = useRef<InspectorTab>(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    if (targetTab && activeTabRef.current !== 'diff') {
      onChangeTab(targetTab);
    }
  }, [targetTab, activeStep?.step, onChangeTab]);

  const view = buildInspectorView(activeTab, mode, source, target);
  const hasFrontendSource = view.frontendFile !== null;
  const activeFileLabel = resolveFileLabel(view, Boolean(source?.frontend_diff));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700 bg-[var(--bg-ide-header)] px-3 py-2">
        <div role="tablist" aria-label="Chế độ xem mã nguồn" className="flex items-center gap-1">
          {TAB_ITEMS.map((item) => {
            const isSelected = activeTab === item.id;
            const isDisabled = item.id === 'frontend' && !hasFrontendSource;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                disabled={isDisabled}
                onClick={() => onChangeTab(item.id)}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span
            className="hidden text-[11px] text-slate-400 sm:inline"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {activeFileLabel}
          </span>
          <button
            type="button"
            onClick={onRefreshSource}
            disabled={!lab || isRefreshing}
            title="Đọc lại mã nguồn mới nhất từ đĩa"
            aria-label="Làm mới mã nguồn"
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <div className="vvwa-ide-scroll min-h-0 flex-1 overflow-auto">
        {renderInspectorBody(view, source, sourceError, target, activeStep)}
      </div>

      <TraceControls
        totalSteps={totalSteps}
        activeIndex={activeIndex}
        status={playbackStatus}
        safetyPattern={lab?.safetyPattern ?? null}
        onPrev={onPrevStep}
        onReplay={onReplayTrace}
        onNext={onNextStep}
      />
    </div>
  );
}
