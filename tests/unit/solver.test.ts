import { describe, it, expect } from 'vitest';
import { countSolutions, solve } from '@/engine/solver';
import { parsePuzzleString } from '@/engine/puzzleString';

/** A known-unique puzzle and its solution, used as a fixture throughout. */
const UNIQUE = '4--8---9--796-2----------7-9---248---6--3-249-2---63---1-2--4--89--5-7--2-536-9--';
const UNIQUE_SOLUTION = '456873192179642538382519674931724865768135249524986317617298453893451726245367981';

describe('countSolutions', () => {
  it('finds exactly one solution for a well-formed puzzle', () => {
    expect(countSolutions(parsePuzzleString(UNIQUE))).toBe(1);
  });

  it('finds zero solutions for a contradictory board', () => {
    const clues = parsePuzzleString('11' + '-'.repeat(79));
    expect(countSolutions(clues)).toBe(0);
  });

  it('reports more than one for an under-constrained board', () => {
    // An empty grid has ~6.67e21 solutions; the counter must stop at the cap.
    expect(countSolutions(parsePuzzleString('-'.repeat(81)))).toBe(2);
  });

  it('never exceeds its cap', () => {
    expect(countSolutions(parsePuzzleString('-'.repeat(81)), 2)).toBe(2);
    expect(countSolutions(parsePuzzleString('-'.repeat(81)), 5)).toBe(5);
  });

  it('terminates on every input, valid or not', () => {
    expect(() => countSolutions(parsePuzzleString('9'.repeat(81)))).not.toThrow();
    expect(countSolutions(parsePuzzleString('9'.repeat(81)))).toBe(0);
  });
});

describe('solve', () => {
  it('returns a complete grid that satisfies every constraint', () => {
    const solution = solve(parsePuzzleString(UNIQUE));
    expect(solution).not.toBeNull();
    expect(solution).toHaveLength(81);
    expect(solution!.join('')).toBe(UNIQUE_SOLUTION);

    for (let unit = 1; unit <= 9; unit++) {
      const row = solution!.filter((_, i) => Math.floor(i / 9) + 1 === unit);
      const col = solution!.filter((_, i) => (i % 9) + 1 === unit);
      expect(new Set(row).size).toBe(9);
      expect(new Set(col).size).toBe(9);
    }
  });

  it('preserves every starting clue', () => {
    const clues = parsePuzzleString(UNIQUE);
    const solution = solve(clues)!;
    clues.forEach((clue, i) => {
      if (clue !== null) expect(solution[i]).toBe(clue);
    });
  });

  it('returns null for an unsolvable board', () => {
    expect(solve(parsePuzzleString('11' + '-'.repeat(79)))).toBeNull();
  });
});
