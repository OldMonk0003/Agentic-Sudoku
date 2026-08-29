import { toCoord, unitIndices, type Coord, type Digit } from '../grid';
import type { Technique, TechniqueFinding } from './types';

/**
 * Hidden single: within a row, column, or box, a digit has exactly one cell it
 * can still occupy.
 *
 * The justification is the rest of the unit -- the cells that rule the digit out
 * everywhere else.
 */
const UNITS = (['row', 'col', 'box'] as const).flatMap((kind) =>
  [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ kind, n, indices: unitIndices(kind, n) })),
);

export const hiddenSingle: Technique = {
  id: 'hidden-single',
  band: 'easy',

  find(board): TechniqueFinding | null {
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        const digit = d as Digit;
        if (unit.indices.some((i) => board.values[i] === digit)) continue;

        const placements = unit.indices.filter(
          (i) => board.values[i] === null && board.candidates[i]!.has(digit),
        );
        if (placements.length !== 1) continue;

        const target = placements[0]!;
        const because: Coord[] = unit.indices
          .filter((i) => i !== target && board.values[i] !== null)
          .map(toCoord);

        return { kind: 'placement', technique: 'hidden-single', target: toCoord(target), digit, because };
      }
    }
    return null;
  },
};
