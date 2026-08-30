import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, emptySession, type Store } from '@/state/store';
import { newPuzzle, selectCell, enterDigit, enterDigitAt, pause, toggleCandidate, setInputMode } from '@/state/actions';
import { toCoord, toIndex } from '@/engine/grid';

/**
 * The coordinate-addressed write (FR-036).
 *
 * WHY IT EXISTS AT ALL: `enterDigit` writes to the SELECTION, and an agent must
 * never move the learner's selection. The learner may be mid-thought on another
 * cell, and FR-056 gives them uninterrupted control of the board. So the agent
 * addresses a cell directly and the selection is not its business.
 *
 * `enterDigit` now delegates here, so the human path and the agent path run one
 * implementation rather than two that drift.
 */

let store: Store;

const firstEmpty = () => toCoord(store.getState().cells.findIndex((c) => c.value === null));
const firstClue = () => toCoord(store.getState().cells.findIndex((c) => c.origin === 'clue'));
const valueAt = (coord: { row: number; col: number }) =>
  store.getState().cells[toIndex(coord)]!.value;

beforeEach(() => {
  store = createStore(emptySession());
  store.dispatch(newPuzzle('easy', 12345));
});

describe('enterDigitAt', () => {
  it('places a digit at the named coordinate', () => {
    const coord = firstEmpty();
    const result = store.dispatch(enterDigitAt(coord, 7, 'agent'));

    expect(result).toEqual({ ok: true, changed: true });
    expect(valueAt(coord)).toBe(7);
    expect(store.getState().cells[toIndex(coord)]!.origin).toBe('agent');
  });

  it('NEVER moves the learner"s selection, at any coordinate', () => {
    // The property that makes an agent's write non-intrusive. Checked across the
    // whole board rather than at one cell, because "usually" is not the claim.
    const parked = firstEmpty();
    store.dispatch(selectCell(parked));

    for (let row = 1; row <= 9; row++) {
      for (let col = 1; col <= 9; col++) {
        store.dispatch(enterDigitAt({ row, col }, 5, 'agent'));
        expect(store.getState().selection).toEqual(parked);
      }
    }
  });

  it('works with no selection at all', () => {
    expect(store.getState().selection).toBeNull();
    const coord = firstEmpty();

    expect(store.dispatch(enterDigitAt(coord, 3, 'agent'))).toEqual({ ok: true, changed: true });
    expect(valueAt(coord)).toBe(3);
  });

  it('rejects a starting clue and leaves it untouched (FR-037)', () => {
    const clue = firstClue();
    const before = valueAt(clue);

    expect(store.dispatch(enterDigitAt(clue, 1, 'agent'))).toEqual({
      ok: false,
      reason: 'cell-is-clue',
    });
    expect(valueAt(clue)).toBe(before);
  });

  it('rejects an already-filled cell (FR-037)', () => {
    const coord = firstEmpty();
    store.dispatch(enterDigitAt(coord, 4, 'agent'));

    expect(store.dispatch(enterDigitAt(coord, 6, 'agent'))).toEqual({
      ok: false,
      reason: 'cell-not-empty',
    });
    expect(valueAt(coord)).toBe(4);
  });

  it('rejects a coordinate off the grid (FR-037)', () => {
    for (const coord of [
      { row: 0, col: 5 }, { row: 10, col: 5 }, { row: 5, col: 0 },
      { row: 5, col: 10 }, { row: 1.5, col: 2 },
    ]) {
      expect(store.dispatch(enterDigitAt(coord, 5, 'agent')), JSON.stringify(coord)).toEqual({
        ok: false,
        reason: 'out-of-range',
      });
    }
  });

  it('is rejected while the board is paused (FR-045)', () => {
    store.dispatch(selectCell(firstEmpty()));
    store.dispatch(pause());

    expect(store.dispatch(enterDigitAt(firstEmpty(), 5, 'agent'))).toEqual({
      ok: false,
      reason: 'wrong-status',
    });
  });

  it('strips the digit from peer candidates in ONE history record', () => {
    // The compound-action guarantee from 001, now reachable by coordinate too:
    // one dispatch, one record, so one undo restores the placement AND every
    // candidate it cleared.
    const coord = firstEmpty();
    const index = toIndex(coord);
    const peerCoords = store
      .getState()
      .cells.map((_cell, i) => i)
      .filter((i) => i !== index)
      .map(toCoord)
      .filter((c) => c.row === coord.row && store.getState().cells[toIndex(c)]!.value === null)
      .slice(0, 2);

    store.dispatch(setInputMode('notes'));
    for (const peer of peerCoords) {
      store.dispatch(selectCell(peer));
      store.dispatch(toggleCandidate(9, 'player'));
    }
    const depthBefore = store.getState().history.length;

    store.dispatch(enterDigitAt(coord, 9, 'agent'));

    expect(store.getState().history).toHaveLength(depthBefore + 1);
    for (const peer of peerCoords) {
      expect(store.getState().cells[toIndex(peer)]!.candidates.has(9)).toBe(false);
    }
  });
});

describe('enterDigit still works exactly as it did', () => {
  it('writes to the selection, and delegates to the coordinate form', () => {
    const coord = firstEmpty();
    store.dispatch(selectCell(coord));

    expect(store.dispatch(enterDigit(8, 'player'))).toEqual({ ok: true, changed: true });
    expect(valueAt(coord)).toBe(8);
    expect(store.getState().cells[toIndex(coord)]!.origin).toBe('player');
  });

  it('still rejects when nothing is selected', () => {
    expect(store.dispatch(enterDigit(8, 'player'))).toEqual({ ok: false, reason: 'no-selection' });
  });
});
