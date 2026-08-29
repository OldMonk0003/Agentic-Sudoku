import type { CellIndex, Coord, Digit } from '@/engine/grid';

// Difficulty and Puzzle are produced by the Engine, so they are owned there.
// State consumes and re-exports them -- the dependency runs engine <- state.
export type { Difficulty, Puzzle } from '@/engine/types';
import type { Puzzle } from '@/engine/types';

/**
 * Who put a value in a cell. 'agent' is reserved for feature 002 and is carried
 * here from the start so the agent path reuses these types unchanged.
 */
export type CellOrigin = 'clue' | 'player' | 'agent';

export interface Cell {
  readonly value: Digit | null;
  readonly candidates: ReadonlySet<Digit>;
  readonly origin: CellOrigin;
}

export type SessionStatus = 'generating' | 'playing' | 'paused' | 'complete';
export type InputMode = 'normal' | 'notes';

/**
 * One undoable step. A record captures EVERYTHING one action altered --
 * including candidates stripped automatically as a consequence -- so a single
 * undo restores the exact prior state (FR-024).
 */
export interface ChangeRecord {
  readonly action: string;
  readonly before: readonly { readonly index: CellIndex; readonly cell: Cell }[];
  readonly after: readonly { readonly index: CellIndex; readonly cell: Cell }[];
}

export interface GameSession {
  readonly puzzle: Puzzle | null;
  readonly cells: readonly Cell[];
  readonly selection: Coord | null;
  readonly inputMode: InputMode;
  readonly elapsedMs: number;
  readonly status: SessionStatus;
  readonly history: readonly ChangeRecord[];
}

export type RejectionReason =
  | 'cell-is-clue'
  | 'cell-not-empty'
  | 'out-of-range'
  | 'wrong-status'
  | 'nothing-to-undo'
  | 'no-selection'
  | 'unknown-action';

export type DispatchResult =
  | { readonly ok: true; readonly changed: boolean }
  | { readonly ok: false; readonly reason: RejectionReason };

export const EMPTY_CELL: Cell = Object.freeze({
  value: null,
  candidates: Object.freeze(new Set<Digit>()),
  origin: 'player' as const,
});
