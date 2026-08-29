import { getSudoku } from 'sudoku-gen';
import { countSolutions } from './solver';
import { rateDifficulty } from './rating';
import { parsePuzzleString, toPuzzleString } from './puzzleString';
import { createPrng } from './prng';
import type { Difficulty, Puzzle } from './types';

/**
 * Puzzle generation.
 *
 * Two constitutional obligations shape this, and neither is optional:
 *
 *   1. sudoku-gen claims no uniqueness. Every candidate is verified by OUR
 *      counting solver before it can reach a player. A generator's claim of
 *      validity is not evidence (Principle IV).
 *   2. sudoku-gen rates by an undocumented measure. Every candidate is re-rated
 *      by which techniques it actually requires, and redrawn on a mismatch.
 *
 * The solution sudoku-gen returns is deliberately DISCARDED here. It never
 * enters the returned value, so it cannot reach State, persistence, or -- at
 * feature 002 -- an agent tool result.
 */

export interface GenerateRequest {
  readonly difficulty: Difficulty;
  readonly seed: number;
  /** Default 60. At P(hard)=0.372 per draw that is a ~1e-13 exhaustion rate. */
  readonly maxAttempts?: number;
}

export type GenerateResult =
  | { readonly ok: true; readonly puzzle: Puzzle; readonly attempts: number }
  | { readonly ok: false; readonly reason: 'exhausted-attempts'; readonly attempts: number };

/**
 * Which sudoku-gen bands to draw from for each of our three difficulties.
 *
 * These do NOT line up with sudoku-gen's own labels, and that is the point:
 * measured against our technique set, its 'easy' and 'medium' are both
 * singles-only, while our medium and hard live in its 'hard' and 'expert'. The
 * label is a hint about where to look; the rating comes from rateDifficulty.
 */
const SOURCE_BANDS: Record<Difficulty, readonly ('easy' | 'medium' | 'hard' | 'expert')[]> = {
  easy: ['easy', 'medium'],
  medium: ['hard', 'expert'],
  // 'expert' only. MEASURED per-draw hit rate for our hard band (n=400 each):
  // sudoku-gen 'hard' 0.125, 'expert' 0.372. Drawing 50/50 gave ~0.25 per
  // attempt, so 25 attempts exhausted roughly 1 generation in 1350 -- rare
  // enough to look like a flaky test and frequent enough to strand a real
  // player on a blank board. Expert-only plus a higher cap makes it negligible.
  hard: ['expert'],
};

export function generatePuzzle(request: GenerateRequest): GenerateResult {
  const { difficulty, seed, maxAttempts = 60 } = request;
  const prng = createPrng(seed);
  const bands = SOURCE_BANDS[difficulty];

  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;

    const band = bands[Math.floor(prng() * bands.length)] ?? bands[0]!;
    const drawn = getSudoku(band);
    const clues = parsePuzzleString(drawn.puzzle);

    // 1. Uniqueness, proven by our own solver. Never trust the library.
    if (countSolutions(clues) !== 1) continue;

    // 2. Difficulty, derived from techniques required.
    const rating = rateDifficulty(clues);
    if (rating.difficulty !== difficulty) continue;

    const puzzle: Puzzle = {
      clues,
      difficulty: rating.difficulty,
      puzzleString: toPuzzleString(clues),
      techniquesRequired: rating.techniquesRequired,
    };
    return { ok: true, puzzle, attempts };
  }

  return { ok: false, reason: 'exhausted-attempts', attempts };
}
