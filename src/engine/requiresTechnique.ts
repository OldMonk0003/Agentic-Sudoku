import { TECHNIQUES, type Technique, type TechniqueId } from './techniques';
import { attempt } from './techniqueSolver';
import type { Digit } from './grid';
import type { Difficulty } from './types';

/**
 * What it MEANS for a puzzle to require a technique.
 *
 * 002/FR-052 and SC-009 demand drills that "genuinely require the named
 * technique", which is otherwise an unfalsifiable claim -- a puzzle that merely
 * PERMITS an X-Wing teaches nothing about X-Wings, because the learner will
 * solve it another way and never see one.
 *
 * So the claim is made decidable:
 *
 *   requiresTechnique(clues, id) is true  <=>
 *        solving with (every technique of the same band or easier, EXCLUDING id)
 *        stalls
 *   AND  solving with (that same set, INCLUDING id) completes
 *
 * The first half is what makes it REQUIRED; the second is what makes it
 * SUFFICIENT, so a drill tagged `x-wing` is a puzzle an X-Wing finishes and
 * nothing weaker does.
 *
 * Bands, rather than the full technique set, because a puzzle needing an X-Wing
 * must not be excused by some harder technique we happen to have implemented.
 */

const BAND_ORDER: readonly Difficulty[] = ['easy', 'medium', 'hard'];

function setUpTo(band: Difficulty): readonly Technique[] {
  const limit = BAND_ORDER.indexOf(band);
  return TECHNIQUES.filter((t) => BAND_ORDER.indexOf(t.band) <= limit);
}

export function requiresTechnique(
  clues: readonly (Digit | null)[],
  id: TechniqueId,
): boolean {
  const technique = TECHNIQUES.find((t) => t.id === id);
  if (!technique) return false;

  const withIt = setUpTo(technique.band);
  const withoutIt = withIt.filter((t) => t.id !== id);

  // Necessary: everything else at this level or below is not enough.
  if (attempt(clues, withoutIt).solved) return false;
  // Sufficient: adding it finishes the board.
  return attempt(clues, withIt).solved;
}
