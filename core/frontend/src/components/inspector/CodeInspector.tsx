import { memo } from 'react';
import type { JSX } from 'react';

import { resolveFrontendFile, resolveStepTarget } from '@/lib';
import type { ResolvedFrontendFile } from '@/lib';
import type {
  CompareRunResult,
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
import { CompareCodeView } from './CompareCodeView';
import { InspectorDiffTab } from './InspectorDiffTab';
import { InspectorHeader } from './InspectorHeader';
import { TraceControls } from './TraceControls';
import { TraceLegendBar } from './TraceLegendBar';
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
  /** Song song view: the Backend tab shows both files and the aligned trace (ADR-0010). */
  isCompare?: boolean;
  compareResult?: CompareRunResult | null;
}

interface CompareBodyProps {
  isCompare?: boolean;
  result?: CompareRunResult | null;
  activeIndex: number;
  onSelectRow?: (index: number) => void;
}

interface InspectorView {
  activeTab: InspectorTab;
  mode: LabMode;
  frontendFile: ResolvedFrontendFile | null;
}

function resolveFullFilePath(lab: LabMetadata | null, view: InspectorView): string | null {
  if (!lab || view.activeTab === 'diff') {
    return null;
  }
  if (view.activeTab === 'frontend') {
    return view.frontendFile ? `labs/${lab.id}/${view.frontendFile.label}` : null;
  }
  return `labs/${lab.id}/backend/${view.mode}.py`;
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
  lab: LabMetadata | null,
  source: LabSourceResponse | null,
  sourceError: string | null,
  target: StepHighlightTarget | null,
  activeStep: TraceStep | null,
  compare: CompareBodyProps,
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
    return <InspectorDiffTab source={source} labId={lab ? lab.id : null} />;
  }
  if (compare.isCompare === true && view.activeTab === 'backend') {
    return (
      <CompareCodeView
        source={source}
        result={compare.result ?? null}
        activeIndex={compare.activeIndex}
        onSelectRow={compare.onSelectRow}
      />
    );
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
function CodeInspectorInner({
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
  isCompare,
  compareResult,
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
        fullFilePath={resolveFullFilePath(lab, view)}
        onSelectTab={pickTab}
        onRefreshSource={onRefreshSource}
      />
      <TabSwitchNote note={tabNote} />
      <TraceLegendBar hasTrace={totalSteps > 0} activeTab={activeTab} mode={mode} />
      <div className="vvwa-ide-scroll min-h-0 flex-1 overflow-auto">
        {renderInspectorBody(view, lab, source, sourceError, target, activeStep, {
          isCompare,
          result: compareResult,
          activeIndex,
          onSelectRow: onJumpToStep,
        })}
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

/**
 * Memoized Dark IDE surface Code & Trace Inspector with Backend/Frontend/Diff tabs,
 * live @step glow highlighting, manual source refresh, and step playback controls.
 */
export const CodeInspector = memo(CodeInspectorInner);
