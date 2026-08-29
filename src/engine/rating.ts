import { peersOf, toIndex, type Digit } from './grid';
import { allCandidates } from './candidates';
import { TECHNIQUES, type Technique, type TechniqueId } from './techniques';
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

type SolveOutcome =
  | { readonly solved: true; readonly used: readonly TechniqueId[] }
  | { readonly solved: false; readonly used: readonly TechniqueId[] };

/** Run one technique set to exhaustion and report whether it finished the board. */
function attempt(clues: readonly (Digit | null)[], set: readonly Technique[]): SolveOutcome {
  const values: (Digit | null)[] = [...clues];
  const candidates: Set<Digit>[] = allCandidates(values).map((s) => new Set(s));
  const used = new Set<TechniqueId>();

  const place = (index: number, digit: Digit): void => {
    values[index] = digit;
    candidates[index] = new Set();
    for (const peer of peersOf(index)) candidates[peer]!.delete(digit);
  };

  for (let guard = 0; guard < 700; guard++) {
    if (values.every((v) => v !== null)) return { solved: true, used: [...used] };

    const board = { values, candidates };
    let advanced = false;

    for (const technique of set) {
      const finding = technique.find(board);
      if (!finding) continue;

      if (finding.kind === 'placement') {
        place(toIndex(finding.target), finding.digit);
      } else {
        let removedAny = false;
        for (const { target, digits } of finding.eliminations) {
          const index = toIndex(target);
          for (const digit of digits) {
            if (candidates[index]!.delete(digit)) removedAny = true;
          }
        }
        // An elimination that removes nothing would spin forever.
        if (!removedAny) continue;
      }

      used.add(technique.id);
      advanced = true;
      break;
    }

    if (!advanced) return { solved: false, used: [...used] };
  }

  return { solved: false, used: [...used] };
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
