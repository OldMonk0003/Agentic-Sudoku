import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, emptySession, type Store } from '@/state/store';
import { newPuzzle, selectCell, enterDigit, tick, pause, resume } from '@/state/actions';
import { solve } from '@/engine/solver';
import { toCoord, type Digit } from '@/engine/grid';

/**
 * The View owns the interval; the store owns the number. That keeps the State
 * layer free of timers (Principle III) and makes elapsed time deterministic here.
 */

function solveBoard(store: Store) {
  const session = store.getState();
  const solution = solve(session.puzzle!.clues)!;
  for (let index = 0; index < 81; index++) {
    if (session.cells[index]!.value !== null) continue;
    store.dispatch(selectCell(toCoord(index)));
    store.dispatch(enterDigit(solution[index] as Digit, 'player'));
  }
}

describe('timer', () => {
  let store: Store;

  beforeEach(() => {
    store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 1618));
  });

  it('starts at zero on a fresh puzzle', () => {
    expect(store.getState().elapsedMs).toBe(0);
  });

  it('accumulates while playing', () => {
    store.dispatch(tick(1000));
    store.dispatch(tick(500));
    expect(store.getState().elapsedMs).toBe(1500);
  });

  it('is REJECTED while paused, so a stopped clock really stops (FR-035)', () => {
    store.dispatch(tick(1000));
    store.dispatch(pause());

    const result = store.dispatch(tick(1000));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong-status');
    expect(store.getState().elapsedMs).toBe(1000);
  });

  it('resumes from where it stopped rather than restarting (FR-035)', () => {
    store.dispatch(tick(252_000)); // 04:12
    store.dispatch(pause());
    store.dispatch(tick(9_000));
    store.dispatch(resume());

    expect(store.getState().elapsedMs).toBe(252_000);
    store.dispatch(tick(1_000));
    expect(store.getState().elapsedMs).toBe(253_000);
  });

  it('is REJECTED once the puzzle is complete (FR-036)', () => {
    solveBoard(store);
    expect(store.getState().status).toBe('complete');

    const result = store.dispatch(tick(1000));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong-status');
  });

  it('resets to zero on a new puzzle', () => {
    store.dispatch(tick(60_000));
    store.dispatch(newPuzzle('easy', 2718));
    expect(store.getState().elapsedMs).toBe(0);
  });

  it('does not touch the board or history', () => {
    const cells = store.getState().cells;
    store.dispatch(tick(5_000));
    expect(store.getState().cells).toBe(cells);
    expect(store.getState().history).toHaveLength(0);
  });
});

describe('pause and resume', () => {
  let store: Store;

  beforeEach(() => {
    store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 1618));
  });

  it('moves between playing and paused', () => {
    store.dispatch(pause());
    expect(store.getState().status).toBe('paused');
    store.dispatch(resume());
    expect(store.getState().status).toBe('playing');
  });

  it('rejects pause when not playing', () => {
    store.dispatch(pause());
    const result = store.dispatch(pause());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong-status');
  });

  it('rejects resume when not paused', () => {
    const result = store.dispatch(resume());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong-status');
  });

  it('blocks cell edits while paused, so the board cannot be solved on a stopped clock', () => {
    const emptyIndex = store.getState().cells.findIndex((c) => c.value === null);
    store.dispatch(selectCell(toCoord(emptyIndex)));
    store.dispatch(pause());

    const result = store.dispatch(enterDigit(5, 'player'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong-status');
    expect(store.getState().cells[emptyIndex]!.value).toBeNull();
  });

  it('cannot pause a completed puzzle (spec edge case)', () => {
    solveBoard(store);
    const result = store.dispatch(pause());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong-status');
  });
});
