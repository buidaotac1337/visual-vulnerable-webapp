import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';

import {
  CodeInspector,
  LabWorkspace,
  SandboxPane,
  TopControlBar,
  WorkspaceModals,
} from '@/components';
import {
  useLabWorkspace,
  useLearningProgress,
  useTraceShortcuts,
  useWorkspaceLayout,
} from '@/hooks';
import type { LabWorkspaceController, LearningProgressController } from '@/hooks';
import {
  computePipelineNodes,
  isFrontendVerifyTest,
  rowIndexForSideStep,
  sideIndexAtRow,
} from '@/lib';
import type { TraceStep } from '@/types';

interface PipelineView {
  trace: readonly TraceStep[];
  activeIndex: number;
  onSelectStep: (index: number) => void;
}

/** In Song song, FlowPipeline follows the vulnerable side the sandbox renders (ADR-0010). */
function usePipelineView(ws: LabWorkspaceController): PipelineView {
  const { trace, activeIndex, jumpToStep } = ws.playback;
  const compare = ws.viewMode === 'compare' ? ws.compareResult : null;
  return useMemo<PipelineView>(() => {
    if (!compare) {
      return { trace, activeIndex, onSelectStep: jumpToStep };
    }
    return {
      trace: compare.vulnerable.trace,
      activeIndex: sideIndexAtRow(compare.rows, activeIndex, 'vulnerable'),
      onSelectStep: (index) => jumpToStep(rowIndexForSideStep(compare.rows, 'vulnerable', index)),
    };
  }, [compare, trace, activeIndex, jumpToStep]);
}

function useProgressMilestoneSync(
  ws: LabWorkspaceController,
  progress: LearningProgressController,
): void {
  const { markExploredVulnerable, markComparedSecure, markViewedDiff, markPassedVerify } = progress;

  useEffect(() => {
    if (!ws.lastResponse || !ws.lastResponse.ok) {
      return;
    }
    const { lab_id: labId, mode } = ws.lastResponse.meta;
    if (mode === 'vulnerable') {
      markExploredVulnerable(labId);
    } else {
      markComparedSecure(labId);
    }
  }, [ws.lastResponse, markExploredVulnerable, markComparedSecure]);

  useEffect(() => {
    if (ws.activeTab === 'diff' && ws.selectedLab) {
      markViewedDiff(ws.selectedLab.id);
    }
  }, [ws.activeTab, ws.selectedLab, markViewedDiff]);

  useEffect(() => {
    if (ws.compareResult) {
      markComparedSecure(ws.compareResult.labId);
    }
  }, [ws.compareResult, markComparedSecure]);

  useEffect(() => {
    if (ws.verifyResult?.passed) {
      markPassedVerify(ws.verifyResult.lab_id);
    }
  }, [ws.verifyResult, markPassedVerify]);
}

/**
 * Root VVWA Dual-Surface Pedagogy application shell connecting the workspace
 * controller to TopControlBar, SandboxPane, CodeInspector, and WorkspaceModals.
 *
 * @returns Rendered root VVWA application element.
 */
export function App(): JSX.Element {
  const ws = useLabWorkspace();
  const layout = useWorkspaceLayout();
  const progress = useLearningProgress();
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState<boolean>(false);
  const [glossaryTermId, setGlossaryTermId] = useState<string | null>(null);

  useProgressMilestoneSync(ws, progress);

  const openCatalog = useCallback((): void => setIsCatalogOpen(true), []);
  const closeCatalog = useCallback((): void => setIsCatalogOpen(false), []);
  const openGlossary = useCallback((termId?: string): void => {
    setGlossaryTermId(termId ?? null);
    setIsGlossaryOpen(true);
  }, []);
  const openGlossaryRoot = useCallback((): void => openGlossary(), [openGlossary]);
  const closeGlossary = useCallback((): void => {
    setIsGlossaryOpen(false);
    setGlossaryTermId(null);
  }, []);

  const { setActiveTab, handleResetDb, handleVerify, handleDownloadSnippet, refreshSource } = ws;
  const openDiffTab = useCallback((): void => setActiveTab('diff'), [setActiveTab]);
  const onResetDb = useCallback((): void => {
    void handleResetDb();
  }, [handleResetDb]);
  const onVerify = useCallback((): void => {
    void handleVerify();
  }, [handleVerify]);
  const onDownloadSnippet = useCallback((): void => {
    void handleDownloadSnippet();
  }, [handleDownloadSnippet]);
  const onRefreshSource = useCallback((): void => {
    void refreshSource();
  }, [refreshSource]);

  useTraceShortcuts({
    enabled: !(ws.isVerifyModalOpen || isCatalogOpen || isGlossaryOpen),
    hasTrace: ws.playback.trace.length > 0,
    onPrev: ws.playback.prevStep,
    onNext: ws.playback.nextStep,
    onTogglePlayPause: ws.playback.togglePlayPause,
  });

  const pipeline = usePipelineView(ws);
  const { status } = ws.playback;
  const pipelineNodes = useMemo(
    () => computePipelineNodes(pipeline.trace, pipeline.activeIndex, status !== 'idle'),
    [pipeline.trace, pipeline.activeIndex, status],
  );
  const hasFrontendTests = ws.selectedLab?.verifyTests.some(isFrontendVerifyTest) ?? false;
  const passedLabsCount = useMemo(() => progress.countPassedLabs(ws.labs), [progress, ws.labs]);
  const selectedProgress = ws.selectedLab ? progress.getLabProgress(ws.selectedLab.id) : undefined;

  return (
    // lg:h-screen: a fixed-height root (not just min-h-screen) is what lets the two
    // workspace columns scroll on their own instead of the whole page growing.
    <div className="flex min-h-screen flex-col lg:h-screen">
      <TopControlBar
        health={ws.health}
        apiError={ws.apiError}
        labs={ws.labs}
        selectedLab={ws.selectedLab}
        mode={ws.viewMode}
        modeOutcomes={ws.modeOutcomes}
        layoutMode={layout.layoutMode}
        passedLabsCount={passedLabsCount}
        isResettingDb={ws.isResettingDb}
        isVerifying={ws.isVerifying}
        isDownloading={ws.isDownloading}
        onSelectLab={ws.selectLab}
        onChangeMode={ws.changeMode}
        onChangeLayoutMode={layout.setLayoutMode}
        onOpenCatalog={openCatalog}
        onOpenGlossary={openGlossaryRoot}
        onResetDb={onResetDb}
        onVerify={onVerify}
        onDownloadSnippet={onDownloadSnippet}
      />

      <LabWorkspace
        mode={ws.mode}
        notice={ws.notice}
        layoutMode={layout.layoutMode}
        splitPercent={layout.splitPercent}
        isFloatingCollapsed={layout.isFloatingCollapsed}
        onChangeSplit={layout.setSplitPercent}
        onResetSplit={layout.resetSplit}
        onToggleFloatingCollapsed={layout.toggleFloatingCollapsed}
        onChangeLayoutMode={layout.setLayoutMode}
        leftPane={
          <SandboxPane
            isLoadingLabs={ws.isLoadingLabs}
            lab={ws.selectedLab}
            mode={ws.mode}
            isCompare={ws.viewMode === 'compare'}
            activeTab={ws.activeTab}
            hasFrontendSink={hasFrontendTests}
            actors={ws.actors}
            actor={ws.actor}
            payload={ws.payload}
            inputFlashSeq={ws.inputFlashSeq}
            dbResetSeq={ws.dbResetSeq}
            isExecuting={ws.isExecuting}
            lastRequest={ws.lastRequest}
            lastResponse={ws.lastResponse}
            pipelineNodes={pipelineNodes}
            trace={pipeline.trace}
            activeTraceIndex={pipeline.activeIndex}
            playbackStatus={ws.playback.status}
            playbackSpeed={ws.playback.speed}
            showWelcomeBanner={!progress.onboardingDismissed && ws.selectedLab !== null}
            labProgress={selectedProgress}
            onPayloadChange={ws.updatePayload}
            onChangeActor={ws.changeActor}
            onSelectSamplePayload={ws.applySamplePayload}
            onExecute={ws.executeAction}
            onSelectPipelineLayer={ws.selectPipelineLayer}
            onSelectPipelineStep={pipeline.onSelectStep}
            onDismissWelcome={progress.dismissOnboarding}
            onOpenCatalog={openCatalog}
            onOpenGlossary={openGlossary}
            onSwitchMode={ws.changeMode}
            onOpenDiff={openDiffTab}
            onOpenVerify={onVerify}
          />
        }
        rightPane={
          <CodeInspector
            lab={ws.selectedLab}
            mode={ws.mode}
            activeTab={ws.activeTab}
            source={ws.source}
            sourceError={ws.sourceError}
            isRefreshing={ws.isRefreshingSource}
            totalSteps={ws.playback.trace.length}
            activeIndex={ws.playback.activeIndex}
            activeStep={ws.playback.activeStep}
            playbackStatus={ws.playback.status}
            traceSteps={ws.playback.trace}
            playbackSpeed={ws.playback.speed}
            onChangeTab={ws.setActiveTab}
            onRefreshSource={onRefreshSource}
            onPrevStep={ws.playback.prevStep}
            onReplayTrace={ws.playback.replay}
            onTogglePlayPause={ws.playback.togglePlayPause}
            onNextStep={ws.playback.nextStep}
            onChangeSpeed={ws.playback.setSpeed}
            onJumpToStep={ws.playback.jumpToStep}
            isCompare={ws.viewMode === 'compare'}
            compareResult={ws.compareResult}
          />
        }
      />

      <WorkspaceModals
        ws={ws}
        progress={progress}
        hasFrontendTests={hasFrontendTests}
        isCatalogOpen={isCatalogOpen}
        isGlossaryOpen={isGlossaryOpen}
        glossaryTermId={glossaryTermId}
        onOpenDiff={openDiffTab}
        onCloseCatalog={closeCatalog}
        onCloseGlossary={closeGlossary}
      />
    </div>
  );
}
