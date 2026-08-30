import { findConflicts, isFull } from '@/engine/conflicts';
import { allCandidates } from '@/engine/candidates';
import { ALL_INDICES, peersOf, toIndex, isValidCoord, type Coord, type Digit } from '@/engine/grid';
import { makeRecord, pushRecord, applyRecord, type CellChange } from './history';
import type { Cell, CellOrigin, ChangeRecord, GameSession } from './types';
import type { ReducerOutcome } from './outcome';
import { commit, reject } from './outcome';

/**
 * Every mutation of a cell -- digits, candidates, erasure.
 *
 * Split out of actions.ts when feature 002 pushed that file past Principle III's
 * 300-line review trigger.
 *
 * The COORDINATE-ADDRESSED forms are the real implementations and the
 * selection-based ones delegate to them. That ordering matters: an agent must
 * never move the learner's selection (FR-056), so it addresses cells directly --
 * and having the human path delegate means both actors run one implementation
 * rather than two that drift.
 */

/**
 * Apply a record, push it to history, and settle the resulting status.
 *
 * Completion is detected here rather than in the UI so it holds for every actor:
 * the agent filling the last cell completes the puzzle exactly as a human does
 * (FR-037 in 001, FR-038 in 002).
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

/** Shared preconditions for editing a NAMED cell. */
function guardCellAt(
  session: GameSession,
  coord: Coord,
): { ok: true; index: number; cell: Cell } | { ok: false; reason: 'cell-is-clue' | 'out-of-range' | 'wrong-status' } {
  if (session.status !== 'playing') return { ok: false, reason: 'wrong-status' };
  if (!isValidCoord(coord)) return { ok: false, reason: 'out-of-range' };

  const index = toIndex(coord);
  const cell = session.cells[index];
  if (!cell) return { ok: false, reason: 'out-of-range' };
  if (cell.origin === 'clue') return { ok: false, reason: 'cell-is-clue' };

  return { ok: true, index, cell };
}

/** The same preconditions, for whichever cell the learner has selected. */
function guardSelected(
  session: GameSession,
): { ok: true; index: number; cell: Cell; coord: Coord } | { ok: false; reason: 'cell-is-clue' | 'out-of-range' | 'wrong-status' | 'no-selection' } {
  if (session.status !== 'playing') return { ok: false, reason: 'wrong-status' };
  if (session.selection === null) return { ok: false, reason: 'no-selection' };

  const guard = guardCellAt(session, session.selection);
  if (!guard.ok) return guard;
  return { ...guard, coord: session.selection };
}

// --- coordinate-addressed: the real implementations ------------------------

export function placeDigitAt(
  session: GameSession,
  coord: Coord,
  digit: Digit,
  origin: CellOrigin,
): ReducerOutcome {
  const guard = guardCellAt(session, coord);
  if (!guard.ok) return reject(guard.reason);
  const { index, cell } = guard;

  // An agent must not overwrite a digit already on the board (002/FR-037). The
  // learner's own path never hits this, because their keypress replaces their
  // own entry -- so the check is on the AGENT-shaped call, not on the actor.
  if (origin === 'agent' && cell.value !== null) return reject('cell-not-empty');

  const before: CellChange[] = [{ index, cell }];
  const after: CellChange[] = [
    { index, cell: { value: digit, candidates: new Set<Digit>(), origin } },
  ];

  // Auto-remove the digit from peer candidates, IN THE SAME RECORD, so one undo
  // restores the placement and every stripped candidate together (FR-024).
  for (const peer of peersOf(index)) {
    const peerCell = session.cells[peer]!;
    if (!peerCell.candidates.has(digit)) continue;
    const trimmed = new Set(peerCell.candidates);
    trimmed.delete(digit);
    before.push({ index: peer, cell: peerCell });
    after.push({ index: peer, cell: { ...peerCell, candidates: trimmed } });
  }

  return commit(withRecord(session, makeRecord('enterDigit', before, after)));
}

export function toggleCandidateAt(
  session: GameSession,
  coord: Coord,
  digit: Digit,
  origin: CellOrigin,
): ReducerOutcome {
  const guard = guardCellAt(session, coord);
  if (!guard.ok) return reject(guard.reason);
  const { index, cell } = guard;

  // A cell holding a value has no candidates to pencil (FR-017's inverse).
  if (cell.value !== null) return reject('cell-not-empty');

  const candidates = new Set(cell.candidates);
  if (!candidates.delete(digit)) candidates.add(digit);

  return commit(
    withRecord(
      session,
      makeRecord(
        'toggleCandidate',
        [{ index, cell }],
        [{ index, cell: { ...cell, candidates, origin } }],
      ),
    ),
  );
}

export function eraseCellAt(session: GameSession, coord: Coord, origin: CellOrigin): ReducerOutcome {
  const guard = guardCellAt(session, coord);
  if (!guard.ok) return reject(guard.reason);
  const { index, cell } = guard;

  if (cell.value === null && cell.candidates.size === 0) return commit(null);

  const cleared: Cell = { value: null, candidates: new Set<Digit>(), origin };
  return commit(
    withRecord(session, makeRecord('eraseCell', [{ index, cell }], [{ index, cell: cleared }])),
  );
}

// --- selection-based: what the learner's keyboard and keypad dispatch -------

export function placeDigitInSelection(
  session: GameSession,
  digit: Digit,
  origin: CellOrigin,
): ReducerOutcome {
  const guard = guardSelected(session);
  if (!guard.ok) return reject(guard.reason);
  return placeDigitAt(session, guard.coord, digit, origin);
}

export function toggleCandidateInSelection(
  session: GameSession,
  digit: Digit,
  origin: CellOrigin,
): ReducerOutcome {
  const guard = guardSelected(session);
  if (!guard.ok) return reject(guard.reason);
  return toggleCandidateAt(session, guard.coord, digit, origin);
}

export function eraseSelection(session: GameSession, origin: CellOrigin): ReducerOutcome {
  const guard = guardSelected(session);
  if (!guard.ok) return reject(guard.reason);
  return eraseCellAt(session, guard.coord, origin);
}

// --- bulk candidate writes -------------------------------------------------

export interface CandidateEntry {
  readonly coord: Coord;
  readonly digits: readonly Digit[];
}

/**
 * Set the candidates of several cells, as ONE undoable step (002/FR-039, FR-043).
 *
 * ALL-OR-NOTHING, and that is not a convenience: one explanation accompanied the
 * call, so a partially applied batch would be narrated by text that no longer
 * describes what happened. Every entry is validated before any is applied.
 */
export function setCandidatesForCells(
  session: GameSession,
  entries: readonly CandidateEntry[],
  origin: CellOrigin,
): ReducerOutcome {
  if (session.status !== 'playing') return reject('wrong-status');
  if (entries.length === 0) return commit(null);

  const before: CellChange[] = [];
  const after: CellChange[] = [];

  for (const { coord, digits } of entries) {
    const guard = guardCellAt(session, coord);
    if (!guard.ok) return reject(guard.reason);
    if (guard.cell.value !== null) return reject('cell-not-empty');

    before.push({ index: guard.index, cell: guard.cell });
    after.push({
      index: guard.index,
      cell: { ...guard.cell, candidates: new Set<Digit>(digits), origin },
    });
  }

  return commit(withRecord(session, makeRecord('setCandidatesAt', before, after)));
}

/**
 * Pencil every empty cell with exactly the digits still legal there (002/FR-040).
 *
 * Derived from `allCandidates`, which reads the VISIBLE board and nothing else --
 * so this is wrong in exactly the ways the learner's own pencilling would be
 * wrong, and it cannot leak the solution (002/FR-026, FR-058). That property is
 * structural: no function above the Engine can see an answer.
 *
 * One record for all 81 cells, so one undo restores whatever the learner had
 * written by hand (002/FR-043).
 */
export function fillEveryCandidate(session: GameSession, origin: CellOrigin): ReducerOutcome {
  if (session.status !== 'playing') return reject('wrong-status');

  const values = session.cells.map((cell) => cell.value);
  const legal = allCandidates(values);

  const before: CellChange[] = [];
  const after: CellChange[] = [];

  for (const index of ALL_INDICES) {
    const cell = session.cells[index]!;
    if (cell.value !== null || cell.origin === 'clue') continue;

    const digits = new Set<Digit>(legal[index]!);
    const unchanged =
      digits.size === cell.candidates.size && [...digits].every((d) => cell.candidates.has(d));
    if (unchanged) continue;

    before.push({ index, cell });
    after.push({ index, cell: { ...cell, candidates: digits, origin } });
  }

  if (before.length === 0) return commit(null);
  return commit(withRecord(session, makeRecord('fillAllCandidates', before, after)));
}

/** How many empty cells carry candidates the LEARNER wrote (002/FR-041). */
export function handWrittenCandidateCount(session: GameSession): number {
  return session.cells.filter(
    (cell) => cell.value === null && cell.origin === 'player' && cell.candidates.size > 0,
  ).length;
}
