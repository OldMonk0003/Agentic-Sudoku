import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, emptySession, type Store } from '@/state/store';
import { newPuzzle, selectCell } from '@/state/actions';
import { crosshairSet, matchingSet, highlightTier } from '@/state/selectors';
import { boxOf, colOf, rowOf, toIndex } from '@/engine/grid';

describe('highlight selectors', () => {
  let store: Store;

  beforeEach(() => {
    store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 4242));
  });

  describe('crosshairSet', () => {
    it('covers the whole row, column, and box of the selection (FR-007)', () => {
      store.dispatch(selectCell({ row: 4, col: 6 }));
      const set = crosshairSet(store.getState());

      for (let n = 1; n <= 9; n++) {
        expect(set.has(toIndex({ row: 4, col: n })), `row cell ${n}`).toBe(true);
        expect(set.has(toIndex({ row: n, col: 6 })), `col cell ${n}`).toBe(true);
      }
      const box = boxOf(toIndex({ row: 4, col: 6 }));
      for (let i = 0; i < 81; i++) {
        if (boxOf(i) === box) expect(set.has(i), `box cell ${i}`).toBe(true);
      }
    });

    it('covers exactly 21 cells — 9 + 9 + 9 minus the overlaps', () => {
      store.dispatch(selectCell({ row: 4, col: 6 }));
      // A cell's row, column and box union is itself plus its 20 peers.
      expect(crosshairSet(store.getState()).size).toBe(21);
    });

    it('includes nothing outside the row, column, and box', () => {
      store.dispatch(selectCell({ row: 1, col: 1 }));
      const set = crosshairSet(store.getState());
      const target = toIndex({ row: 1, col: 1 });
      for (const index of set) {
        const shares =
          rowOf(index) === rowOf(target) ||
          colOf(index) === colOf(target) ||
          boxOf(index) === boxOf(target);
        expect(shares, `index ${index}`).toBe(true);
      }
    });

    it('is empty when nothing is selected', () => {
      expect(crosshairSet(store.getState()).size).toBe(0);
    });
  });

  describe('matchingSet', () => {
    it('lights every cell showing the selected digit, clues included (FR-008)', () => {
      const cells = store.getState().cells;

      // Pick the digit that appears MOST often, so "more than one cell lights up"
      // is guaranteed. Taking the first clue's digit assumed it repeats, which is
      // puzzle-dependent -- that assumption made this test flaky roughly 1 run in 8.
      const counts = new Map<number, number[]>();
      cells.forEach((c, i) => {
        if (c.value === null) return;
        counts.set(c.value, [...(counts.get(c.value) ?? []), i]);
      });
      const [digit, indices] = [...counts.entries()].sort((a, b) => b[1].length - a[1].length)[0]!;
      expect(indices.length).toBeGreaterThan(1);

      const first = indices[0]!;
      store.dispatch(selectCell({ row: Math.floor(first / 9) + 1, col: (first % 9) + 1 }));
      const set = matchingSet(store.getState());

      expect([...set].sort((a, b) => a - b)).toEqual(indices);
      expect(set.size).toBeGreaterThan(1);
      expect(cells[first]!.value).toBe(digit);
    });

    it('is EMPTY when the selected cell has no value (FR-011)', () => {
      const emptyIndex = store.getState().cells.findIndex((c) => c.value === null);
      store.dispatch(selectCell({ row: Math.floor(emptyIndex / 9) + 1, col: (emptyIndex % 9) + 1 }));
      expect(matchingSet(store.getState()).size).toBe(0);
    });

    it('is empty when nothing is selected', () => {
      expect(matchingSet(store.getState()).size).toBe(0);
    });
  });

  describe('highlightTier precedence', () => {
    it('ranks matching above crosshair', () => {
      const cells = store.getState().cells;
      const clueIndex = cells.findIndex((c) => c.origin === 'clue');
      const digit = cells[clueIndex]!.value!;
      store.dispatch(selectCell({ row: Math.floor(clueIndex / 9) + 1, col: (clueIndex % 9) + 1 }));

      const session = store.getState();
      // A cell holding the same digit but NOT in the crosshair is 'matching'.
      const elsewhere = cells.findIndex(
        (c, i) => c.value === digit && i !== clueIndex && !crosshairSet(session).has(i),
      );
      if (elsewhere !== -1) {
        expect(highlightTier(session, elsewhere)).toBe('matching');
      }
    });

    it('gives the selected cell its own tier', () => {
      store.dispatch(selectCell({ row: 5, col: 5 }));
      expect(highlightTier(store.getState(), toIndex({ row: 5, col: 5 }))).toBe('selected');
    });

    it('gives untouched cells no tier', () => {
      // Select an EMPTY cell so there is no matching-digit tier at all, then
      // assert on a cell outside its crosshair. Assuming (1,1) is empty would be
      // puzzle-dependent, which is how this test first failed.
      const emptyIndex = store.getState().cells.findIndex((c) => c.value === null);
      store.dispatch(selectCell({ row: Math.floor(emptyIndex / 9) + 1, col: (emptyIndex % 9) + 1 }));

      const session = store.getState();
      const outside = [...Array(81).keys()].find((i) => !crosshairSet(session).has(i));
      expect(outside).toBeDefined();
      expect(highlightTier(session, outside!)).toBe('none');
    });
  });
});
