import { boxOf, colOf, rowOf, toCoord, unitIndices, type CellIndex, type Coord, type Digit } from '../grid';
import type { Technique, TechniqueFinding } from './types';

/**
 * Locked candidates (pointing and claiming).
 *
 * Pointing: within a box, a digit's only remaining cells all share one row or
 * column -- so it can be eliminated from the rest of that line.
 * Claiming: within a line, a digit's only remaining cells all sit in one box --
 * so it can be eliminated from the rest of that box.
 */
export const lockedCandidates: Technique = {
  id: 'locked-candidates',
  band: 'medium',

  find(board): TechniqueFinding | null {
    const cellsFor = (indices: readonly CellIndex[], digit: Digit) =>
      indices.filter((i) => board.values[i] === null && board.candidates[i]!.has(digit));

    // Pointing: box -> line
    for (let box = 1; box <= 9; box++) {
      const boxCells = unitIndices('box', box);
      for (let d = 1; d <= 9; d++) {
        const digit = d as Digit;
        const spots = cellsFor(boxCells, digit);
        if (spots.length < 2) continue;

        for (const [kind, of] of [['row', rowOf], ['col', colOf]] as const) {
          const line = of(spots[0]!);
          if (!spots.every((i) => of(i) === line)) continue;

          const targets = cellsFor(unitIndices(kind, line), digit).filter((i) => boxOf(i) !== box);
          if (targets.length === 0) continue;

          return {
            kind: 'elimination',
            technique: 'locked-candidates',
            eliminations: targets.map((i) => ({ target: toCoord(i), digits: [digit] })),
            because: spots.map(toCoord) as Coord[],
          };
        }
      }
    }

    // Claiming: line -> box
    for (const kind of ['row', 'col'] as const) {
      for (let n = 1; n <= 9; n++) {
        const lineCells = unitIndices(kind, n);
        for (let d = 1; d <= 9; d++) {
          const digit = d as Digit;
          const spots = cellsFor(lineCells, digit);
          if (spots.length < 2) continue;

          const box = boxOf(spots[0]!);
          if (!spots.every((i) => boxOf(i) === box)) continue;

          const targets = cellsFor(unitIndices('box', box), digit).filter(
            (i) => (kind === 'row' ? rowOf(i) : colOf(i)) !== n,
          );
          if (targets.length === 0) continue;

          return {
            kind: 'elimination',
            technique: 'locked-candidates',
            eliminations: targets.map((i) => ({ target: toCoord(i), digits: [digit] })),
            because: spots.map(toCoord) as Coord[],
          };
        }
      }
    }

    return null;
  },
};
