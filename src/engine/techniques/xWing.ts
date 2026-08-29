import { toIndex, toCoord, type Digit } from '../grid';
import type { Technique, TechniqueFinding } from './types';

/**
 * X-Wing: a digit is confined to the same two columns in two different rows
 * (or the same two rows in two columns). Those four cells form a rectangle, so
 * the digit leaves the rest of both crossing lines.
 */
export const xWing: Technique = {
  id: 'x-wing',
  band: 'hard',

  find(board): TechniqueFinding | null {
    const has = (row: number, col: number, digit: Digit) => {
      const i = toIndex({ row, col });
      return board.values[i] === null && board.candidates[i]!.has(digit);
    };

    for (let d = 1; d <= 9; d++) {
      const digit = d as Digit;

      // Row-based, then column-based by transposing the accessor.
      for (const byRow of [true, false]) {
        const at = (a: number, b: number) => (byRow ? has(a, b, digit) : has(b, a, digit));

        for (let lineA = 1; lineA <= 9; lineA++) {
          const spotsA = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => at(lineA, x));
          if (spotsA.length !== 2) continue;

          for (let lineB = lineA + 1; lineB <= 9; lineB++) {
            const spotsB = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => at(lineB, x));
            if (spotsB.length !== 2) continue;
            if (spotsA[0] !== spotsB[0] || spotsA[1] !== spotsB[1]) continue;

            const targets: number[] = [];
            for (const cross of spotsA) {
              for (let other = 1; other <= 9; other++) {
                if (other === lineA || other === lineB) continue;
                if (!at(other, cross)) continue;
                targets.push(byRow ? toIndex({ row: other, col: cross }) : toIndex({ row: cross, col: other }));
              }
            }
            if (targets.length === 0) continue;

            const corners = [
              byRow ? { row: lineA, col: spotsA[0]! } : { row: spotsA[0]!, col: lineA },
              byRow ? { row: lineA, col: spotsA[1]! } : { row: spotsA[1]!, col: lineA },
              byRow ? { row: lineB, col: spotsB[0]! } : { row: spotsB[0]!, col: lineB },
              byRow ? { row: lineB, col: spotsB[1]! } : { row: spotsB[1]!, col: lineB },
            ];

            return {
              kind: 'elimination',
              technique: 'x-wing',
              eliminations: targets.map((i) => ({ target: toCoord(i), digits: [digit] })),
              because: corners,
            };
          }
        }
      }
    }
    return null;
  },
};
