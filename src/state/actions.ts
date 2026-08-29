import { generatePuzzle } from '@/engine/generate';
import { findConflicts, isFull } from '@/engine/conflicts';
import { peersOf, toIndex, isValidCoord, type Coord, type Digit } from '@/engine/grid';
import { makeRecord, pushRecord, applyRecord, revertRecord, type CellChange } from './history';
import type {
  Cell, CellOrigin, ChangeRecord, Difficulty,
  GameSession, InputMode, Puzzle, RejectionReason,
} from './types';

/**
 * Every mutation the game supports. There is no other write path (Principle III).
 *
 * `origin` is a parameter rather than an assumption so feature 002's agent tools
 * reuse these actions unchanged -- which is what makes 002/FR-042 ("agent changes
 * indistinguishable from a learner's own") true by construction rather than by a
 * later retrofit.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export type Action =
  | { type: 'newPuzzle'; difficulty: Difficulty; seed: number }
  | { type: 'beginGenerating'; difficulty: Difficulty }
  | { type: 'loadPuzzle'; puzzle: Puzzle }
  | { type: 'loadSession'; session: GameSession }
  | { type: 'selectCell'; coord: Coord }
  | { type: 'moveSelection'; direction: Direction }
  | { type: 'setInputMode'; mode: InputMode }
  | { type: 'toggleInputMode' }
  | { type: 'enterDigit'; digit: Digit; origin: CellOrigin }
  | { type: 'toggleCandidate'; digit: Digit; origin: CellOrigin }
  | { type: 'eraseCell'; origin: CellOrigin }
  | { type: 'undo' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'tick'; deltaMs: number };

// --- action creators -------------------------------------------------------

export const newPuzzle = (difficulty: Difficulty, seed: number): Action =>
  ({ type: 'newPuzzle', difficulty, seed });
export const beginGenerating = (difficulty: Difficulty): Action =>
  ({ type: 'beginGenerating', difficulty });
export const loadPuzzle = (puzzle: Puzzle): Action => ({ type: 'loadPuzzle', puzzle });
/** Adopt a whole restored session. The only action that replaces state wholesale. */
export const loadSession = (session: GameSession): Action => ({ type: 'loadSession', session });
export const selectCell = (coord: Coord): Action => ({ type: 'selectCell', coord });
export const moveSelection = (direction: Direction): Action => ({ type: 'moveSelection', direction });
export const setInputMode = (mode: InputMode): Action => ({ type: 'setInputMode', mode });
export const toggleInputMode = (): Action => ({ type: 'toggleInputMode' });
export const enterDigit = (digit: Digit, origin: CellOrigin): Action =>
  ({ type: 'enterDigit', digit, origin });
export const toggleCandidate = (digit: Digit, origin: CellOrigin): Action =>
  ({ type: 'toggleCandidate', digit, origin });
export const eraseCell = (origin: CellOrigin): Action => ({ type: 'eraseCell', origin });
export const undo = (): Action => ({ type: 'undo' });
export const pause = (): Action => ({ type: 'pause' });
export const resume = (): Action => ({ type: 'resume' });
export const tick = (deltaMs: number): Action => ({ type: 'tick', deltaMs });

export const ACTION_TYPES: ReadonlySet<string> = new Set<Action['type']>([
  'newPuzzle', 'beginGenerating', 'loadPuzzle', 'loadSession', 'selectCell', 'moveSelection',
  'setInputMode', 'toggleInputMode', 'enterDigit', 'toggleCandidate', 'eraseCell',
  'undo', 'pause', 'resume', 'tick',
]);

// --- helpers ---------------------------------------------------------------

export type ReducerOutcome =
  | { readonly ok: true; readonly session: GameSession | null }
  | { readonly ok: false; readonly reason: RejectionReason };

const reject = (reason: RejectionReason) => ({ ok: false as const, reason });
const commit = (session: GameSession | null) => ({ ok: true as const, session });

function cellsFromPuzzle(puzzle: Puzzle): Cell[] {
  return puzzle.clues.map((clue) => ({
    value: clue,
    candidates: new Set<Digit>(),
    origin: (clue === null ? 'player' : 'clue') as CellOrigin,
  }));
}

/**
 * Apply a record, push it to history, and settle the resulting status.
 *
 * Completion is detected here rather than in the UI so it holds for every actor:
 * the agent filling the last cell in feature 002 completes the puzzle exactly as
 * a human does (FR-037).
 */
function withRecord(session: GameSession, record: ChangeRecord): GameSession {
  const cells = applyRecord(session.cells, record);
  const values = cells.map((cell) => cell.value);
  const complete = isFull(values) && findConflicts(values).size === 0;

  return {
    ...session,
    cells,
    history: pushRecord(session, record),
    status: complete ? 'complete' : session.status,
  };
}

const DELTA: Record<Direction, readonly [number, number]> = {
  up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1],
};

// --- the reducer -----------------------------------------------------------

export function reduce(session: GameSession, action: Action): ReducerOutcome {
  switch (action.type) {
    case 'newPuzzle': {
      const result = generatePuzzle({ difficulty: action.difficulty, seed: action.seed });
      if (!result.ok) {
        // Never fall back to an unverified puzzle. Stay in generating and let the
        // caller retry (Principle IV).
        return commit({ ...session, status: 'generating', history: [], elapsedMs: 0, selection: null });
      }
      return commit(loadInto(session, result.puzzle));
    }

    case 'beginGenerating':
      return commit({
        ...session, status: 'generating', history: [], elapsedMs: 0, selection: null,
      });

    case 'loadPuzzle':
      return commit(loadInto(session, action.puzzle));

    case 'loadSession':
      // Restored sessions arrive already validated by persistence.restoreSession,
      // which discards anything malformed rather than partially applying it.
      return commit(action.session);

    case 'selectCell': {
      if (!isValidCoord(action.coord)) return reject('out-of-range');
      // Report "no change" when the cell is already selected. Focus and
      // selection are kept in step by the View, so an unconditional new object
      // here would re-render on every focus event for no reason.
      if (
        session.selection !== null &&
        session.selection.row === action.coord.row &&
        session.selection.col === action.coord.col
      ) {
        return commit(null);
      }
      return commit({ ...session, selection: { ...action.coord } });
    }

    case 'moveSelection': {
      if (session.selection === null) return reject('no-selection');
      const [dr, dc] = DELTA[action.direction];
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

    case 'setInputMode':
      if (session.inputMode === action.mode) return commit(null);
      return commit({ ...session, inputMode: action.mode });

    case 'toggleInputMode':
      return commit({ ...session, inputMode: session.inputMode === 'normal' ? 'notes' : 'normal' });

    case 'enterDigit': {
      const guard = guardCellEdit(session);
      if (!guard.ok) return guard;
      const { index, cell } = guard;

      const before: CellChange[] = [{ index, cell }];
      const after: CellChange[] = [
        { index, cell: { value: action.digit, candidates: new Set<Digit>(), origin: action.origin } },
      ];

      // Auto-remove the digit from peer candidates, IN THE SAME RECORD, so one
      // undo restores the placement and every stripped candidate together (FR-024).
      for (const peer of peersOf(index)) {
        const peerCell = session.cells[peer]!;
        if (!peerCell.candidates.has(action.digit)) continue;
        const trimmed = new Set(peerCell.candidates);
        trimmed.delete(action.digit);
        before.push({ index: peer, cell: peerCell });
        after.push({ index: peer, cell: { ...peerCell, candidates: trimmed } });
      }

      return commit(withRecord(session, makeRecord('enterDigit', before, after)));
    }

    case 'toggleCandidate': {
      const guard = guardCellEdit(session);
      if (!guard.ok) return guard;
      const { index, cell } = guard;

      // A cell holding a value has no candidates to pencil (FR-017's inverse).
      if (cell.value !== null) return reject('cell-not-empty');

      const candidates = new Set(cell.candidates);
      if (!candidates.delete(action.digit)) candidates.add(action.digit);

      return commit(
        withRecord(
          session,
          makeRecord(
            'toggleCandidate',
            [{ index, cell }],
            [{ index, cell: { ...cell, candidates, origin: action.origin } }],
          ),
        ),
      );
    }

    case 'eraseCell': {
      const guard = guardCellEdit(session);
      if (!guard.ok) return guard;
      const { index, cell } = guard;

      if (cell.value === null && cell.candidates.size === 0) return commit(null);

      const cleared: Cell = { value: null, candidates: new Set<Digit>(), origin: action.origin };
      return commit(
        withRecord(session, makeRecord('eraseCell', [{ index, cell }], [{ index, cell: cleared }])),
      );
    }

    case 'undo': {
      const record = session.history.at(-1);
      if (!record) return reject('nothing-to-undo');

      // No distinction by origin: an agent's change reverses exactly like a
      // human's, which is what 002/FR-042 requires and why it is true here by
      // construction rather than added later.
      const cells = revertRecord(session.cells, record);

      return commit({
        ...session,
        cells,
        history: session.history.slice(0, -1),
        // Undoing out of a completed board returns it to play.
        status: session.status === 'complete' ? 'playing' : session.status,
      });
    }

    case 'pause':
      if (session.status !== 'playing') return reject('wrong-status');
      return commit({ ...session, status: 'paused' });

    case 'resume':
      if (session.status !== 'paused') return reject('wrong-status');
      return commit({ ...session, status: 'playing' });

    case 'tick':
      // Rejected while paused and while complete, so a stopped clock really
      // stops (FR-035) and a finished one stays finished (FR-036).
      if (session.status !== 'playing') return reject('wrong-status');
      if (action.deltaMs <= 0) return commit(null);
      return commit({ ...session, elapsedMs: session.elapsedMs + action.deltaMs });

    default:
      return reject('unknown-action');
  }
}

function loadInto(session: GameSession, puzzle: Puzzle): GameSession {
  return {
    ...session,
    puzzle,
    cells: cellsFromPuzzle(puzzle),
    selection: null,
    status: 'playing',
    elapsedMs: 0,
    history: [], // undo never crosses a puzzle boundary (FR-033)
  };
}

/** Shared preconditions for any action that edits a cell. */
function guardCellEdit(
  session: GameSession,
):
  | { ok: true; index: number; cell: Cell }
  | { ok: false; reason: RejectionReason } {
  if (session.status !== 'playing') return reject('wrong-status');
  if (session.selection === null) return reject('no-selection');

  const index = toIndex(session.selection);
  const cell = session.cells[index];
  if (!cell) return reject('out-of-range');
  if (cell.origin === 'clue') return reject('cell-is-clue');

  return { ok: true, index, cell };
}
