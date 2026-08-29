import { it, expect } from 'vitest';

/**
 * Cross-check: our solver against the generator's own solutions.
 *
 * This is the strongest available evidence that countSolutions is correct --
 * 200 independently produced puzzles, each with a known answer. It also
 * measures the per-puzzle cost, which is what decides whether generation needs
 * a Web Worker (research.md R5).
 */
import { getSudoku } from 'sudoku-gen';
import { countSolutions, solve } from '@/engine/solver';
import { parsePuzzleString } from '@/engine/puzzleString';

it('solver agrees with sudoku-gen on 200 real puzzles', () => {
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) {
    const { puzzle, solution } = getSudoku(['easy','medium','hard','expert'][i % 4] as never);
    const clues = parsePuzzleString(puzzle);
    expect(countSolutions(clues), puzzle).toBe(1);
    expect(solve(clues)!.join('')).toBe(solution);
  }
  console.log('  200 puzzles verified in', (performance.now()-t0).toFixed(0), 'ms =>',
    ((performance.now()-t0)/200).toFixed(2), 'ms each');
});
