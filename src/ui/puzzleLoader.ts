'use client';

import { generatePuzzle, type GenerateResult } from '@/engine/generate';
import { beginGenerating, loadPuzzle } from '@/state/actions';
import { agentStore, puzzleGenerationFailed } from '@/state/agentSession';
import { store } from '@/state/store';
import type { Puzzle } from '@/engine/types';
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
 *
 * 005: this path now serves a second caller -- a candidate that repeats the grid
 * already on screen. Both mean "that one is no good, go again", and both are
 * bounded by the same budget, so a generator that can only produce the current
 * puzzle cannot spin forever.
 */
function retry(difficulty: Difficulty, seed: number, requestId: number, options: RequestOptions): void {
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
  requestPuzzle(difficulty, { ...options, seed: (seed + 0x9e3779b9) >>> 0, requestId });
}

/**
 * Accept a candidate, or send it back.
 *
 * 005/FR-002 and SC-003: a restart must present a DIFFERENT grid, and before
 * this nothing checked. Repeating a puzzle was already vanishingly unlikely, but
 * the criterion is written as an absolute and this is one string comparison
 * against a value the store already holds.
 *
 * It lives here rather than in the restart tool so that EVERY caller gets it --
 * the learner's difficulty control and the completion banner included.
 */
function accept(
  puzzle: Puzzle,
  difficulty: Difficulty,
  seed: number,
  requestId: number,
  options: RequestOptions,
): void {
  if (puzzle.puzzleString === store.getState().puzzle?.puzzleString) {
    retry(difficulty, seed, requestId, options);
    return;
  }
  retriesFor.delete(requestId);
  store.dispatch(loadPuzzle(puzzle));
}

/** How a puzzle is produced. Injectable so the rejection path above is testable. */
export type Generate = (difficulty: Difficulty, seed: number) => GenerateResult;

export interface RequestOptions {
  readonly seed?: number;
  /**
   * Overrides generation entirely, worker included.
   *
   * Generation is NOT reproducible from a seed -- the seeded PRNG chooses a band
   * and `sudoku-gen` supplies its own randomness within it (Principle IV permits
   * this and records the puzzle rather than the seed). So a repeated grid cannot
   * be arranged by seeding, and injection is the only honest way to test that a
   * repeat is refused. Same seam `createSwitchDifficultyTool` uses.
   */
  readonly generate?: Generate;
  /** Internal: carried across a retry so one request keeps one budget. */
  readonly requestId?: number;
}

export function requestPuzzle(difficulty: Difficulty, options: RequestOptions = {}): void {
  const seed = options.seed ?? (Date.now() >>> 0);
  store.dispatch(beginGenerating(difficulty));

  const requestId = options.requestId ?? ++latestRequestId;
  if (options.requestId === undefined) latestRequestId = requestId;

  // An injected generator runs synchronously and bypasses the worker entirely.
  const active = options.generate ? null : getWorker();

  if (!active) {
    const generate = options.generate ?? ((d, s) => generatePuzzle({ difficulty: d, seed: s }));
    const result = generate(difficulty, seed);
    if (result.ok) accept(result.puzzle, difficulty, seed, requestId, options);
    else retry(difficulty, seed, requestId, options);
    return;
  }

  const onMessage = (event: MessageEvent<GenerateWorkerResponse>) => {
    // Ignore results for superseded requests, so rapid difficulty switching
    // never puts a stale board on screen (spec edge case).
    if (event.data.requestId !== latestRequestId) return;
    active.removeEventListener('message', onMessage);
    if (event.data.ok) accept(event.data.puzzle, difficulty, seed, requestId, options);
    else retry(difficulty, seed, requestId, options);
  };

  active.addEventListener('message', onMessage);
  active.postMessage({ difficulty, seed, requestId } satisfies GenerateWorkerRequest);
}
