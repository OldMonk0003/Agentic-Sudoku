import { boxOf, colOf, peersOf, rowOf, toIndex, type CellIndex } from '@/engine/grid';
import { findConflicts, isFull } from '@/engine/conflicts';
import type { GameSession } from './types';

/**
 * Derived view data.
 *
 * Nothing here is stored. Recomputation over 81 cells is trivially inside the
 * 16ms budget, and computing rather than storing makes "re-evaluated after every
 * change" (FR-028) true by construction instead of by discipline.
 *
 * These are pure functions of the session: they never mutate it (FR-010).
 */

const EMPTY: ReadonlySet<CellIndex> = new Set();

/** The row, column, and box of the selected cell -- 21 cells including itself. */
export function crosshairSet(session: GameSession): ReadonlySet<CellIndex> {
  if (session.selection === null) return EMPTY;

  const index = toIndex(session.selection);
  // A cell's row + column + box union is exactly itself plus its 20 peers.
  return new Set<CellIndex>([index, ...peersOf(index)]);
}

/**
 * Every cell showing the same digit as the selected cell, clues included.
 * Empty when the selected cell holds no value (FR-011).
 */
export function matchingSet(session: GameSession): ReadonlySet<CellIndex> {
  if (session.selection === null) return EMPTY;

  const digit = session.cells[toIndex(session.selection)]?.value ?? null;
  if (digit === null) return EMPTY;

  const set = new Set<CellIndex>();
  session.cells.forEach((cell, index) => {
    if (cell.value === digit) set.add(index);
  });
  return set;
}

/**
 * Cells participating in a duplicate.
 *
 * Derived, never stored -- which is what makes FR-028 ("re-evaluated after every
 * change") true by construction rather than by discipline. Storing it would
 * invite it drifting out of sync with the board.
 */
export function conflictSet(session: GameSession): ReadonlySet<CellIndex> {
  return findConflicts(session.cells.map((cell) => cell.value));
}

/** All 81 filled AND no conflicts (FR-037). A full but contradictory board is not complete. */
export function isComplete(session: GameSession): boolean {
  const values = session.cells.map((cell) => cell.value);
  return isFull(values) && findConflicts(values).size === 0;
}

export type HighlightTier = 'none' | 'crosshair' | 'matching' | 'conflict' | 'selected';

/**
 * Which tier a cell renders at.
 *
 * Precedence, per data-model.md:
 *   selected > conflict > matching > crosshair > none
 *
 * The selected cell reports its own tier; the ring is composed over whatever
 * wash would otherwise apply, which the Cell component handles.
 *
 * `conflictSet` arrives in User Story 3 and slots in here without touching the
 * callers.
 */
export function highlightTier(
  session: GameSession,
  index: CellIndex,
  conflicts: ReadonlySet<CellIndex> = EMPTY,
): HighlightTier {
  if (session.selection !== null && toIndex(session.selection) === index) return 'selected';
  if (conflicts.has(index)) return 'conflict';
  if (matchingSet(session).has(index)) return 'matching';
  if (crosshairSet(session).has(index)) return 'crosshair';
  return 'none';
}

/**
 * Tiers for the whole board in one pass.
 *
 * The per-cell `highlightTier` recomputes both sets each call, which is fine for
 * a single lookup but wasteful for 81. The Board uses this instead.
 */
export function boardTiers(
  session: GameSession,
  conflicts: ReadonlySet<CellIndex> = EMPTY,
): readonly HighlightTier[] {
  const selected = session.selection === null ? -1 : toIndex(session.selection);
  const crosshair = crosshairSet(session);
  const matching = matchingSet(session);

  return session.cells.map((_cell, index) => {
    if (index === selected) return 'selected';
    if (conflicts.has(index)) return 'conflict';
    if (matching.has(index)) return 'matching';
    if (crosshair.has(index)) return 'crosshair';
    return 'none';
  });
}

/** Exported for tests that assert the crosshair covers row/column/box explicitly. */
export const sharesUnit = (a: CellIndex, b: CellIndex): boolean =>
  rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b);
