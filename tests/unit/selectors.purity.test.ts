import { describe, it, expect } from 'vitest';
import { createStore, emptySession } from '@/state/store';
import { newPuzzle, selectCell, enterDigit } from '@/state/actions';
import { crosshairSet, matchingSet, highlightTier } from '@/state/selectors';

/**
 * FR-010: "Highlighting MUST be passive: it MUST NOT alter cell values, notes,
 * elapsed time, undo history, or completion state."
 */
describe('highlighting is passive', () => {
  it('changes no cell, no timer, and no history when the selection moves', () => {
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 77));

    const emptyIndex = store.getState().cells.findIndex((c) => c.value === null);
    store.dispatch(selectCell({ row: Math.floor(emptyIndex / 9) + 1, col: (emptyIndex % 9) + 1 }));
    store.dispatch(enterDigit(5, 'player'));

    const before = store.getState();
    const cellsBefore = before.cells.map((c) => ({ value: c.value, origin: c.origin, notes: [...c.candidates] }));

    // Move the selection all over the board.
    for (let row = 1; row <= 9; row++) {
      for (let col = 1; col <= 9; col++) {
        store.dispatch(selectCell({ row, col }));
        crosshairSet(store.getState());
        matchingSet(store.getState());
        highlightTier(store.getState(), (row - 1) * 9 + (col - 1));
      }
    }

    const after = store.getState();
    expect(after.cells.map((c) => ({ value: c.value, origin: c.origin, notes: [...c.candidates] }))).toEqual(cellsBefore);
    expect(after.elapsedMs).toBe(before.elapsedMs);
    expect(after.history).toBe(before.history);
    expect(after.status).toBe(before.status);
    expect(after.puzzle).toBe(before.puzzle);
  });

  it('computes selectors without mutating the session object', () => {
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 88));
    store.dispatch(selectCell({ row: 3, col: 3 }));

    const session = store.getState();
    const snapshot = JSON.stringify(session, (_k, v) => (v instanceof Set ? [...v] : v));

    crosshairSet(session);
    matchingSet(session);

    expect(JSON.stringify(session, (_k, v) => (v instanceof Set ? [...v] : v))).toBe(snapshot);
  });

  it('is deterministic — same session, same result', () => {
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('medium', 99));
    store.dispatch(selectCell({ row: 2, col: 7 }));

    const session = store.getState();
    expect([...crosshairSet(session)]).toEqual([...crosshairSet(session)]);
    expect([...matchingSet(session)]).toEqual([...matchingSet(session)]);
  });
});
