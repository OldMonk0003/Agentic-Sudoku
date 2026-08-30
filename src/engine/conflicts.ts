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
const NAMED_UNITS: readonly { kind: UnitKind; n: number; indices: readonly CellIndex[] }[] = (
  ['row', 'col', 'box'] as const
).flatMap((kind) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ kind, n, indices: unitIndices(kind, n) })));

const UNITS: readonly (readonly CellIndex[])[] = NAMED_UNITS.map((unit) => unit.indices);

export type UnitKind = 'row' | 'col' | 'box';

/** One duplication: which unit, which digit, and every cell taking part. */
export interface ConflictGroup {
  readonly kind: UnitKind;
  readonly n: number;
  readonly digit: Digit;
  readonly indices: readonly CellIndex[];
}

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

/**
 * The same duplications, grouped by the unit and digit that collide.
 *
 * `findConflicts` answers "which cells are wrong-looking", which is what the
 * board needs to paint. An agent needs to know WHICH cells collide with WHICH,
 * so it can explain the collision (002/FR-025) -- and working that out is a game
 * rule, so it lives here rather than in a tool handler (Principle III).
 *
 * Like `findConflicts`, it reads the visible board only and can never consult a
 * solution.
 */
export function findConflictGroups(values: readonly (Digit | null)[]): readonly ConflictGroup[] {
  const groups: ConflictGroup[] = [];

  for (const unit of NAMED_UNITS) {
    const seen = new Map<Digit, CellIndex[]>();
    for (const index of unit.indices) {
      const digit = values[index];
      if (digit == null) continue;
      seen.set(digit, [...(seen.get(digit) ?? []), index]);
    }
    for (const [digit, indices] of seen) {
      if (indices.length > 1) groups.push({ kind: unit.kind, n: unit.n, digit, indices });
    }
  }

  return groups;
}

/** Whether every cell holds a digit. Completion also requires zero conflicts. */
export function isFull(values: readonly (Digit | null)[]): boolean {
  return ALL_INDICES.every((index) => values[index] != null);
}
