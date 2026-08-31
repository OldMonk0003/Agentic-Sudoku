import { describe, it, expect } from 'vitest';
import { createStore, emptySession } from '@/state/store';
import { newPuzzle } from '@/state/actions';
import { hasUniqueSolution } from '@/engine/uniqueness';
import { rateDifficulty } from '@/engine/rating';

/**
 * FR-032 and Principle IV, on the path `switch_difficulty` uses.
 *
 * The tool does NOT generate. It signals, and `requestPuzzle` in the UI layer
 * generates through the existing worker -- which is the whole point of the seam
 * (003/R1) and is also what makes this requirement nearly free: every puzzle
 * reaching a player already passes this project's own uniqueness proof, because
 * `generatePuzzle` will not return one that does not.
 *
 * "Nearly free" is not "free", so it is asserted rather than assumed, across
 * every level the tool can ask for.
 */

describe('every board switch_difficulty can load', () => {
  it('runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    it(`${difficulty}: has exactly one solution`, () => {
      const store = createStore(emptySession());
      store.dispatch(newPuzzle(difficulty, 20260831));

      const puzzle = store.getState().puzzle!;
      expect(puzzle).not.toBeNull();
      expect(hasUniqueSolution(puzzle.clues)).toBe(true);
    });

    it(`${difficulty}: carries a DERIVED rating, not the label it was asked for`, () => {
      const store = createStore(emptySession());
      store.dispatch(newPuzzle(difficulty, 20260831));

      const puzzle = store.getState().puzzle!;
      // The rating comes from the techniques the puzzle actually requires. It
      // may legitimately differ from the band it was drawn from -- what must not
      // happen is the requested label being echoed back on trust.
      expect(puzzle.difficulty).toBe(rateDifficulty(puzzle.clues).difficulty);
      expect(puzzle.techniquesRequired.length).toBeGreaterThan(0);
    });

    it(`${difficulty}: starts a clean session -- zero clock, empty history`, () => {
      const store = createStore(emptySession());
      store.dispatch(newPuzzle(difficulty, 20260831));

      expect(store.getState().elapsedMs).toBe(0);
      expect(store.getState().history).toHaveLength(0);
      expect(store.getState().status).toBe('playing');
    });
  }
});
