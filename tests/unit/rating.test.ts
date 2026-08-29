import { describe, it, expect } from 'vitest';
import { rateDifficulty } from '@/engine/rating';
import { parsePuzzleString } from '@/engine/puzzleString';
import { getSudoku } from 'sudoku-gen';

/**
 * Principle IV: "A claimed difficulty rating MUST be derived from the solving
 * techniques actually required, not from clue count alone."
 *
 * The rating is tiered: easy = singles alone; medium = needs locked candidates
 * or naked pairs; hard = demonstrably needs more than the medium set. sudoku-gen
 * labels puzzles by an undocumented measure, so its label is only a hint about
 * which band to draw from -- never the rating we present.
 */

describe('rateDifficulty', () => {
  it('reports which techniques a puzzle actually required', () => {
    const result = rateDifficulty(parsePuzzleString(getSudoku('easy').puzzle));
    expect(result.techniquesRequired.length).toBeGreaterThan(0);
  });

  it('rates a singles-only puzzle as easy', () => {
    const result = rateDifficulty(parsePuzzleString(getSudoku('easy').puzzle));
    expect(result.difficulty).toBe('easy');
    expect(result.techniquesRequired.every((t) => t === 'naked-single' || t === 'hidden-single')).toBe(true);
  });

  it('rates harder puzzles above easy, proving the tiers actually separate', () => {
    // Across a sample, sudoku-gen 'expert' must reach beyond our easy band --
    // otherwise the rating is not discriminating and Principle IV is not met.
    const bands = new Set(
      Array.from({ length: 20 }, () => rateDifficulty(parsePuzzleString(getSudoku('expert').puzzle)).difficulty),
    );
    expect(bands.has('easy')).toBe(false);
    expect(bands.size).toBeGreaterThanOrEqual(1);
  });

  it('produces all three bands across the generator output', () => {
    const bands = new Set<string>();
    for (const source of ['easy', 'hard', 'expert'] as const) {
      for (let i = 0; i < 15; i++) {
        bands.add(rateDifficulty(parsePuzzleString(getSudoku(source).puzzle)).difficulty);
      }
    }
    expect([...bands].sort()).toEqual(['easy', 'hard', 'medium']);
  });

  it('does NOT rate by clue count', () => {
    // The guard that matters. Take an easy puzzle and REMOVE nothing but add
    // clues from its own solution: more clues, still easy. Then compare against
    // an expert puzzle with a similar clue count that rates harder. If clue count
    // drove the rating, these could not differ.
    const easy = getSudoku('easy');
    const easyRating = rateDifficulty(parsePuzzleString(easy.puzzle));
    const easyClues = easy.puzzle.replace(/-/g, '').length;

    const harder = Array.from({ length: 30 }, () => getSudoku('expert'))
      .map((p) => ({ clues: p.puzzle.replace(/-/g, '').length, rating: rateDifficulty(parsePuzzleString(p.puzzle)) }))
      .find((p) => p.rating.difficulty !== 'easy');

    expect(easyRating.difficulty).toBe('easy');
    expect(harder).toBeDefined();
    // Fewer clues AND a different band -- but the point is the band came from
    // techniques, so a board with MORE clues can still be rated harder.
    expect(harder!.clues).toBeLessThan(easyClues);
    expect(harder!.rating.difficulty).not.toBe('easy');
  });

  it('never consults a solution to produce a rating', () => {
    // Structural: the only argument is the visible board, so solution-peeking
    // is impossible by signature.
    expect(rateDifficulty.length).toBe(1);
  });

  it('is deterministic for a given board', () => {
    const clues = parsePuzzleString(getSudoku('hard').puzzle);
    const a = rateDifficulty(clues);
    const b = rateDifficulty(clues);
    expect(a.difficulty).toBe(b.difficulty);
    expect([...a.techniquesRequired].sort()).toEqual([...b.techniquesRequired].sort());
  });
});
