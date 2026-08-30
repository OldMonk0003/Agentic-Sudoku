import type { TechniqueId } from './techniques';

/**
 * Curated practice puzzles, one per technique that HAS one.
 *
 * Authored constants rather than generated at request time (research.md R9):
 * a drill must be *verified* to require its technique, and that verification is
 * not something to attempt inside a generation budget while a learner waits.
 * Bundled, so 002/FR-055's "no network request" needs no mechanism at all --
 * about 85 bytes each against a ~189 KB bundle.
 *
 * NOT EVERY TECHNIQUE HAS ONE, and that is by design rather than an omission.
 * `requiresTechnique` demands that a drill be unsolvable without its technique
 * and solvable with it, using techniques of the same band or easier. Measured
 * against that bar:
 *
 *   - `naked-single` has no drill, and looks unlikely to: hidden singles subsume
 *     naked singles in practice, so a board that stalls on hidden singles alone
 *     but yields to naked singles did not appear in 400,000 candidates.
 *   - `x-wing` is the hardest to find, because a puzzle that our other four
 *     techniques cannot finish usually needs more than an X-Wing to finish it.
 *
 * 002/FR-054 anticipates exactly this: a request naming a technique with no
 * drill is rejected with the list of techniques that do have one. Shipping three
 * verified drills is honest; shipping five where two do not require their
 * technique would teach the wrong lesson, which is the failure that matters.
 *
 * Every entry here is asserted by tests/unit/drills.test.ts to have exactly one
 * solution (Principle IV applies to a bundled puzzle exactly as to a generated
 * one) and to satisfy `requiresTechnique` for its tag.
 */

export interface Drill {
  readonly id: string;
  readonly technique: TechniqueId;
  /** 81 characters, '-' for empty. The reproducibility record, as in 001. */
  readonly puzzleString: string;
}

export const DRILLS: readonly Drill[] = [
  {
    id: 'hidden-single-1',
    technique: 'hidden-single',
    puzzleString:
      '973--258--4-------5----46-7------2---54276-1-28-----7---5----6-7---1-3----6-89--5',
  },
  {
    id: 'locked-candidates-1',
    technique: 'locked-candidates',
    puzzleString:
      '6-5-------9-7-625---4----7-23-8-------------------27154------9--6-9--8-4-----1---',
  },
  {
    id: 'naked-pair-1',
    technique: 'naked-pair',
    puzzleString:
      '-----6--32---58----8---4-621------9--96-4-5------8---7------3-93-21-----------7--',
  },
];

/** The techniques an agent may actually ask for, for FR-054's rejection list. */
export const DRILLABLE_TECHNIQUES: readonly TechniqueId[] = [
  ...new Set(DRILLS.map((drill) => drill.technique)),
];

export function drillFor(technique: TechniqueId): Drill | null {
  return DRILLS.find((drill) => drill.technique === technique) ?? null;
}
