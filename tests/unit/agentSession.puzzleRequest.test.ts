import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgentStore,
  emptyAgentSession,
  requestPuzzle,
  puzzleGenerationFailed,
  type AgentStore,
} from '@/state/agentSession';

/**
 * The Tools -> UI seam for puzzle generation (003/R1).
 *
 * THE PROBLEM THIS SOLVES. `requestPuzzle()` lives in `src/ui/puzzleLoader.ts`
 * because `Worker` is a browser API, and `src/tools -> src/ui` is a LINT ERROR,
 * not a convention. `load_technique_practice` never hit this wall because a
 * drill is a bundled constant dispatched straight into the store;
 * `switch_difficulty` is the first tool that needs a GENERATED puzzle.
 *
 * The answer reuses the seam that already exists rather than inventing one.
 * `requestDisconnect` runs in exactly this shape with the arrow reversed: the
 * learner's Disconnect button raises a counter, the registry watches it, and the
 * button imports nothing from the Tools layer.
 *
 * Everything here must work with NO DOM, because that is the whole point of the
 * seam being in the state layer.
 */

let store: AgentStore;

beforeEach(() => {
  store = createAgentStore(emptyAgentSession());
});

describe('the puzzle-request seam', () => {
  it('runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it('starts with no request outstanding', () => {
    expect(store.getState().puzzleRequest).toBeNull();
    expect(store.getState().puzzleRequests).toBe(0);
  });

  it('raises a monotonic counter a subscriber can observe', () => {
    let seen = 0;
    store.subscribe(() => { seen = store.getState().puzzleRequests; });

    store.dispatch(requestPuzzle({ difficulty: 'hard' }));
    expect(seen).toBe(1);
    expect(store.getState().puzzleRequest).toEqual({ difficulty: 'hard', id: 1 });

    store.dispatch(requestPuzzle({ difficulty: 'easy' }));
    expect(seen).toBe(2);
    expect(store.getState().puzzleRequest).toEqual({ difficulty: 'easy', id: 2 });
  });

  it('carries the difficulty the agent asked for', () => {
    store.dispatch(requestPuzzle({ difficulty: 'medium' }));
    expect(store.getState().puzzleRequest!.difficulty).toBe('medium');
  });

  /*
    FR-036: the agent must be told the attempt FAILED, not merely time out.
    `puzzleLoader` gives up silently after exhausting its retry budget, so
    without this signal `switch_difficulty` could only ever fail by waiting.
  */
  it('reports a generation failure a subscriber can observe', () => {
    store.dispatch(requestPuzzle({ difficulty: 'hard' }));

    let failures = 0;
    store.subscribe(() => { failures = store.getState().puzzleFailures; });

    store.dispatch(puzzleGenerationFailed());
    expect(failures).toBe(1);
  });

  it('keeps failures monotonic too, so a later failure is distinguishable', () => {
    store.dispatch(puzzleGenerationFailed());
    store.dispatch(puzzleGenerationFailed());
    expect(store.getState().puzzleFailures).toBe(2);
  });
});
