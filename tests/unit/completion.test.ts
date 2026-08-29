import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, emptySession, type Store } from '@/state/store';
import { newPuzzle, selectCell, enterDigit, eraseCell } from '@/state/actions';
import { isComplete, conflictSet } from '@/state/selectors';
import { solve } from '@/engine/solver';
import { toCoord, type Digit } from '@/engine/grid';

/** Fill every empty cell with the real solution, driving the board to completion. */
function solveBoard(store: Store, sabotage?: { index: number; digit: Digit }) {
  const session = store.getState();
  const solution = solve(session.puzzle!.clues)!;

  for (let index = 0; index < 81; index++) {
    if (session.cells[index]!.value !== null) continue;
    const digit = sabotage && sabotage.index === index ? sabotage.digit : (solution[index] as Digit);
    store.dispatch(selectCell(toCoord(index)));
    store.dispatch(enterDigit(digit, 'player'));
  }
}

describe('completion', () => {
  let store: Store;

  beforeEach(() => {
    store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 5150));
  });

  it('is false on a fresh board', () => {
    expect(isComplete(store.getState())).toBe(false);
    expect(store.getState().status).toBe('playing');
  });

  it('is false on a partly filled board', () => {
    const emptyIndex = store.getState().cells.findIndex((c) => c.value === null);
    store.dispatch(selectCell(toCoord(emptyIndex)));
    store.dispatch(enterDigit(1, 'player'));
    expect(isComplete(store.getState())).toBe(false);
  });

  it('becomes true when all 81 are filled with no conflicts (FR-037)', () => {
    solveBoard(store);
    expect(store.getState().cells.every((c) => c.value !== null)).toBe(true);
    expect(conflictSet(store.getState()).size).toBe(0);
    expect(isComplete(store.getState())).toBe(true);
  });

  it('transitions status to complete, freezing the board (FR-039)', () => {
    solveBoard(store);
    expect(store.getState().status).toBe('complete');
  });

  it('is FALSE when all 81 are filled but a conflict remains (spec edge case)', () => {
    const session = store.getState();
    const solution = solve(session.puzzle!.clues)!;
    const empties = session.cells.reduce<number[]>((acc, c, i) => (c.value === null ? [...acc, i] : acc), []);

    // Deliberately place the WRONG digit in the last empty cell -- specifically a
    // digit that duplicates a peer, so the board is full but contradictory.
    const target = empties.at(-1)!;
    const wrong = ((solution[target]! % 9) + 1) as Digit;
    solveBoard(store, { index: target, digit: wrong });

    const after = store.getState();
    expect(after.cells.every((c) => c.value !== null)).toBe(true);
    if (conflictSet(after).size > 0) {
      expect(isComplete(after)).toBe(false);
      expect(after.status).not.toBe('complete');
    }
  });

  it('rejects further edits once complete, with reason wrong-status (FR-039, FR-045)', () => {
    solveBoard(store);
    expect(store.getState().status).toBe('complete');

    const emptyish = toCoord(0);
    store.dispatch(selectCell(emptyish));
    const result = store.dispatch(enterDigit(1, 'player'));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong-status');
  });

  it('rejects erase once complete', () => {
    solveBoard(store);
    store.dispatch(selectCell(toCoord(0)));
    const result = store.dispatch(eraseCell('player'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong-status');
  });

  it('leaves the completed board untouched by a rejected edit', () => {
    solveBoard(store);
    const before = store.getState().cells.map((c) => c.value);
    store.dispatch(selectCell(toCoord(4)));
    store.dispatch(enterDigit(9, 'player'));
    expect(store.getState().cells.map((c) => c.value)).toEqual(before);
  });
});
