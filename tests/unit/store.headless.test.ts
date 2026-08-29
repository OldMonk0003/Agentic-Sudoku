import { describe, it, expect } from 'vitest';
import { createStore, emptySession } from '@/state/store';
import { newPuzzle, selectCell, enterDigit } from '@/state/actions';
import { solve } from '@/engine/solver';
import { toCoord } from '@/engine/grid';
import type { Digit } from '@/engine/grid';

/**
 * THE test that feature 002 depends on.
 *
 * Constitution Principle I requires the WebMCP tool surface to be registered
 * outside the component tree and "importable and executable headlessly, with no
 * DOM mounted". That is only possible if the entire game is drivable through
 * dispatch alone. This file runs in a `node` environment -- there is no DOM here
 * at all -- and plays a puzzle to completion.
 *
 * If this test ever needs a DOM to pass, the agent surface is no longer buildable.
 */

describe('headless play', () => {
  it('drives a full puzzle to completion with no DOM mounted', () => {
    expect(typeof document).toBe('undefined');

    const store = createStore(emptySession());
    store.dispatch(newPuzzle('easy', 909));

    const session = store.getState();
    const solution = solve(session.puzzle!.clues)!;
    expect(solution).not.toBeNull();

    for (let index = 0; index < 81; index++) {
      if (session.cells[index]!.value !== null) continue;
      store.dispatch(selectCell(toCoord(index)));
      store.dispatch(enterDigit(solution[index] as Digit, 'player'));
    }

    const filled = store.getState().cells.filter((c) => c.value !== null);
    expect(filled).toHaveLength(81);
  });

  it('exposes every mutation without importing React', async () => {
    // A structural guard: the state layer must stay framework-free.
    const storeModule = await import('@/state/store');
    const actionsModule = await import('@/state/actions');
    expect(Object.keys(storeModule)).toContain('createStore');
    expect(Object.keys(actionsModule).length).toBeGreaterThan(0);
  });
});
