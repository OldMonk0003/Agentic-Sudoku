/// <reference lib="webworker" />
import { generatePuzzle, type GenerateRequest, type GenerateResult } from '@/engine/generate';

/**
 * Generation off the main thread.
 *
 * MEASURED, not assumed (research.md R5): hard puzzles cost p95 19.5ms and up to
 * 29ms, which exceeds the 16ms frame budget Principle IV protects. Easy puzzles
 * cost under 1ms and would not need this; hard ones do, so all of it runs here.
 *
 * This module imports the Engine and nothing else -- no state, no UI.
 */

export type GenerateWorkerRequest = GenerateRequest & { readonly requestId: number };
export type GenerateWorkerResponse = GenerateResult & { readonly requestId: number };

self.addEventListener('message', (event: MessageEvent<GenerateWorkerRequest>) => {
  const { requestId, ...request } = event.data;
  const result = generatePuzzle(request);
  (self as unknown as Worker).postMessage({ ...result, requestId } satisfies GenerateWorkerResponse);
});
