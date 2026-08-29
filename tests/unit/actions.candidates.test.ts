import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, emptySession, type Store } from '@/state/store';
import { newPuzzle, selectCell, enterDigit, toggleCandidate, setInputMode, toggleInputMode } from '@/state/actions';
import { toCoord, toIndex } from '@/engine/grid';

function findCells(store: Store) {
  const cells = store.getState().cells;
  return {
    clue: toCoord(cells.findIndex((c) => c.origin === 'clue')),
    empty: toCoord(cells.findIndex((c) => c.value === null)),
  };
}

describe('candidate actions', () => {
  let store: Store;

  beforeEach(() => {
    store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 2024));
  });

  describe('input mode', () => {
    it('starts in normal mode', () => {
      expect(store.getState().inputMode).toBe('normal');
    });

    it('sets a mode explicitly', () => {
      store.dispatch(setInputMode('notes'));
      expect(store.getState().inputMode).toBe('notes');
    });

    it('reports no change when setting the mode it is already in', () => {
      const result = store.dispatch(setInputMode('normal'));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.changed).toBe(false);
    });

    it('toggles back and forth', () => {
      store.dispatch(toggleInputMode());
      expect(store.getState().inputMode).toBe('notes');
      store.dispatch(toggleInputMode());
      expect(store.getState().inputMode).toBe('normal');
    });

    it('does not touch the board', () => {
      const before = store.getState().cells;
      store.dispatch(toggleInputMode());
      expect(store.getState().cells).toBe(before);
      expect(store.getState().history).toHaveLength(0);
    });
  });

  describe('toggleCandidate', () => {
    it('adds a candidate, then removes it on a second press (FR-016)', () => {
      const { empty } = findCells(store);
      store.dispatch(selectCell(empty));

      store.dispatch(toggleCandidate(4, 'player'));
      expect([...store.getState().cells[toIndex(empty)]!.candidates]).toEqual([4]);

      store.dispatch(toggleCandidate(4, 'player'));
      expect(store.getState().cells[toIndex(empty)]!.candidates.size).toBe(0);
    });

    it('holds several candidates at once', () => {
      const { empty } = findCells(store);
      store.dispatch(selectCell(empty));
      for (const d of [1, 4, 7] as const) store.dispatch(toggleCandidate(d, 'player'));
      expect([...store.getState().cells[toIndex(empty)]!.candidates].sort()).toEqual([1, 4, 7]);
    });

    it('records exactly one history entry per toggle', () => {
      const { empty } = findCells(store);
      store.dispatch(selectCell(empty));
      store.dispatch(toggleCandidate(4, 'player'));
      store.dispatch(toggleCandidate(5, 'player'));
      expect(store.getState().history).toHaveLength(2);
    });

    it('is REJECTED on a cell that already holds a value', () => {
      const { empty } = findCells(store);
      store.dispatch(selectCell(empty));
      store.dispatch(enterDigit(3, 'player'));

      const result = store.dispatch(toggleCandidate(4, 'player'));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('cell-not-empty');
    });

    it('is REJECTED on a clue', () => {
      const { clue } = findCells(store);
      store.dispatch(selectCell(clue));
      const result = store.dispatch(toggleCandidate(4, 'player'));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('cell-is-clue');
    });

    it('is rejected with no selection', () => {
      const result = store.dispatch(toggleCandidate(4, 'player'));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('no-selection');
    });

    it('accepts an agent origin, so feature 002 reuses it unchanged', () => {
      const { empty } = findCells(store);
      store.dispatch(selectCell(empty));
      expect(store.dispatch(toggleCandidate(6, 'agent')).ok).toBe(true);
    });
  });

  describe('committing a value clears that cell’s candidates (FR-017)', () => {
    it('drops every candidate the cell was holding', () => {
      const { empty } = findCells(store);
      store.dispatch(selectCell(empty));
      for (const d of [1, 2, 3] as const) store.dispatch(toggleCandidate(d, 'player'));
      expect(store.getState().cells[toIndex(empty)]!.candidates.size).toBe(3);

      store.dispatch(enterDigit(9, 'player'));

      const cell = store.getState().cells[toIndex(empty)]!;
      expect(cell.value).toBe(9);
      expect(cell.candidates.size).toBe(0);
    });
  });
});
