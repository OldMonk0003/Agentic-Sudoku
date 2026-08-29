import { describe, it, expect } from 'vitest';
import { findConflicts } from '@/engine/conflicts';
import { solve } from '@/engine/solver';
import { generatePuzzle } from '@/engine/generate';
import { peersOf, type Digit } from '@/engine/grid';

/**
 * FR-029: "The system MUST report duplicate-constraint violations only, and MUST
 * NOT indicate whether a legally placed digit matches the puzzle's unique
 * solution."
 *
 * This is deliberate product behaviour, not an omission. A board that tells you
 * when you are wrong is a different game.
 */

describe('conflicts never peek at the solution', () => {
  it('does NOT flag a digit that is legal against the board but wrong against the solution', () => {
    const generated = generatePuzzle({ difficulty: 'easy', seed: 31337 });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;

    const clues = [...generated.puzzle.clues];
    const solution = solve(clues)!;

    // Find an empty cell and a digit that is legal among its peers but is NOT
    // the solution's answer for that cell.
    let found = false;
    for (let index = 0; index < 81 && !found; index++) {
      if (clues[index] !== null) continue;

      const taken = new Set<Digit>();
      for (const peer of peersOf(index)) {
        const v = clues[peer];
        if (v != null) taken.add(v);
      }

      for (let d = 1; d <= 9; d++) {
        const digit = d as Digit;
        if (taken.has(digit)) continue;
        if (digit === solution[index]) continue;

        const trial = [...clues];
        trial[index] = digit;

        // Legal against the visible board -> must NOT be flagged, even though it
        // contradicts the real solution.
        expect(findConflicts(trial).has(index), `index ${index}, digit ${digit}`).toBe(false);
        found = true;
        break;
      }
    }

    expect(found, 'expected to find a legal-but-wrong placement to test').toBe(true);
  });

  it('takes only the visible board as input — solution-peeking is impossible by signature', () => {
    expect(findConflicts.length).toBe(1);
  });

  it('flags an ACTUAL duplicate, so the absence above is not simply "never flags"', () => {
    const generated = generatePuzzle({ difficulty: 'easy', seed: 31337 });
    if (!generated.ok) return;

    const clues = [...generated.puzzle.clues];
    const emptyIndex = clues.findIndex((c) => c === null);
    const peerWithValue = [...peersOf(emptyIndex)].find((p) => clues[p] != null)!;

    clues[emptyIndex] = clues[peerWithValue] ?? null;
    expect(findConflicts(clues).has(emptyIndex)).toBe(true);
  });
});
