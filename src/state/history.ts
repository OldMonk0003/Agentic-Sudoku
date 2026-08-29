import type { Cell, ChangeRecord, GameSession } from './types';
import type { CellIndex } from '@/engine/grid';

/**
 * Undo machinery.
 *
 * This lives in the Foundational layer rather than with the Undo control
 * (User Story 5) on purpose: if history recording waited for that story, every
 * earlier action would need retrofitting. Actions record from the moment they
 * exist; US5 adds only the button.
 */

export interface CellChange {
  readonly index: CellIndex;
  readonly cell: Cell;
}

/** Build a record from the cells an action touched. Both sides must cover the same indices. */
export function makeRecord(action: string, before: CellChange[], after: CellChange[]): ChangeRecord {
  return Object.freeze({
    action,
    before: Object.freeze([...before]),
    after: Object.freeze([...after]),
  });
}

export function pushRecord(session: GameSession, record: ChangeRecord): readonly ChangeRecord[] {
  return [...session.history, record];
}

/** Apply a record's `after` side -- used when an action commits. */
export function applyRecord(cells: readonly Cell[], record: ChangeRecord): readonly Cell[] {
  const next = [...cells];
  for (const { index, cell } of record.after) next[index] = cell;
  return next;
}

/** Replay a record's `before` side -- this is what Undo does. */
export function revertRecord(cells: readonly Cell[], record: ChangeRecord): readonly Cell[] {
  const next = [...cells];
  for (const { index, cell } of record.before) next[index] = cell;
  return next;
}

export function canUndo(session: GameSession): boolean {
  return session.history.length > 0;
}
