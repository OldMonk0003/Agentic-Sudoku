import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generatePuzzle } from '@/engine/generate';
import { countSolutions } from '@/engine/solver';
import { parsePuzzleString } from '@/engine/puzzleString';
import type { Difficulty } from '@/state/types';

/**
 * SC-003: across an audit of generated puzzles spanning all three difficulties,
 * 100% have exactly one solution.
 *
 * The spec calls for 10,000. That is a CI-scale audit; the default here is a
 * fast sample, raised by SUDOKU_AUDIT_RUNS for the full run. Either way this is
 * the property that Principle IV hangs on -- a generator's claim of validity is
 * not evidence.
 */
const RUNS = Number(process.env.SUDOKU_AUDIT_RUNS ?? 300);

describe('puzzle generation invariants', () => {
  it(`yields exactly one solution across ${RUNS} puzzles`, () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Difficulty>('easy', 'medium', 'hard'),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        (difficulty, seed) => {
          const result = generatePuzzle({ difficulty, seed });
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          expect(countSolutions(result.puzzle.clues)).toBe(1);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('round-trips puzzleString back to identical clues (reproducibility)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Difficulty>('easy', 'medium', 'hard'),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        (difficulty, seed) => {
          const result = generatePuzzle({ difficulty, seed });
          if (!result.ok) return;
          expect(parsePuzzleString(result.puzzle.puzzleString)).toEqual(result.puzzle.clues);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('rates every puzzle into the band that was requested', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Difficulty>('easy', 'medium', 'hard'),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        (difficulty, seed) => {
          const result = generatePuzzle({ difficulty, seed });
          if (!result.ok) return;
          expect(result.puzzle.difficulty).toBe(difficulty);
        },
      ),
      { numRuns: 50 },
    );
  });
});
