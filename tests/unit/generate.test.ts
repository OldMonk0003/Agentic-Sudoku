import { describe, it, expect, vi, afterEach } from 'vitest';
import { generatePuzzle } from '@/engine/generate';
import { countSolutions } from '@/engine/solver';
import { parsePuzzleString, toPuzzleString } from '@/engine/puzzleString';

afterEach(() => vi.restoreAllMocks());

describe('generatePuzzle', () => {
  it('returns a puzzle with exactly one solution', () => {
    const result = generatePuzzle({ difficulty: 'easy', seed: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(countSolutions(result.puzzle.clues)).toBe(1);
  });

  it('records a puzzleString that reproduces the board exactly', () => {
    // sudoku-gen exposes no seed, so per the constitution's widened Principle IV
    // the puzzle definition itself is the reproducibility record.
    const result = generatePuzzle({ difficulty: 'medium', seed: 7 });
    if (!result.ok) return;
    expect(result.puzzle.puzzleString).toHaveLength(81);
    expect(parsePuzzleString(result.puzzle.puzzleString)).toEqual(result.puzzle.clues);
    expect(toPuzzleString(result.puzzle.clues)).toBe(result.puzzle.puzzleString);
  });

  it('reports the techniques its rating was derived from', () => {
    const result = generatePuzzle({ difficulty: 'easy', seed: 3 });
    if (!result.ok) return;
    expect(result.puzzle.techniquesRequired.length).toBeGreaterThan(0);
  });

  it('gives up cleanly rather than returning an unverified puzzle', () => {
    const result = generatePuzzle({ difficulty: 'hard', seed: 5, maxAttempts: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('exhausted-attempts');
  });

  it('generates all three difficulties', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const result = generatePuzzle({ difficulty, seed: 11 });
      expect(result.ok, difficulty).toBe(true);
      if (result.ok) expect(result.puzzle.difficulty).toBe(difficulty);
    }
  });

  it('stays within the 500ms generation budget (Principle IV)', () => {
    const start = performance.now();
    generatePuzzle({ difficulty: 'hard', seed: 13 });
    expect(performance.now() - start).toBeLessThan(500);
  });
});
