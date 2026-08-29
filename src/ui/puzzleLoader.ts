'use client';

import { generatePuzzle } from '@/engine/generate';
import { beginGenerating, loadPuzzle } from '@/state/actions';
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

export function requestPuzzle(difficulty: Difficulty, seed = Date.now() >>> 0): void {
  store.dispatch(beginGenerating(difficulty));

  const requestId = ++latestRequestId;
  const active = getWorker();

  if (!active) {
    const result = generatePuzzle({ difficulty, seed });
    if (result.ok) store.dispatch(loadPuzzle(result.puzzle));
    return;
  }

  const onMessage = (event: MessageEvent<GenerateWorkerResponse>) => {
    // Ignore results for superseded requests, so rapid difficulty switching
    // never puts a stale board on screen (spec edge case).
    if (event.data.requestId !== latestRequestId) return;
    active.removeEventListener('message', onMessage);
    if (event.data.ok) store.dispatch(loadPuzzle(event.data.puzzle));
  };

  active.addEventListener('message', onMessage);
  active.postMessage({ difficulty, seed, requestId } satisfies GenerateWorkerRequest);
}
