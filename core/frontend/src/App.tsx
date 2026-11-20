import type { JSX } from 'react';

import { CodeInspector, LabWorkspace, SandboxPane, TopControlBar, VerifyModal } from '@/components';
import { useLabWorkspace } from '@/hooks';
import { computePipelineNodes } from '@/lib';

/**
 * Root VVWA Dual-Surface Pedagogy application shell connecting the workspace
 * controller to TopControlBar, SandboxPane, CodeInspector, and VerifyModal.
 *
 * @returns Rendered root VVWA application element.
 */
export function App(): JSX.Element {
  const ws = useLabWorkspace();
  const pipelineNodes = computePipelineNodes(
    ws.playback.trace,
    ws.playback.activeIndex,
    ws.playback.status === 'playing' || ws.playback.status === 'paused',
  );

  return (
    <div className="flex min-h-screen flex-col">
      <TopControlBar
        health={ws.health}
        apiError={ws.apiError}
        labs={ws.labs}
        selectedLab={ws.selectedLab}
        mode={ws.mode}
        isResettingDb={ws.isResettingDb}
        isVerifying={ws.isVerifying}
        isDownloading={ws.isDownloading}
        onSelectLab={ws.selectLab}
        onChangeMode={ws.changeMode}
        onResetDb={() => {
          void ws.handleResetDb();
        }}
        onVerify={() => {
          void ws.handleVerify();
        }}
        onDownloadSnippet={() => {
          void ws.handleDownloadSnippet();
        }}
      />

      <LabWorkspace
        mode={ws.mode}
        notice={ws.notice}
        leftPane={
          <SandboxPane
            isLoadingLabs={ws.isLoadingLabs}
            lab={ws.selectedLab}
            mode={ws.mode}
            payload={ws.payload}
            inputFlashSeq={ws.inputFlashSeq}
            dbResetSeq={ws.dbResetSeq}
            isExecuting={ws.isExecuting}
            lastResponse={ws.lastResponse}
            pipelineNodes={pipelineNodes}
            onPayloadChange={ws.updatePayload}
            onSelectSamplePayload={ws.applySamplePayload}
            onExecute={ws.executeAction}
            onSelectPipelineLayer={ws.selectPipelineLayer}
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
            onChangeTab={ws.setActiveTab}
            onRefreshSource={() => {
              void ws.refreshSource();
            }}
            onPrevStep={ws.playback.prevStep}
            onReplayTrace={ws.playback.replay}
            onNextStep={ws.playback.nextStep}
          />
        }
      />

      <VerifyModal
        isOpen={ws.isVerifyModalOpen}
        labTitle={ws.selectedLab?.title ?? ''}
        isLoading={ws.isVerifying}
        result={ws.verifyResult}
        error={ws.verifyError}
        onRerun={() => {
          void ws.handleVerify();
        }}
        onClose={ws.closeVerifyModal}
      />
    </div>
  );
}
