import { generatePuzzle } from '@/engine/generate';
import { revertRecord } from './history';
import type { CellOrigin, Difficulty, GameSession, Puzzle } from './types';
import type { ReducerOutcome } from './outcome';
import { commit, reject } from './outcome';

/**
 * The session's life: which puzzle, whether the clock runs, and stepping back.
 *
 * Split out of actions.ts when feature 002 pushed that file past Principle III's
 * 300-line review trigger. Nothing here changed in the move.
 */

export function loadInto(session: GameSession, puzzle: Puzzle): GameSession {
  return {
    ...session,
    puzzle,
    cells: puzzle.clues.map((clue) => ({
      value: clue,
      candidates: new Set<never>(),
      origin: (clue === null ? 'player' : 'clue') as CellOrigin,
    })),
    selection: null,
    status: 'playing',
    elapsedMs: 0,
    history: [], // undo never crosses a puzzle boundary (FR-033)
  };
}

export function generateInto(
  session: GameSession,
  difficulty: Difficulty,
  seed: number,
): ReducerOutcome {
  const result = generatePuzzle({ difficulty, seed });
  if (!result.ok) {
    // Never fall back to an unverified puzzle. Stay in generating and let the
    // caller retry (Principle IV).
    return commit({ ...session, status: 'generating', history: [], elapsedMs: 0, selection: null });
  }
  return commit(loadInto(session, result.puzzle));
}

export function beginGeneratingIn(session: GameSession): ReducerOutcome {
  return commit({ ...session, status: 'generating', history: [], elapsedMs: 0, selection: null });
}

export function undoLast(session: GameSession): ReducerOutcome {
  const record = session.history.at(-1);
  if (!record) return reject('nothing-to-undo');

  // No distinction by origin: an agent's change reverses exactly like a
  // human's, which is what 002/FR-042 requires and why it is true here by
  // construction rather than added later.
  return commit({
    ...session,
    cells: revertRecord(session.cells, record),
    history: session.history.slice(0, -1),
    // Undoing out of a completed board returns it to play.
    status: session.status === 'complete' ? 'playing' : session.status,
  });
}

export function pauseSession(session: GameSession): ReducerOutcome {
  if (session.status !== 'playing') return reject('wrong-status');
  return commit({ ...session, status: 'paused' });
}

export function resumeSession(session: GameSession): ReducerOutcome {
  if (session.status !== 'paused') return reject('wrong-status');
  return commit({ ...session, status: 'playing' });
}

export function advanceClock(session: GameSession, deltaMs: number): ReducerOutcome {
  // Rejected while paused and while complete, so a stopped clock really stops
  // (FR-035) and a finished one stays finished (FR-036).
  if (session.status !== 'playing') return reject('wrong-status');
  if (deltaMs <= 0) return commit(null);
  return commit({ ...session, elapsedMs: session.elapsedMs + deltaMs });
}
