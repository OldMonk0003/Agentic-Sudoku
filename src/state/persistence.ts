import { countSolutions } from '@/engine/solver';
import { rateDifficulty } from '@/engine/rating';
import { parsePuzzleString, toPuzzleString } from '@/engine/puzzleString';
import type { Digit } from '@/engine/grid';
import type { Difficulty, Puzzle } from '@/engine/types';
import type { Cell, CellOrigin, GameSession, SessionStatus } from './types';
import type { Store } from './store';

/**
 * On-device session persistence.
 *
 * Two rules shape this file:
 *
 *   1. **Stored data is untrusted input.** It can be hand-edited, truncated, or
 *      written by an older build. Every read is validated and any failure
 *      discards the payload and starts fresh -- a broken save must never become a
 *      broken game (FR-042, FR-044).
 *   2. **The solution never lands here.** The payload carries the puzzle's
 *      clues, not its answer, so nothing the page can read back reveals it
 *      (constitution, solution quarantine).
 *
 * Every storage call is wrapped: a throwing backend (private mode, full quota,
 * blocked cookies) is a normal operating condition, not an error path.
 */

export const STORAGE_KEY = 'agentic-sudoku/session';
const SCHEMA_VERSION = 1;

/** The subset of the Storage interface this module needs -- injectable for tests. */
export interface MemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface PersistedSession {
  readonly schemaVersion: number;
  readonly puzzleString: string;
  readonly difficulty: Difficulty;
  /** 81 chars, '-' for empty. */
  readonly values: string;
  /** 81 chars of 'c' | 'p' | 'a'. */
  readonly origins: string;
  /** 81 entries; digits as a string, e.g. "1479". */
  readonly candidates: readonly string[];
  readonly elapsedMs: number;
  readonly status: 'playing' | 'paused' | 'complete';
}

const ORIGIN_CODE: Record<CellOrigin, string> = { clue: 'c', player: 'p', agent: 'a' };
const ORIGIN_OF: Record<string, CellOrigin> = { c: 'clue', p: 'player', a: 'agent' };
const DIFFICULTIES: readonly string[] = ['easy', 'medium', 'hard'];
const PERSISTED_STATUSES: readonly string[] = ['playing', 'paused', 'complete'];

function defaultStorage(): MemoryStorage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Accessing localStorage itself throws in some privacy configurations.
    return null;
  }
}

/**
 * Write the session. Returns false on any failure -- never throws, so a storage
 * problem cannot propagate into a dispatch (FR-042).
 */
export function serialiseSession(
  session: GameSession,
  storage: MemoryStorage | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  if (session.puzzle === null) return false;
  if (session.status === 'generating') return false;

  try {
    const payload: PersistedSession = {
      schemaVersion: SCHEMA_VERSION,
      puzzleString: session.puzzle.puzzleString,
      difficulty: session.puzzle.difficulty,
      values: session.cells.map((c) => (c.value === null ? '-' : String(c.value))).join(''),
      origins: session.cells.map((c) => ORIGIN_CODE[c.origin]).join(''),
      candidates: session.cells.map((c) => [...c.candidates].sort().join('')),
      elapsedMs: session.elapsedMs,
      status: session.status,
      // Deliberately absent: history, selection, inputMode, derived sets, and
      // above all the solution.
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function isPersisted(value: unknown): value is PersistedSession {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;

  return (
    v.schemaVersion === SCHEMA_VERSION &&
    typeof v.puzzleString === 'string' &&
    v.puzzleString.length === 81 &&
    typeof v.difficulty === 'string' &&
    DIFFICULTIES.includes(v.difficulty) &&
    typeof v.values === 'string' &&
    v.values.length === 81 &&
    typeof v.origins === 'string' &&
    v.origins.length === 81 &&
    [...v.origins].every((ch) => ch in ORIGIN_OF) &&
    Array.isArray(v.candidates) &&
    v.candidates.length === 81 &&
    v.candidates.every((c) => typeof c === 'string' && /^[1-9]*$/.test(c)) &&
    typeof v.elapsedMs === 'number' &&
    Number.isFinite(v.elapsedMs) &&
    v.elapsedMs >= 0 &&
    typeof v.status === 'string' &&
    PERSISTED_STATUSES.includes(v.status)
  );
}

/**
 * Read a saved session, or null if there is nothing usable.
 *
 * Returns null -- never throws, never partially restores -- for a missing entry,
 * an unknown schema version, a malformed payload, an unreadable backend, or a
 * puzzle that no longer satisfies Principle IV's uniqueness rule.
 */
export function restoreSession(
  storage: MemoryStorage | null = defaultStorage(),
): GameSession | null {
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPersisted(parsed)) return null;

  try {
    const clues = parsePuzzleString(parsed.puzzleString);

    // Stored data is untrusted: a tampered payload must not smuggle a puzzle
    // past the uniqueness rule every generated puzzle has to satisfy.
    if (countSolutions(clues) !== 1) return null;

    // The rating is DERIVED, never taken on trust from storage (Principle IV).
    const rating = rateDifficulty(clues);

    const puzzle: Puzzle = {
      clues,
      difficulty: rating.difficulty,
      puzzleString: toPuzzleString(clues),
      techniquesRequired: rating.techniquesRequired,
    };

    const cells: Cell[] = Array.from({ length: 81 }, (_unused, index) => {
      const ch = parsed.values[index]!;
      const value = ch === '-' ? null : (Number(ch) as Digit);
      if (value !== null && (value < 1 || value > 9)) throw new RangeError('bad value');

      return {
        value,
        origin: ORIGIN_OF[parsed.origins[index]!]!,
        candidates: new Set(
          [...(parsed.candidates[index] ?? '')].map((d) => Number(d) as Digit),
        ),
      };
    });

    // A restored clue must still match the puzzle it claims to belong to.
    for (let index = 0; index < 81; index++) {
      const isClue = cells[index]!.origin === 'clue';
      if (isClue !== (clues[index] !== null)) return null;
      if (isClue && cells[index]!.value !== clues[index]) return null;
    }

    return {
      puzzle,
      cells,
      selection: null,
      inputMode: 'normal',
      elapsedMs: parsed.elapsedMs,
      status: parsed.status as SessionStatus,
      history: [], // undo does not survive a reload (data-model.md)
    };
  } catch {
    return null;
  }
}

export function clearSession(storage: MemoryStorage | null = defaultStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do -- an unclearable store is not a player-facing problem.
  }
}

/**
 * Subscribe persistence to the store, debounced so a burst of keystrokes writes
 * once rather than once per cell.
 *
 * `onFailure` fires at most once, so the player is told a single time that
 * progress will not be saved (FR-042).
 */
export function attachPersistence(
  store: Store,
  options: { debounceMs?: number; onFailure?: () => void } = {},
): () => void {
  const { debounceMs = 250, onFailure } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let reported = false;

  const flush = (): void => {
    timer = null;
    const session = store.getState();
    if (session.puzzle === null || session.status === 'generating') return;

    if (!serialiseSession(session) && !reported) {
      reported = true;
      onFailure?.();
    }
  };

  const unsubscribe = store.subscribe(() => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  });

  return () => {
    if (timer !== null) clearTimeout(timer);
    unsubscribe();
  };
}
