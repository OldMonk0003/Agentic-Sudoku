import { peersOf, toIndex, type Digit } from './grid';
import { allCandidates } from './candidates';
import type { Technique, TechniqueId } from './techniques';

/**
 * Solve a board using a GIVEN SET of techniques, and report whether it finished.
 *
 * Extracted from rating.ts so `requiresTechnique` can use the same engine rather
 * than a second copy of it (Principle III: composition over accretion). Two
 * implementations of "run these techniques to exhaustion" would be two chances
 * to disagree about what a puzzle requires.
 *
 * Pure, and never consults a solution -- it only ever knows what the visible
 * board supports.
 */

export type SolveOutcome =
  | { readonly solved: true; readonly used: readonly TechniqueId[] }
  | { readonly solved: false; readonly used: readonly TechniqueId[] };

/** Run one technique set to exhaustion and report whether it finished the board. */
export function attempt(
  clues: readonly (Digit | null)[],
  set: readonly Technique[],
): SolveOutcome {
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
