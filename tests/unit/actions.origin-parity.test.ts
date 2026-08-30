import { describe, it, expect } from 'vitest';
import { createStore, emptySession, type Store } from '@/state/store';
import { newPuzzle, loadPuzzle, enterDigitAt, undo } from '@/state/actions';
import { toCoord, toIndex } from '@/engine/grid';
import type { CellOrigin } from '@/state/types';

/**
 * FR-042 and SC-005: "Every agent change MUST be recorded as an undoable step
 * indistinguishable in operation from a learner's own, so a single undo reverses
 * it."
 *
 * Feature 001 made this true by CONSTRUCTION rather than by retrofit: `origin`
 * has been a parameter on every mutating action since the first slice, and undo
 * makes no distinction by it. This test is the proof, and it is written the way
 * the claim is stated -- run the identical sequence twice, differing ONLY in
 * origin, and assert the results are indistinguishable.
 */

/**
 * ONE puzzle, loaded into both stores.
 *
 * Not two `newPuzzle` calls with the same seed: `sudoku-gen` exposes no seed and
 * draws from its own randomness, so the seed selects a BAND, not a board (001
 * research R4). Reproducibility comes from recording the puzzle, which is
 * exactly what this does.
 */
const sharedPuzzle = (() => {
  const store = createStore(emptySession());
  store.dispatch(newPuzzle('easy', 90210));
  return store.getState().puzzle!;
})();

function playSequence(origin: CellOrigin): {
  afterWrites: string;
  afterUndos: string;
  depth: number;
} {
  const store: Store = createStore(emptySession());
  store.dispatch(loadPuzzle(sharedPuzzle));

  const empties = store
    .getState()
    .cells.map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell.value === null)
    .slice(0, 5)
    .map(({ index }) => toCoord(index));

  for (const [i, coord] of empties.entries()) {
    store.dispatch(enterDigitAt(coord, ((i % 9) + 1) as 1, origin));
  }

  const serialise = (s: Store) =>
    JSON.stringify(
      s.getState().cells.map((c) => ({ value: c.value, candidates: [...c.candidates].sort() })),
    );

  const afterWrites = serialise(store);
  const depth = store.getState().history.length;

  for (let i = 0; i < empties.length; i++) store.dispatch(undo());

  return { afterWrites, afterUndos: serialise(store), depth };
}

describe('an agent move and a human move are the same move', () => {
  const player = playSequence('player');
  const agent = playSequence('agent');

  it('produces the same board, cell for cell', () => {
    expect(agent.afterWrites).toBe(player.afterWrites);
  });

  it('produces the same number of undo steps', () => {
    expect(agent.depth).toBe(player.depth);
    expect(agent.depth).toBe(5);
  });

  it('undoes to the same board, cell for cell', () => {
    expect(agent.afterUndos).toBe(player.afterUndos);
  });

  it('one undo reverses exactly one agent change (SC-005)', () => {
    const store = createStore(emptySession());
    store.dispatch(loadPuzzle(sharedPuzzle));

    const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
    store.dispatch(enterDigitAt(coord, 7, 'agent'));
    expect(store.getState().cells[toIndex(coord)]!.value).toBe(7);

    expect(store.dispatch(undo())).toEqual({ ok: true, changed: true });
    expect(store.getState().cells[toIndex(coord)]!.value).toBeNull();
  });

  it('undo does not care who made the change, even when they interleave', () => {
    // A learner correcting an agent, and an agent correcting a learner: the
    // stack is one stack, and it unwinds in order regardless of authorship.
    const store = createStore(emptySession());
    store.dispatch(loadPuzzle(sharedPuzzle));

    const [a, b, c] = store
      .getState()
      .cells.map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell.value === null)
      .slice(0, 3)
      .map(({ index }) => toCoord(index));

    store.dispatch(enterDigitAt(a!, 1, 'player'));
    store.dispatch(enterDigitAt(b!, 2, 'agent'));
    store.dispatch(enterDigitAt(c!, 3, 'player'));

    store.dispatch(undo()); // removes the learner's
    expect(store.getState().cells[toIndex(c!)]!.value).toBeNull();
    store.dispatch(undo()); // removes the agent's
    expect(store.getState().cells[toIndex(b!)]!.value).toBeNull();
    store.dispatch(undo()); // removes the learner's
    expect(store.getState().cells[toIndex(a!)]!.value).toBeNull();

    expect(store.dispatch(undo())).toEqual({ ok: false, reason: 'nothing-to-undo' });
  });

  it('records authorship even though it does not act on it', () => {
    // Undo ignores origin; RENDERING does not (FR-044). Both must be true.
    const store = createStore(emptySession());
    store.dispatch(loadPuzzle(sharedPuzzle));
    const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));

    store.dispatch(enterDigitAt(coord, 7, 'agent'));
    expect(store.getState().cells[toIndex(coord)]!.origin).toBe('agent');
  });
});
