import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, selectCell, enterDigit } from '@/state/actions';
import { checkForConflicts } from '@/tools/tools/checkForConflicts';
import { toCoord } from '@/engine/grid';
import type { Digit } from '@/engine/grid';

/**
 * Contract test for `check_for_conflicts` (FR-025, FR-027).
 *
 * Read-only by decision recorded in the spec's Assumptions: feature 001 already
 * flags conflicts continuously and automatically, so there is nothing here to
 * write. It reports duplicates ONLY -- it can never say whether a digit is
 * correct, because the solution does not exist above the Engine.
 */

interface ConflictGroup {
  unit: { type: string; n: number };
  digit: number;
  cells: { row: number; col: number }[];
}

const call = (input: unknown = {}) => checkForConflicts.execute(input);

const groupsOf = async (): Promise<ConflictGroup[]> => {
  const result = await call();
  if (!result.ok) throw new Error('expected success');
  return (result.data as { conflicts: ConflictGroup[] }).conflicts;
};

/** Place a digit at a coordinate through the human path. */
const place = (row: number, col: number, digit: Digit) => {
  store.dispatch(selectCell({ row, col }));
  store.dispatch(enterDigit(digit, 'player'));
};

/** Two empty, non-clue cells sharing a row, if the puzzle has any. */
function twoEmptyInSameRow(): [{ row: number; col: number }, { row: number; col: number }] {
  const cells = store.getState().cells;
  for (let row = 1; row <= 9; row++) {
    const empties = [];
    for (let col = 1; col <= 9; col++) {
      if (cells[(row - 1) * 9 + (col - 1)]!.value === null) empties.push({ row, col });
    }
    if (empties.length >= 2) return [empties[0]!, empties[1]!];
  }
  throw new Error('no row with two empty cells');
}

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 909));
});

describe('check_for_conflicts — descriptor', () => {
  it('is named and declared read-only', () => {
    expect(checkForConflicts.name).toBe('check_for_conflicts');
    expect(checkForConflicts.readOnly).toBe(true);
  });

  it('takes no arguments and rejects any', async () => {
    const result = await call({ unit: 'row' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unexpected-argument');
  });
});

describe('check_for_conflicts — success', () => {
  it('returns an empty list on a board with no duplicates', async () => {
    expect(await groupsOf()).toEqual([]);
  });

  it('groups a duplicate by unit and digit, naming every participating cell', async () => {
    const [first, second] = twoEmptyInSameRow();
    place(first.row, first.col, 4);
    place(second.row, second.col, 4);

    const groups = await groupsOf();
    const rowGroup = groups.find((g) => g.unit.type === 'row');

    expect(rowGroup).toBeDefined();
    expect(rowGroup!.digit).toBe(4);
    expect(rowGroup!.unit.n).toBe(first.row);
    // Both participants, so the agent can tell which cells collide with which.
    expect(rowGroup!.cells).toEqual(expect.arrayContaining([first, second]));
  });

  it('counts every conflicted cell, consistently with the groups it reports', async () => {
    const [first, second] = twoEmptyInSameRow();
    place(first.row, first.col, 4);
    place(second.row, second.col, 4);

    const result = await call();
    if (!result.ok) throw new Error('expected success');
    const data = result.data as { conflicts: ConflictGroup[]; conflicted_cell_count: number };

    // Deliberately not a fixed number: placing the same digit twice in a row can
    // also collide with a clue in one of their columns or boxes, so the true
    // count depends on the puzzle. What must hold is that the count and the
    // groups agree, and that both cells the learner placed are in there.
    const distinct = new Set(
      data.conflicts.flatMap((group) => group.cells.map((cell) => `${cell.row},${cell.col}`)),
    );
    expect(data.conflicted_cell_count).toBe(distinct.size);
    expect(distinct).toContain(`${first.row},${first.col}`);
    expect(distinct).toContain(`${second.row},${second.col}`);
  });

  it('reports a clue that participates in a duplicate', async () => {
    // A clue in a conflict is flagged even though only the player's own digit
    // can resolve it -- matching feature 001's own rule.
    const cells = store.getState().cells;
    const clueIndex = cells.findIndex((c) => c.origin === 'clue');
    const clue = toCoord(clueIndex);
    const clueDigit = cells[clueIndex]!.value!;

    const target = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map((col) => ({ row: clue.row, col }))
      .find(({ row, col }) => cells[(row - 1) * 9 + (col - 1)]!.value === null);
    if (!target) return; // this puzzle has no empty cell in that row

    place(target.row, target.col, clueDigit);

    const groups = await groupsOf();
    const rowGroup = groups.find((g) => g.unit.type === 'row' && g.digit === clueDigit);
    expect(rowGroup!.cells).toEqual(expect.arrayContaining([clue, target]));
  });
});

describe('check_for_conflicts — it cannot reveal the answer', () => {
  it('says nothing about a legal but wrong digit', async () => {
    // A digit that breaks no constraint is invisible here, whether or not it is
    // the puzzle's answer (001/FR-029, 002/FR-058). The tutor may say a move is
    // wrong; the board will not.
    const empties = store.getState().cells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell.value === null);

    const { index } = empties[0]!;
    const { row, col } = toCoord(index);
    const peersValues = new Set(
      store.getState().cells.map((c, i) => (i === index ? null : c.value)),
    );
    const legal = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]).find((d) => {
      const conflicts = store.getState().cells.some((c, i) => {
        if (i === index || c.value !== d) return false;
        const other = toCoord(i);
        const sameBox =
          Math.floor((other.row - 1) / 3) === Math.floor((row - 1) / 3) &&
          Math.floor((other.col - 1) / 3) === Math.floor((col - 1) / 3);
        return other.row === row || other.col === col || sameBox;
      });
      return !conflicts;
    });
    expect(peersValues.size).toBeGreaterThan(0);
    if (!legal) return;

    place(row, col, legal);
    expect(await groupsOf()).toEqual([]);
  });
});
