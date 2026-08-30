import type { Digit } from './grid';
import { TECHNIQUES, type TechniqueId } from './techniques';
import { attempt } from './techniqueSolver';
import type { Difficulty } from './types';

/**
 * Difficulty derived from the techniques a puzzle actually requires.
 *
 * Principle IV: "A claimed difficulty rating MUST be derived from the solving
 * techniques actually required, not from clue count alone."
 *
 * The rating is TIERED. We attempt the puzzle with progressively larger
 * technique sets and record the smallest set that finishes it:
 *
 *   easy   -- singles alone suffice
 *   medium -- needs locked candidates or naked pairs, and no more
 *   hard   -- demonstrably needs MORE than the medium set
 *
 * The 'hard' rating is a proven lower bound, not a guess: we have run the medium
 * set to exhaustion and watched it stall. That is a statement about techniques
 * required, which is what the principle asks for. It deliberately does not claim
 * to name WHICH harder technique is needed, because naming one we did not derive
 * would be the very thing the principle forbids.
 *
 * Clue count is not an input to this function.
 *
 * PRECONDITION: the board is uniquely solvable. generate.ts proves that with the
 * counting solver before it ever calls this. Rating a board with no solution, or
 * many, is meaningless -- so this function does not attempt to detect it, and
 * keeping that check in the solver preserves single responsibility.
 */

export interface RatingResult {
  readonly difficulty: Difficulty;
  readonly techniquesRequired: readonly TechniqueId[];
}

const byBand = (band: Difficulty) => TECHNIQUES.filter((t) => t.band === band);
const EASY_SET = byBand('easy');
const MEDIUM_SET = [...EASY_SET, ...byBand('medium')];
const FULL_SET = [...MEDIUM_SET, ...byBand('hard')];

export function rateDifficulty(clues: readonly (Digit | null)[]): RatingResult {
  const easy = attempt(clues, EASY_SET);
  if (easy.solved) return { difficulty: 'easy', techniquesRequired: easy.used };

  const medium = attempt(clues, MEDIUM_SET);
  if (medium.solved) return { difficulty: 'medium', techniquesRequired: medium.used };

  // Beyond the medium set. Report the hard-band techniques that did apply, if any.
  const full = attempt(clues, FULL_SET);
  return { difficulty: 'hard', techniquesRequired: full.used };
}
