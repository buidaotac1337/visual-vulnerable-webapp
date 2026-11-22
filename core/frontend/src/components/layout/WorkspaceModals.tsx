import type { JSX } from 'react';

import type { LabWorkspaceController, LearningProgressController } from '@/hooks';

import { GlossaryModal } from '../guide';
import { LabCatalogModal } from '../learning';
import { VerifyModal } from '../verify';

/** Props for the root modal host bundling Verify, Lab Catalog, and Security Glossary dialogs. */
export interface WorkspaceModalsProps {
  ws: LabWorkspaceController;
  progress: LearningProgressController;
  hasFrontendTests: boolean;
  isCatalogOpen: boolean;
  isGlossaryOpen: boolean;
  glossaryTermId: string | null;
  onOpenDiff: () => void;
  onCloseCatalog: () => void;
  onCloseGlossary: () => void;
}

/**
 * Render the three native `<dialog>` overlays owned by the workspace shell:
 * Test My Fix verification, Learning Path Lab Catalog, and Beginner Security Glossary.
 *
 * @param props - Workspace/progress controllers and dialog open/close handlers.
 * @returns Fragment mounting all workspace dialogs.
 */
export function WorkspaceModals({
  ws,
  progress,
  hasFrontendTests,
  isCatalogOpen,
  isGlossaryOpen,
  glossaryTermId,
  onOpenDiff,
  onCloseCatalog,
  onCloseGlossary,
}: WorkspaceModalsProps): JSX.Element {
  const selectedId = ws.selectedLab?.id ?? null;
  const nextLab = progress.findNextRecommendedLab(ws.labs, selectedId);

  return (
    <>
      <VerifyModal
        isOpen={ws.isVerifyModalOpen}
        labId={ws.selectedLab?.id}
        labTitle={ws.selectedLab?.title ?? ''}
        hasFrontendTests={hasFrontendTests}
        mode={ws.mode}
        isLoading={ws.isVerifying}
        result={ws.verifyResult}
        error={ws.verifyError}
        onRerun={() => {
          void ws.handleVerify();
        }}
        onClose={ws.closeVerifyModal}
        onOpenDiff={onOpenDiff}
        onNextLab={nextLab ? () => ws.selectLab(nextLab.id) : undefined}
        nextLabTitle={nextLab?.title ?? null}
      />

      <LabCatalogModal
        isOpen={isCatalogOpen}
        labs={ws.labs}
        selectedLabId={selectedId}
        getLabProgress={progress.getLabProgress}
        onSelectLab={ws.selectLab}
        onClose={onCloseCatalog}
      />

      <GlossaryModal
        isOpen={isGlossaryOpen}
        initialTermId={glossaryTermId}
        onClose={onCloseGlossary}
      />
    </>
  );
}
