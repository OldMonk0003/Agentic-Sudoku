import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, enterDigitAt, undo, tick } from '@/state/actions';
import { createPreferencesStore, showRuler, hideRuler } from '@/state/preferences';
import { serialiseSession } from '@/state/persistence';
import { toCoord } from '@/engine/grid';
import type { MemoryStorage } from '@/state/persistence';

/**
 * FR-014: the ruler "MUST NOT alter any cell value, candidate, conflict state,
 * selection, elapsed time, or undo history, and MUST NOT be undoable -- it is a
 * view preference, not a move."
 *
 * This is the test that proves the two stores really are separate. If the ruler
 * ever moves onto GameSession, the undo assertion below is what fails, and it
 * fails loudly: a learner who shows the ruler and then presses Undo expecting
 * their last digit back would instead get their ruler back, which is the whole
 * class of bug FR-014 exists to prevent.
 */

function fakeStorage(): MemoryStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; },
  };
}

const prefs = createPreferencesStore();

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 4242));
  prefs.dispatch(hideRuler());
});

describe('the ruler is isolated from game state', () => {
  it('runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it('leaves the whole game session untouched (FR-014)', () => {
    const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
    store.dispatch(enterDigitAt(coord, 5, 'player'));
    store.dispatch(tick(2500));

    const before = JSON.stringify({
      cells: store.getState().cells.map((c) => ({ v: c.value, o: c.origin, c: [...c.candidates] })),
      elapsedMs: store.getState().elapsedMs,
      history: store.getState().history.length,
      status: store.getState().status,
      selection: store.getState().selection,
    });

    prefs.dispatch(showRuler());
    prefs.dispatch(hideRuler());
    prefs.dispatch(showRuler());

    const after = JSON.stringify({
      cells: store.getState().cells.map((c) => ({ v: c.value, o: c.origin, c: [...c.candidates] })),
      elapsedMs: store.getState().elapsedMs,
      history: store.getState().history.length,
      status: store.getState().status,
      selection: store.getState().selection,
    });

    expect(after).toBe(before);
  });

  it('adds no undo entry', () => {
    const depth = store.getState().history.length;
    prefs.dispatch(showRuler());
    expect(store.getState().history.length).toBe(depth);
  });

  /*
    The load-bearing assertion. On a fresh board there is nothing to undo, so
    showing the ruler and then pressing Undo must STILL report nothing to undo.
    If the ruler were a game action, this would succeed instead.
  */
  it('is not undoable on a fresh board (FR-014)', () => {
    prefs.dispatch(showRuler());
    expect(store.dispatch(undo())).toEqual({ ok: false, reason: 'nothing-to-undo' });
  });

  it('undo after showing the ruler reverses the DIGIT, not the ruler', () => {
    const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
    store.dispatch(enterDigitAt(coord, 7, 'player'));
    prefs.dispatch(showRuler());

    expect(store.dispatch(undo())).toEqual({ ok: true, changed: true });

    const index = (coord.row - 1) * 9 + (coord.col - 1);
    expect(store.getState().cells[index]!.value).toBeNull();
    // The ruler is untouched by the undo -- it was never part of the move.
    expect(prefs.getState().rulerVisible).toBe(true);
  });

  it('never enters the persisted session payload (research.md R2)', () => {
    prefs.dispatch(showRuler());
    const storage = fakeStorage();
    expect(serialiseSession(store.getState(), storage)).toBe(true);

    const raw = storage.data['agentic-sudoku/session']!;
    expect(raw).not.toMatch(/ruler/i);
    expect(Object.keys(JSON.parse(raw))).not.toContain('rulerVisible');
  });
});
