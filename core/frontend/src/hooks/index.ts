/** Public barrel exports for VVWA workspace and trace playback hooks. */
export {
  COLOR_MODE_STORAGE_KEY,
  DEFAULT_COLOR_MODE,
  resolveColorMode,
  useColorMode,
} from './useColorMode';
export type { ColorModeController, ColorModePreference, ResolvedColorMode } from './useColorMode';
export { useLabActor } from './useLabActor';
export type { LabActorState } from './useLabActor';
export { useLabCatalog } from './useLabCatalog';
export type { LabCatalogState } from './useLabCatalog';
export { useLabMaintenance } from './useLabMaintenance';
export type { LabMaintenanceController } from './useLabMaintenance';
export { useLabSourceSync } from './useLabSourceSync';
export { useLabVerify } from './useLabVerify';
export type { LabVerifyController } from './useLabVerify';
export type { LabSourceSyncState } from './useLabSourceSync';
export { useLabWorkspace } from './useLabWorkspace';
export type { LabWorkspaceController } from './labWorkspaceController';
export { useCompareRun } from './useCompareRun';
export type { CompareCall, CompareRunController, CompareRunDeps } from './useCompareRun';
export { useModeOutcomes } from './useModeOutcomes';
export type { ModeOutcomesState } from './useModeOutcomes';
export { useTracePlayback } from './useTracePlayback';
export type { TracePlaybackController } from './useTracePlayback';
export { useTraceShortcuts } from './useTraceShortcuts';
export type { UseTraceShortcutsOptions } from './useTraceShortcuts';
export { useWorkspaceLayout } from './useWorkspaceLayout';
export type { WorkspaceLayoutController } from './useWorkspaceLayout';
export { useLearningProgress } from './useLearningProgress';
export type { LabStepProgress, LearningProgressController } from './useLearningProgress';
