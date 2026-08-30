import { describe, it, expect } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, selectCell, enterDigit } from '@/state/actions';
import { descriptors } from '@/tools/registry';
import { solve } from '@/engine/solver';
import { toCoord } from '@/engine/grid';
import type { Digit } from '@/engine/grid';

/**
 * FR-026 and FR-058: no tool may reveal the solution, or whether a placed digit
 * matches it. The agent must reason from the visible board, as the learner does.
 *
 * This holds STRUCTURALLY -- no type above the Engine can express a solution, so
 * there is nothing for a handler to leak. This test is the proof that the
 * structure was not quietly worked around, and it runs against the whole
 * surface so a tool added later is covered the day it is added.
 *
 * It is the feature-002 counterpart of tests/unit/solution-quarantine.test.ts.
 */

/** Any run of 40+ digits in serialised output is suspicious; 81 is the giveaway. */
const LONG_DIGIT_RUN = /\d{40,}/;

function everyStringIn(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') found.push(value);
  else if (Array.isArray(value)) for (const item of value) everyStringIn(item, found);
  else if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      found.push(key);
      everyStringIn(inner, found);
    }
  }
  return found;
}

describe('no tool result reveals the solution', () => {
  it('runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it('exposes no solution-shaped key or value from any tool, on a nearly solved board', async () => {
    store.dispatch(newPuzzle('easy', 2026));
    const puzzle = store.getState().puzzle!;
    const answer = solve(puzzle.clues)!;

    // Fill everything but the last four cells: the state most likely to tempt a
    // leak, and the state where one would be most useful to an agent.
    const empties = store
      .getState()
      .cells.map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell.value === null)
      .map(({ index }) => index);

    for (const index of empties.slice(0, -4)) {
      store.dispatch(selectCell(toCoord(index)));
      store.dispatch(enterDigit(answer[index] as Digit, 'player'));
    }

    for (const descriptor of descriptors) {
      const result = await descriptor.execute({});
      const serialised = JSON.stringify(result);

      expect(serialised, `${descriptor.name} returned a long digit run`).not.toMatch(LONG_DIGIT_RUN);

      for (const text of everyStringIn(result)) {
        expect(text.toLowerCase(), `${descriptor.name} key/value`).not.toContain('solution');
        expect(text.toLowerCase(), `${descriptor.name} key/value`).not.toContain('answer');
        expect(text.toLowerCase(), `${descriptor.name} key/value`).not.toContain('correct');
      }
    }
  });

  it('does not import the solver anywhere in the tools layer', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const toolsDir = fileURLToPath(new URL('../../src/tools', import.meta.url));
    const files = (function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(entry) ? [full] : [];
      });
    })(toolsDir);

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      /*
        `solver.ts` exports `solve()`, which returns the completed grid. The ban
        is at MODULE level rather than on that one export, because "import the
        module but only the safe function" is a rule nothing enforces.

        A tool that legitimately needs Principle IV's uniqueness guarantee --
        `load_technique_practice` does -- asks `@/engine/uniqueness`, which
        answers with a boolean and has no shape that could carry a solution.
      */
      expect(source, `${file} imports the solver`).not.toMatch(/from '@\/engine\/solver'/);
    }
  });
});
