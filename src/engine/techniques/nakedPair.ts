import { toCoord, unitIndices, type Digit } from '../grid';
import type { Technique, TechniqueFinding } from './types';

/**
 * Naked pair: two cells in a unit hold the same two candidates and nothing else.
 * Those two digits belong to those two cells, so they leave every other cell in
 * the unit.
 */
const UNITS = (['row', 'col', 'box'] as const).flatMap((kind) =>
  [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => unitIndices(kind, n)),
);

export const nakedPair: Technique = {
  id: 'naked-pair',
  band: 'medium',

  find(board): TechniqueFinding | null {
    for (const unit of UNITS) {
      const pairs = unit.filter(
        (i) => board.values[i] === null && board.candidates[i]!.size === 2,
      );

      for (let a = 0; a < pairs.length; a++) {
        for (let b = a + 1; b < pairs.length; b++) {
          const first = [...board.candidates[pairs[a]!]!].sort();
          const second = [...board.candidates[pairs[b]!]!].sort();
          if (first[0] !== second[0] || first[1] !== second[1]) continue;

          const digits = first as Digit[];
          const targets = unit.filter(
            (i) =>
              i !== pairs[a] &&
              i !== pairs[b] &&
              board.values[i] === null &&
              digits.some((d) => board.candidates[i]!.has(d)),
          );
          if (targets.length === 0) continue;

          return {
            kind: 'elimination',
            technique: 'naked-pair',
            eliminations: targets.map((i) => ({
              target: toCoord(i),
              digits: digits.filter((d) => board.candidates[i]!.has(d)),
            })),
            because: [toCoord(pairs[a]!), toCoord(pairs[b]!)],
          };
        }
      }
    }
    return null;
  },
};
