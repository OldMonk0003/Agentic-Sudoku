import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, emptySession, type Store } from '@/state/store';
import { newPuzzle, selectCell, moveSelection, enterDigit, eraseCell } from '@/state/actions';
import { toIndex } from '@/engine/grid';

/** Find a coordinate whose cell is a starting clue, and one that is empty. */
function findCells(store: Store) {
  const cells = store.getState().cells;
  const clueIndex = cells.findIndex((c) => c.origin === 'clue');
  const emptyIndex = cells.findIndex((c) => c.value === null);
  return {
    clue: { row: Math.floor(clueIndex / 9) + 1, col: (clueIndex % 9) + 1 },
    empty: { row: Math.floor(emptyIndex / 9) + 1, col: (emptyIndex % 9) + 1 },
  };
}

describe('entry actions', () => {
  let store: Store;

  beforeEach(() => {
    store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 101));
  });

  it('starts a puzzle in the playing state with 81 cells', () => {
    expect(store.getState().status).toBe('playing');
    expect(store.getState().cells).toHaveLength(81);
    expect(store.getState().puzzle).not.toBeNull();
  });

  describe('selectCell', () => {
    it('selects a valid coordinate', () => {
      store.dispatch(selectCell({ row: 3, col: 4 }));
      expect(store.getState().selection).toEqual({ row: 3, col: 4 });
    });

    it('rejects a coordinate off the grid', () => {
      const result = store.dispatch(selectCell({ row: 0, col: 4 }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('out-of-range');
      expect(store.getState().selection).toBeNull();
    });
  });

  describe('moveSelection', () => {
    it('moves one cell in each direction', () => {
      store.dispatch(selectCell({ row: 5, col: 5 }));
      store.dispatch(moveSelection('up'));
      expect(store.getState().selection).toEqual({ row: 4, col: 5 });
      store.dispatch(moveSelection('down'));
      store.dispatch(moveSelection('left'));
      expect(store.getState().selection).toEqual({ row: 5, col: 4 });
      store.dispatch(moveSelection('right'));
      expect(store.getState().selection).toEqual({ row: 5, col: 5 });
    });

    it('stops at the boundary instead of wrapping (FR-019)', () => {
      store.dispatch(selectCell({ row: 1, col: 1 }));
      store.dispatch(moveSelection('up'));
      expect(store.getState().selection).toEqual({ row: 1, col: 1 });
      store.dispatch(moveSelection('left'));
      expect(store.getState().selection).toEqual({ row: 1, col: 1 });

      store.dispatch(selectCell({ row: 9, col: 9 }));
      store.dispatch(moveSelection('down'));
      store.dispatch(moveSelection('right'));
      expect(store.getState().selection).toEqual({ row: 9, col: 9 });
    });

    it('is rejected with no selection', () => {
      const result = store.dispatch(moveSelection('up'));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('no-selection');
    });
  });

  describe('enterDigit', () => {
    it('places a digit in an empty cell and marks its origin', () => {
      const { empty } = findCells(store);
      store.dispatch(selectCell(empty));
      store.dispatch(enterDigit(7, 'player'));

      const cell = store.getState().cells[toIndex(empty)]!;
      expect(cell.value).toBe(7);
      expect(cell.origin).toBe('player');
    });

    it('records exactly one history entry', () => {
      const { empty } = findCells(store);
      store.dispatch(selectCell(empty));
      store.dispatch(enterDigit(7, 'player'));
      expect(store.getState().history).toHaveLength(1);
    });

    it('REJECTS a clue cell and changes nothing (FR-005, FR-021)', () => {
      const { clue } = findCells(store);
      store.dispatch(selectCell(clue));
      const before = store.getState().cells[toIndex(clue)]!.value;

      const result = store.dispatch(enterDigit(7, 'player'));

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('cell-is-clue');
      expect(store.getState().cells[toIndex(clue)]!.value).toBe(before);
      expect(store.getState().history).toHaveLength(0);
    });

    it('is rejected with no selection', () => {
      const result = store.dispatch(enterDigit(7, 'player'));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('no-selection');
    });

    it('permits a duplicate — the board reports contradictions, it does not prevent them', () => {
      const { empty } = findCells(store);
      store.dispatch(selectCell(empty));
      // Whatever digit is placed, placement itself must succeed.
      expect(store.dispatch(enterDigit(1, 'player')).ok).toBe(true);
    });

    it('accepts an agent origin, so feature 002 reuses this action unchanged', () => {
      const { empty } = findCells(store);
      store.dispatch(selectCell(empty));
      store.dispatch(enterDigit(4, 'agent'));
      expect(store.getState().cells[toIndex(empty)]!.origin).toBe('agent');
    });
  });

  describe('eraseCell', () => {
    it('clears a player digit', () => {
      const { empty } = findCells(store);
      store.dispatch(selectCell(empty));
      store.dispatch(enterDigit(7, 'player'));
      store.dispatch(eraseCell('player'));
      expect(store.getState().cells[toIndex(empty)]!.value).toBeNull();
    });

    it('NEVER clears a clue (FR-018, FR-030)', () => {
      const { clue } = findCells(store);
      store.dispatch(selectCell(clue));
      const before = store.getState().cells[toIndex(clue)]!.value;

      const result = store.dispatch(eraseCell('player'));

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('cell-is-clue');
      expect(store.getState().cells[toIndex(clue)]!.value).toBe(before);
    });
  });

  describe('newPuzzle', () => {
    it('clears history so undo cannot cross the boundary (FR-033)', () => {
      const { empty } = findCells(store);
      store.dispatch(selectCell(empty));
      store.dispatch(enterDigit(7, 'player'));
      expect(store.getState().history).toHaveLength(1);

      store.dispatch(newPuzzle('medium', 202));
      expect(store.getState().history).toHaveLength(0);
      expect(store.getState().elapsedMs).toBe(0);
    });
  });

  it('never throws, and leaves a clue untouched through every path', () => {
    const { clue } = findCells(store);
    const before = store.getState().cells[toIndex(clue)]!;
    store.dispatch(selectCell(clue));

    for (const action of [enterDigit(1, 'player'), enterDigit(9, 'agent'), eraseCell('player')]) {
      expect(() => store.dispatch(action)).not.toThrow();
    }
    expect(store.getState().cells[toIndex(clue)]).toEqual(before);
  });
});
