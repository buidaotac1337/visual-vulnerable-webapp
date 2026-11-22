import type { JSX } from 'react';

import { resolveFrontendFile, resolveStepTarget } from '@/lib';
import type { ResolvedFrontendFile } from '@/lib';
import type {
  InspectorTab,
  LabMetadata,
  LabMode,
  LabSourceResponse,
  PlaybackStatus,
  StepHighlightTarget,
  TracePlaybackSpeed,
  TraceStep,
} from '@/types';

import { CodeSnippetView } from './CodeSnippetView';
import { InspectorHeader } from './InspectorHeader';
import { TraceControls } from './TraceControls';
import { UnifiedDiffView } from './UnifiedDiffView';
import { useStepTabSwitch } from './useStepTabSwitch';

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
  traceSteps?: readonly TraceStep[];
  playbackSpeed?: TracePlaybackSpeed;
  onChangeTab: (tab: InspectorTab) => void;
  onRefreshSource: () => void;
  onPrevStep: () => void;
  onReplayTrace: () => void;
  onTogglePlayPause?: () => void;
  onNextStep: () => void;
  onChangeSpeed?: (speed: TracePlaybackSpeed) => void;
  onJumpToStep?: (index: number) => void;
}

interface InspectorView {
  activeTab: InspectorTab;
  mode: LabMode;
  frontendFile: ResolvedFrontendFile | null;
}

function renderDiffTab(source: LabSourceResponse): JSX.Element {
  if (source.frontend_diff == null) {
    return <UnifiedDiffView diff={source.diff} />;
  }
  return (
    <div>
      <h3 className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Backend: vulnerable.py ↔ secure.py
      </h3>
      <UnifiedDiffView diff={source.diff} />
      <h3 className="border-t border-slate-700 px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
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
      <div className="m-4 rounded-lg border border-danger-500/40 bg-danger-950/50 p-4 text-xs text-danger-200">
        {sourceError}
      </div>
    );
  }
  if (!source) {
    return (
      <p className="p-6 text-sm text-slate-300">
        Chọn một bài lab để xem mã nguồn. Khi bạn gửi request, dòng code của từng bước trace sẽ sáng
        lên tại đây.
      </p>
    );
  }
  if (view.activeTab === 'diff') {
    return renderDiffTab(source);
  }
  return renderSnippetForTab(view, source, target, activeStep);
}

/** Live region for automatic tab switches; always mounted so the first note is announced. */
function TabSwitchNote({ note }: { note: string | null }): JSX.Element {
  return (
    <p
      role="status"
      className={
        note
          ? 'shrink-0 border-b border-slate-700 bg-brand-950/60 px-3 py-1 text-xs text-brand-200'
          : 'sr-only'
      }
    >
      {note ?? ''}
    </p>
  );
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
  traceSteps,
  playbackSpeed,
  onChangeTab,
  onRefreshSource,
  onPrevStep,
  onReplayTrace,
  onTogglePlayPause,
  onNextStep,
  onChangeSpeed,
  onJumpToStep,
}: CodeInspectorProps): JSX.Element {
  const target = resolveStepTarget(activeStep, source, mode);
  const { note: tabNote, pickTab } = useStepTabSwitch(
    target?.tab ?? null,
    activeStep?.step,
    activeTab,
    onChangeTab,
  );
  const view = buildInspectorView(activeTab, mode, source, target);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <InspectorHeader
        activeTab={activeTab}
        mode={mode}
        frontendFileLabel={view.frontendFile?.label ?? null}
        hasFrontendDiff={source?.frontend_diff != null}
        canRefresh={lab !== null}
        isRefreshing={isRefreshing}
        onSelectTab={pickTab}
        onRefreshSource={onRefreshSource}
      />
      <TabSwitchNote note={tabNote} />
      <div className="vvwa-ide-scroll min-h-0 flex-1 overflow-auto">
        {renderInspectorBody(view, source, sourceError, target, activeStep)}
      </div>
      <TraceControls
        totalSteps={totalSteps}
        activeIndex={activeIndex}
        status={playbackStatus}
        safetyPattern={lab?.safetyPattern ?? null}
        steps={traceSteps}
        speed={playbackSpeed}
        onPrev={onPrevStep}
        onReplay={onReplayTrace}
        onTogglePlayPause={onTogglePlayPause}
        onNext={onNextStep}
        onChangeSpeed={onChangeSpeed}
        onJumpToStep={onJumpToStep}
      />
    </div>
  );
}
