'use client';

import { generatePuzzle } from '@/engine/generate';
import { beginGenerating, loadPuzzle } from '@/state/actions';
import { agentStore, puzzleGenerationFailed } from '@/state/agentSession';
import { store } from '@/state/store';
import type { Difficulty } from '@/state/types';
import type { GenerateWorkerRequest, GenerateWorkerResponse } from '@/workers/generate.worker';

/**
 * Requests a puzzle off the main thread, falling back to synchronous generation
 * where Workers are unavailable. Correctness is identical either way; only
 * smoothness differs (research.md R5).
 *
 * `Worker` is a browser API, so this orchestration lives in the UI layer -- the
 * state layer must stay DOM-free so feature 002 can drive it headlessly.
 */

let worker: Worker | null = null;
let workerUnavailable = false;
let latestRequestId = 0;

function getWorker(): Worker | null {
  if (workerUnavailable) return null;
  if (worker) return worker;

  try {
    worker = new Worker(new URL('../workers/generate.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('error', () => {
      workerUnavailable = true;
      worker = null;
    });
    return worker;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

const MAX_RETRIES = 3;
const retriesFor = new Map<number, number>();

/**
 * Exhausting the attempt budget is vanishingly rare but not impossible, and
 * leaving the board blank forever is the worst possible response. Retry with a
 * fresh seed rather than stranding the player.
 */
function retry(difficulty: Difficulty, seed: number, requestId: number): void {
  const used = retriesFor.get(requestId) ?? 0;
  if (used >= MAX_RETRIES) {
    retriesFor.delete(requestId);
    // 003/FR-036: giving up SILENTLY left `switch_difficulty` able to fail only
    // by timing out. The agent must be told the attempt failed, so the learner's
    // board is explicitly reported as untouched rather than merely unchanged.
    agentStore.dispatch(puzzleGenerationFailed());
    return;
  }
  retriesFor.set(requestId, used + 1);
  requestPuzzle(difficulty, (seed + 0x9e3779b9) >>> 0);
}

export function requestPuzzle(difficulty: Difficulty, seed = Date.now() >>> 0): void {
  store.dispatch(beginGenerating(difficulty));

  const requestId = ++latestRequestId;
  const active = getWorker();

  if (!active) {
    const result = generatePuzzle({ difficulty, seed });
    if (result.ok) store.dispatch(loadPuzzle(result.puzzle));
    else retry(difficulty, seed, requestId);
    return;
  }

  const onMessage = (event: MessageEvent<GenerateWorkerResponse>) => {
    // Ignore results for superseded requests, so rapid difficulty switching
    // never puts a stale board on screen (spec edge case).
    if (event.data.requestId !== latestRequestId) return;
    active.removeEventListener('message', onMessage);
    if (event.data.ok) store.dispatch(loadPuzzle(event.data.puzzle));
    else retry(difficulty, seed, requestId);
  };

  active.addEventListener('message', onMessage);
  active.postMessage({ difficulty, seed, requestId } satisfies GenerateWorkerRequest);
}
