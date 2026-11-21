/** Public barrel exports for frontend API clients, trace engine, and utilities. */
export {
  ACTOR_HEADER,
  ApiRequestError,
  downloadLabSnippet,
  executeLabAction,
  fetchHealth,
  fetchLabs,
  fetchLabSource,
  resetDatabase,
  triggerBlobDownload,
  verifyLab,
} from './api';
export { parseUnifiedDiff } from './diffParser';
export { tokenizeCodeAsync, tokenizeCodeSyncFallback } from './highlighter';
export { getLazyLabView, hasLabView } from './labRegistry';
export {
  computePipelineNodes,
  findFirstStepIndexForLayer,
  mergeExecutionTrace,
  resolveStepTarget,
} from './traceEngine';
