import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, emptySession, type Store } from '@/state/store';
import {
  newPuzzle, setCandidatesAt, fillAllCandidates, selectCell, setInputMode,
  toggleCandidate, enterDigitAt, undo, pause,
} from '@/state/actions';
import { legalCandidates } from '@/engine/candidates';
import { toCoord, toIndex } from '@/engine/grid';

/**
 * Bulk candidate writes (FR-039, FR-040, FR-043).
 *
 * FR-043 is the demanding one: "A tool call that changes many cells at once MUST
 * be recorded as exactly one undoable step." One explanation accompanied the
 * call, so one undo has to reverse everything that explanation described --
 * otherwise the learner is left unwinding a change nobody narrated.
 *
 * All-or-nothing follows from the same argument: a partially applied batch would
 * be narrated by text that no longer describes what happened.
 */

let store: Store;

const emptyCoords = (n: number) =>
  store.getState().cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell.value === null)
    .slice(0, n)
    .map(({ index }) => toCoord(index));

const candidatesAt = (coord: { row: number; col: number }) =>
  [...store.getState().cells[toIndex(coord)]!.candidates].sort();

beforeEach(() => {
  store = createStore(emptySession());
  store.dispatch(newPuzzle('easy', 271828));
});

describe('setCandidatesAt', () => {
  it('sets exactly the digits named, replacing whatever was there', () => {
    const [a] = emptyCoords(1);
    store.dispatch(setCandidatesAt([{ coord: a!, digits: [1, 4, 9] }], 'agent'));
    expect(candidatesAt(a!)).toEqual([1, 4, 9]);

    store.dispatch(setCandidatesAt([{ coord: a!, digits: [2] }], 'agent'));
    expect(candidatesAt(a!)).toEqual([2]);
  });

  it('erases a cell"s marks when given an empty digit list', () => {
    const [a] = emptyCoords(1);
    store.dispatch(setCandidatesAt([{ coord: a!, digits: [1, 4] }], 'agent'));
    store.dispatch(setCandidatesAt([{ coord: a!, digits: [] }], 'agent'));
    expect(candidatesAt(a!)).toEqual([]);
  });

  it('records a multi-cell write as EXACTLY ONE undo step (FR-043)', () => {
    const coords = emptyCoords(4);
    const depth = store.getState().history.length;

    store.dispatch(
      setCandidatesAt(coords.map((coord) => ({ coord, digits: [3, 6] })), 'agent'),
    );

    expect(store.getState().history).toHaveLength(depth + 1);
    for (const coord of coords) expect(candidatesAt(coord)).toEqual([3, 6]);

    store.dispatch(undo());
    for (const coord of coords) expect(candidatesAt(coord)).toEqual([]);
  });

  it('touches no cell it was not asked about', () => {
    const coords = emptyCoords(3);
    const untouched = emptyCoords(5)[4]!;

    store.dispatch(setCandidatesAt([{ coord: coords[0]!, digits: [5] }], 'agent'));
    expect(candidatesAt(untouched)).toEqual([]);
  });

  it('is ALL-OR-NOTHING: one bad entry changes nothing at all', () => {
    const coords = emptyCoords(2);
    const clue = toCoord(store.getState().cells.findIndex((c) => c.origin === 'clue'));
    const before = JSON.stringify(store.getState().cells.map((c) => [...c.candidates]));

    const result = store.dispatch(
      setCandidatesAt(
        [
          { coord: coords[0]!, digits: [1] },
          { coord: clue, digits: [2] }, // invalid: a starting clue
          { coord: coords[1]!, digits: [3] },
        ],
        'agent',
      ),
    );

    expect(result).toEqual({ ok: false, reason: 'cell-is-clue' });
    expect(JSON.stringify(store.getState().cells.map((c) => [...c.candidates]))).toBe(before);
  });

  it('rejects a filled cell, an off-grid coordinate, and a paused board', () => {
    const [a, b] = emptyCoords(2);
    store.dispatch(enterDigitAt(a!, 5, 'player'));

    expect(store.dispatch(setCandidatesAt([{ coord: a!, digits: [1] }], 'agent'))).toEqual({
      ok: false, reason: 'cell-not-empty',
    });
    expect(
      store.dispatch(setCandidatesAt([{ coord: { row: 0, col: 1 }, digits: [1] }], 'agent')),
    ).toEqual({ ok: false, reason: 'out-of-range' });

    store.dispatch(selectCell(b!));
    store.dispatch(pause());
    expect(store.dispatch(setCandidatesAt([{ coord: b!, digits: [1] }], 'agent'))).toEqual({
      ok: false, reason: 'wrong-status',
    });
  });

  it('rejects an empty entry list rather than recording a no-op', () => {
    const depth = store.getState().history.length;
    expect(store.dispatch(setCandidatesAt([], 'agent'))).toEqual({ ok: true, changed: false });
    expect(store.getState().history).toHaveLength(depth);
  });
});

describe('fillAllCandidates', () => {
  it('writes exactly the legal digits into every empty cell (FR-040)', () => {
    const values = store.getState().cells.map((c) => c.value);
    store.dispatch(fillAllCandidates('agent'));

    for (let index = 0; index < 81; index++) {
      if (values[index] !== null) continue;
      const expected = [...legalCandidates(values, index)].sort();
      expect(candidatesAt(toCoord(index)), `cell ${index}`).toEqual(expected);
    }
  });

  it('does not touch a filled cell', () => {
    const [a] = emptyCoords(1);
    store.dispatch(enterDigitAt(a!, 5, 'player'));
    store.dispatch(fillAllCandidates('agent'));

    expect(store.getState().cells[toIndex(a!)]!.value).toBe(5);
    expect(candidatesAt(a!)).toEqual([]);
  });

  it('is ONE undo step for the whole board (FR-043)', () => {
    const depth = store.getState().history.length;
    store.dispatch(fillAllCandidates('agent'));
    expect(store.getState().history).toHaveLength(depth + 1);
  });

  it('restores hand-written marks exactly on one undo (US4 scenario 4)', () => {
    const [a, b] = emptyCoords(2);
    store.dispatch(setInputMode('notes'));
    store.dispatch(selectCell(a!));
    store.dispatch(toggleCandidate(2, 'player'));
    store.dispatch(selectCell(b!));
    store.dispatch(toggleCandidate(8, 'player'));

    const before = JSON.stringify(store.getState().cells.map((c) => [...c.candidates].sort()));

    store.dispatch(fillAllCandidates('agent'));
    store.dispatch(undo());

    expect(JSON.stringify(store.getState().cells.map((c) => [...c.candidates].sort()))).toBe(before);
  });

  it('never reveals the solution: candidates come from the VISIBLE board only', () => {
    // A cell with a single legal candidate is a naked single, not an answer key:
    // the same deduction the learner could make. What must NOT happen is a cell
    // being narrowed below what the visible board supports.
    const values = store.getState().cells.map((c) => c.value);
    store.dispatch(fillAllCandidates('agent'));

    for (let index = 0; index < 81; index++) {
      if (values[index] !== null) continue;
      const legal = legalCandidates(values, index);
      for (const digit of candidatesAt(toCoord(index))) {
        expect(legal.has(digit), `cell ${index} offered an illegal digit`).toBe(true);
      }
      expect(candidatesAt(toCoord(index))).toHaveLength(legal.size);
    }
  });

  it('is rejected while the board is paused', () => {
    store.dispatch(selectCell(emptyCoords(1)[0]!));
    store.dispatch(pause());
    expect(store.dispatch(fillAllCandidates('agent'))).toEqual({ ok: false, reason: 'wrong-status' });
  });
});
