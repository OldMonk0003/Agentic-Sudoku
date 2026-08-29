import { describe, it, expect } from 'vitest';
import { generatePuzzle } from '@/engine/generate';
import { createStore, emptySession } from '@/state/store';
import { newPuzzle } from '@/state/actions';

/**
 * Solution quarantine (constitution, Technology & Architecture Constraints).
 *
 * sudoku-gen returns the solution alongside the puzzle. It must not leave the
 * Engine: not into store state, not into any serialised form, and -- at feature
 * 002 -- not into any agent tool result.
 */

/** Any run of 81 digits with no gaps is a complete grid. */
function containsCompleteGrid(text: string): boolean {
  return /\d{81}/.test(text.replace(/[^0-9]/g, (c) => (c === '-' ? '-' : '')));
}

describe('solution quarantine', () => {
  it('generatePuzzle returns no field carrying a complete grid', () => {
    const result = generatePuzzle({ difficulty: 'easy', seed: 21 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(Object.keys(result.puzzle)).not.toContain('solution');
    expect(containsCompleteGrid(JSON.stringify(result))).toBe(false);
  });

  it('the puzzle string always has gaps — it is never a solved grid', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const result = generatePuzzle({ difficulty, seed: 33 });
      if (!result.ok) continue;
      expect(result.puzzle.puzzleString).toContain('-');
    }
  });

  it('serialised store state contains no complete grid', () => {
    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 41));

    const serialised = JSON.stringify(store.getState(), (_k, v) =>
      v instanceof Set ? [...v] : v,
    );
    expect(containsCompleteGrid(serialised)).toBe(false);
  });
});
