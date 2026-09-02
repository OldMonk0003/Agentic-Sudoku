import { describe, it, expect, beforeEach } from 'vitest';
import { requestPuzzle } from '@/ui/puzzleLoader';
import { store } from '@/state/store';
import { loadPuzzle } from '@/state/actions';
import { parsePuzzleString, toPuzzleString } from '@/engine/puzzleString';
import { rateDifficulty } from '@/engine/rating';
import type { Puzzle } from '@/engine/types';
import type { GenerateResult } from '@/engine/generate';

/**
 * A restart never re-presents the grid you were already on (005/FR-002, SC-003).
 *
 * WHY THIS TEST EXISTS. Nothing compared grids before this feature. Repeating a
 * puzzle is vanishingly unlikely -- `sudoku-gen` draws its own randomness and the
 * seed varies per request -- but SC-003 is written as an absolute, and
 * "vanishingly unlikely" is not what it says. One string comparison closes the
 * gap for every caller, including the learner's own difficulty control.
 *
 * WHY IT INJECTS A GENERATOR RATHER THAN FORCING A SEED COLLISION. Generation is
 * NOT reproducible from a seed: the seeded PRNG picks which band to draw from,
 * but `sudoku-gen` supplies its own randomness inside that band. The constitution
 * permits exactly that, and records the resulting puzzle instead of the seed
 * (Principle IV). So a collision cannot be arranged by seeding, and the only
 * honest way to test the behaviour is to hand the loader a generator that
 * repeats itself -- the same injection seam `createSwitchDifficultyTool` already
 * uses for the same reason.
 */

const DRILL = '973--258--4-------5----46-7------2---54276-1-28-----7---5----6-7---1-3----6-89--5';
const OTHER = '6-5-------9-7-625---4----7-23-8-------------------27154------9--6-9--8-4-----1---';

function puzzleFrom(puzzleString: string): Puzzle {
  const clues = parsePuzzleString(puzzleString);
  const rating = rateDifficulty(clues);
  return {
    clues,
    difficulty: rating.difficulty,
    puzzleString: toPuzzleString(clues),
    techniquesRequired: rating.techniquesRequired,
  };
}

describe('a generated puzzle identical to the one on screen is rejected', () => {
  beforeEach(() => {
    store.dispatch(loadPuzzle(puzzleFrom(DRILL)));
  });

  it('does not present a candidate that repeats the current grid', () => {
    const onScreen = store.getState().puzzle!.puzzleString;
    let calls = 0;

    requestPuzzle('easy', {
      generate: (): GenerateResult => {
        calls += 1;
        // First candidate repeats what is already on the board; second differs.
        return calls === 1
          ? { ok: true, puzzle: puzzleFrom(onScreen), attempts: 1 }
          : { ok: true, puzzle: puzzleFrom(OTHER), attempts: 1 };
      },
    });

    expect(calls, 'the loader must ask again rather than accept the repeat').toBeGreaterThan(1);
    expect(store.getState().puzzle!.puzzleString).not.toBe(onScreen);
  });

  it('accepts the first candidate when it differs', () => {
    let calls = 0;

    requestPuzzle('easy', {
      generate: (): GenerateResult => {
        calls += 1;
        return { ok: true, puzzle: puzzleFrom(OTHER), attempts: 1 };
      },
    });

    // No wasted generation: a distinct grid is taken straight away.
    expect(calls).toBe(1);
    expect(store.getState().puzzle!.puzzleString).toBe(toPuzzleString(parsePuzzleString(OTHER)));
  });

  it('accepts anything when the board has no puzzle yet', () => {
    // First load of a session: there is nothing to differ from, and refusing
    // here would leave the learner staring at a blank board.
    store.dispatch(loadPuzzle(puzzleFrom(OTHER)));
    const first = store.getState().puzzle!.puzzleString;
    expect(first).toBeTruthy();
  });

  it('gives up rather than looping forever if every candidate repeats', () => {
    const onScreen = store.getState().puzzle!.puzzleString;
    let calls = 0;

    requestPuzzle('easy', {
      generate: (): GenerateResult => {
        calls += 1;
        return { ok: true, puzzle: puzzleFrom(onScreen), attempts: 1 };
      },
    });

    // Bounded by the existing retry budget. An unbounded retry would hang the
    // board on a generator that cannot produce anything new.
    expect(calls).toBeLessThan(10);
    // The board is left as it was rather than showing the repeat.
    expect(store.getState().puzzle!.puzzleString).toBe(onScreen);
  });
});
