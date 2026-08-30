import type { Coord, Digit } from '@/engine/grid';
import type { CellOrigin, Difficulty, GameSession, InputMode, Puzzle } from './types';
import type { Direction } from './navigation';

/**
 * The vocabulary of state change: every action the game supports, and nothing
 * else. There is no other write path (Principle III).
 *
 * `origin` is a parameter rather than an assumption so feature 002's agent tools
 * reuse these actions unchanged -- which is what makes 002/FR-042 ("an agent's
 * move undoes exactly like a human's") true by construction rather than by a
 * later retrofit.
 *
 * The COORDINATE-ADDRESSED variants (`enterDigitAt` and friends) exist because
 * an agent must never move the learner's selection: the learner may be mid-thought
 * on another cell, and 002/FR-056 gives them uninterrupted control. The
 * selection-based forms delegate to them, so both actors run one implementation.
 *
 * The handlers live in navigation.ts, edits.ts, and lifecycle.ts; reduce.ts
 * routes to them. This file was split when 002's actions pushed it past
 * Principle III's 300-line review trigger.
 */

export type { Direction } from './navigation';
export type { ReducerOutcome } from './outcome';
export { reduce } from './reduce';

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
  | { type: 'enterDigitAt'; coord: Coord; digit: Digit; origin: CellOrigin }
  | { type: 'toggleCandidate'; digit: Digit; origin: CellOrigin }
  | { type: 'toggleCandidateAt'; coord: Coord; digit: Digit; origin: CellOrigin }
  | { type: 'setCandidatesAt'; entries: readonly { coord: Coord; digits: readonly Digit[] }[]; origin: CellOrigin }
  | { type: 'fillAllCandidates'; origin: CellOrigin }
  | { type: 'eraseCell'; origin: CellOrigin }
  | { type: 'eraseCellAt'; coord: Coord; origin: CellOrigin }
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
/** Coordinate-addressed. Does not touch the learner's selection (002/FR-056). */
export const enterDigitAt = (coord: Coord, digit: Digit, origin: CellOrigin): Action =>
  ({ type: 'enterDigitAt', coord, digit, origin });

export const toggleCandidate = (digit: Digit, origin: CellOrigin): Action =>
  ({ type: 'toggleCandidate', digit, origin });
export const toggleCandidateAt = (coord: Coord, digit: Digit, origin: CellOrigin): Action =>
  ({ type: 'toggleCandidateAt', coord, digit, origin });

/** Many cells, ONE undo step, all-or-nothing (002/FR-039, FR-043). */
export const setCandidatesAt = (
  entries: readonly { coord: Coord; digits: readonly Digit[] }[],
  origin: CellOrigin,
): Action => ({ type: 'setCandidatesAt', entries, origin });
/** The whole board, ONE undo step (002/FR-040, FR-043). */
export const fillAllCandidates = (origin: CellOrigin): Action =>
  ({ type: 'fillAllCandidates', origin });

export const eraseCell = (origin: CellOrigin): Action => ({ type: 'eraseCell', origin });
export const eraseCellAt = (coord: Coord, origin: CellOrigin): Action =>
  ({ type: 'eraseCellAt', coord, origin });

export const undo = (): Action => ({ type: 'undo' });
export const pause = (): Action => ({ type: 'pause' });
export const resume = (): Action => ({ type: 'resume' });
export const tick = (deltaMs: number): Action => ({ type: 'tick', deltaMs });

export const ACTION_TYPES: ReadonlySet<string> = new Set<Action['type']>([
  'newPuzzle', 'beginGenerating', 'loadPuzzle', 'loadSession', 'selectCell', 'moveSelection',
  'setInputMode', 'toggleInputMode',
  'enterDigit', 'enterDigitAt', 'toggleCandidate', 'toggleCandidateAt', 'eraseCell', 'eraseCellAt',
  'setCandidatesAt', 'fillAllCandidates',
  'undo', 'pause', 'resume', 'tick',
]);
