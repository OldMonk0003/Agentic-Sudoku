import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, emptySession, type Store } from '@/state/store';
import {
  newPuzzle, selectCell, enterDigit, eraseCell, toggleCandidate, undo, setInputMode,
} from '@/state/actions';
import { peersOf, toCoord, toIndex, type CellIndex, type Digit } from '@/engine/grid';

/** A snapshot detailed enough that "restored exactly" means something. */
function snapshot(store: Store) {
  return store.getState().cells.map((c) => ({
    value: c.value,
    origin: c.origin,
    candidates: [...c.candidates].sort(),
  }));
}

function findCells(store: Store) {
  const cells = store.getState().cells;
  return {
    clue: toCoord(cells.findIndex((c) => c.origin === 'clue')),
    empties: cells.reduce<CellIndex[]>((acc, c, i) => (c.value === null ? [...acc, i] : acc), []),
  };
}

describe('undo', () => {
  let store: Store;

  beforeEach(() => {
    store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 31415));
  });

  it('is rejected on an untouched board, with reason nothing-to-undo (FR-032)', () => {
    const result = store.dispatch(undo());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('nothing-to-undo');
  });

  it('five changes then five undos restores the untouched board exactly', () => {
    const pristine = snapshot(store);
    const { empties } = findCells(store);

    for (const index of empties.slice(0, 5)) {
      store.dispatch(selectCell(toCoord(index)));
      store.dispatch(enterDigit(7, 'player'));
    }
    expect(store.getState().history).toHaveLength(5);
    expect(snapshot(store)).not.toEqual(pristine);

    for (let i = 0; i < 5; i++) expect(store.dispatch(undo()).ok).toBe(true);

    expect(snapshot(store)).toEqual(pristine);
    expect(store.getState().history).toHaveLength(0);
  });

  it('becomes unavailable again once history is exhausted', () => {
    const { empties } = findCells(store);
    store.dispatch(selectCell(toCoord(empties[0]!)));
    store.dispatch(enterDigit(3, 'player'));

    expect(store.dispatch(undo()).ok).toBe(true);
    const result = store.dispatch(undo());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('nothing-to-undo');
  });

  it('undoes one step at a time, newest first', () => {
    const { empties } = findCells(store);
    const [a, b] = [empties[0]!, empties[1]!];

    store.dispatch(selectCell(toCoord(a)));
    store.dispatch(enterDigit(1, 'player'));
    store.dispatch(selectCell(toCoord(b)));
    store.dispatch(enterDigit(2, 'player'));

    store.dispatch(undo());
    expect(store.getState().cells[b]!.value).toBeNull();
    expect(store.getState().cells[a]!.value).toBe(1);

    store.dispatch(undo());
    expect(store.getState().cells[a]!.value).toBeNull();
  });

  it('reverses an erase as readily as a placement', () => {
    const { empties } = findCells(store);
    const index = empties[0]!;

    store.dispatch(selectCell(toCoord(index)));
    store.dispatch(enterDigit(6, 'player'));
    store.dispatch(eraseCell('player'));
    expect(store.getState().cells[index]!.value).toBeNull();

    store.dispatch(undo());
    expect(store.getState().cells[index]!.value).toBe(6);
  });

  it('reverses a candidate toggle', () => {
    const { empties } = findCells(store);
    const index = empties[0]!;

    store.dispatch(setInputMode('notes'));
    store.dispatch(selectCell(toCoord(index)));
    store.dispatch(toggleCandidate(4, 'player'));
    expect(store.getState().cells[index]!.candidates.has(4)).toBe(true);

    store.dispatch(undo());
    expect(store.getState().cells[index]!.candidates.has(4)).toBe(false);
  });

  it('restores a placement AND its auto-stripped peer candidates in ONE step (FR-024)', () => {
    const cells = store.getState().cells;
    const target = cells.findIndex(
      (c, i) => c.value === null && [...peersOf(i)].filter((p) => cells[p]!.value === null).length >= 4,
    );
    const peers = [...peersOf(target)].filter((p) => cells[p]!.value === null).slice(0, 4);
    const digit: Digit = 5;

    store.dispatch(setInputMode('notes'));
    for (const peer of peers) {
      store.dispatch(selectCell(toCoord(peer)));
      store.dispatch(toggleCandidate(digit, 'player'));
    }
    const before = snapshot(store);
    const historyBefore = store.getState().history.length;

    store.dispatch(setInputMode('normal'));
    store.dispatch(selectCell(toCoord(target)));
    store.dispatch(enterDigit(digit, 'player'));
    expect(store.getState().history).toHaveLength(historyBefore + 1);

    store.dispatch(undo());

    expect(snapshot(store)).toEqual(before);
    expect(store.getState().history).toHaveLength(historyBefore);
  });

  it('makes NO distinction by origin — an agent change undoes like a human one (002/FR-042)', () => {
    const { empties } = findCells(store);
    const index = empties[0]!;

    store.dispatch(selectCell(toCoord(index)));
    store.dispatch(enterDigit(8, 'agent'));
    expect(store.getState().cells[index]!.origin).toBe('agent');

    expect(store.dispatch(undo()).ok).toBe(true);
    expect(store.getState().cells[index]!.value).toBeNull();
  });

  it('never resurrects a clue', () => {
    const { clue, empties } = findCells(store);
    const clueValue = store.getState().cells[toIndex(clue)]!.value;

    store.dispatch(selectCell(toCoord(empties[0]!)));
    store.dispatch(enterDigit(9, 'player'));
    store.dispatch(undo());

    expect(store.getState().cells[toIndex(clue)]!.value).toBe(clueValue);
    expect(store.getState().cells[toIndex(clue)]!.origin).toBe('clue');
  });

  it('cannot cross a new-puzzle boundary (FR-033)', () => {
    const { empties } = findCells(store);
    store.dispatch(selectCell(toCoord(empties[0]!)));
    store.dispatch(enterDigit(4, 'player'));
    expect(store.getState().history).toHaveLength(1);

    store.dispatch(newPuzzle('medium', 27182));

    expect(store.getState().history).toHaveLength(0);
    const result = store.dispatch(undo());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('nothing-to-undo');
  });
});
