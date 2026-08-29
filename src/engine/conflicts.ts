import { ALL_INDICES, unitIndices, type CellIndex, type Digit } from './grid';

/**
 * Duplicate detection.
 *
 * Reports duplicate-constraint violations ONLY. It never compares against a
 * solution, and its signature makes that impossible -- the visible board is the
 * only input (FR-029).
 *
 * That is deliberate product behaviour: a board that tells you when you are
 * wrong is a different game. The tutor in feature 002 may point out a mistake;
 * the board itself will not.
 */

/** The 27 units of a Sudoku board, built once at module load. */
const UNITS: readonly (readonly CellIndex[])[] = (['row', 'col', 'box'] as const).flatMap((kind) =>
  [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => unitIndices(kind, n)),
);

/**
 * Every cell participating in a duplication within any row, column, or box.
 *
 * Both (or all) participants are returned, including starting clues -- a clue in
 * a conflict is flagged even though only the player's own digit can resolve it.
 */
export function findConflicts(values: readonly (Digit | null)[]): ReadonlySet<CellIndex> {
  const conflicts = new Set<CellIndex>();

  for (const unit of UNITS) {
    const seen = new Map<Digit, CellIndex[]>();
    for (const index of unit) {
      const digit = values[index];
      if (digit == null) continue;
      seen.set(digit, [...(seen.get(digit) ?? []), index]);
    }
    for (const indices of seen.values()) {
      if (indices.length > 1) for (const index of indices) conflicts.add(index);
    }
  }

  return conflicts;
}

/** Whether every cell holds a digit. Completion also requires zero conflicts. */
export function isFull(values: readonly (Digit | null)[]): boolean {
  return ALL_INDICES.every((index) => values[index] != null);
}
