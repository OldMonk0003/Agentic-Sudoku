import { isValidCoord, type Coord } from '@/engine/grid';
import type { GameSession, InputMode } from './types';
import type { ReducerOutcome } from './outcome';
import { commit, reject } from './outcome';

/**
 * Selection and input mode -- where the learner is looking, and what typing means.
 *
 * Split out of actions.ts when feature 002 pushed that file past Principle III's
 * 300-line review trigger. Nothing here changed in the move.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

const DELTA: Record<Direction, readonly [number, number]> = {
  up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1],
};

export function selectCellAt(session: GameSession, coord: Coord): ReducerOutcome {
  if (!isValidCoord(coord)) return reject('out-of-range');

  // Report "no change" when the cell is already selected. Focus and selection
  // are kept in step by the View, so an unconditional new object here would
  // re-render on every focus event for no reason.
  if (
    session.selection !== null &&
    session.selection.row === coord.row &&
    session.selection.col === coord.col
  ) {
    return commit(null);
  }
  return commit({ ...session, selection: { row: coord.row, col: coord.col } });
}

export function moveSelectionBy(session: GameSession, direction: Direction): ReducerOutcome {
  if (session.selection === null) return reject('no-selection');

  const [dr, dc] = DELTA[direction];
  // Clamp at the boundary rather than wrapping (FR-019).
  const next = {
    row: Math.min(9, Math.max(1, session.selection.row + dr)),
    col: Math.min(9, Math.max(1, session.selection.col + dc)),
  };
  if (next.row === session.selection.row && next.col === session.selection.col) {
    return commit(null);
  }
  return commit({ ...session, selection: next });
}

export function setMode(session: GameSession, mode: InputMode): ReducerOutcome {
  if (session.inputMode === mode) return commit(null);
  return commit({ ...session, inputMode: mode });
}

export function toggleMode(session: GameSession): ReducerOutcome {
  return commit({ ...session, inputMode: session.inputMode === 'normal' ? 'notes' : 'normal' });
}
