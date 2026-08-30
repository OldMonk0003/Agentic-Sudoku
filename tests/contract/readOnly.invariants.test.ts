import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, selectCell, enterDigit, tick } from '@/state/actions';
import { agentStore } from '@/state/agentSession';
import { descriptors } from '@/tools/registry';

/**
 * FR-027: "Read tools MUST leave board data, annotations, elapsed time, and undo
 * history unchanged."
 *
 * Asserted across EVERY read-only tool rather than one at a time, so a tool
 * added later cannot quietly acquire a side effect. This is the invariant that
 * lets an agent poll the board while a human plays without disturbing them.
 */

const readOnlyTools = () => descriptors.filter((d) => d.readOnly);

function snapshot() {
  const game = store.getState();
  return {
    cells: JSON.stringify(game.cells.map((c) => ({ v: c.value, o: c.origin, c: [...c.candidates] }))),
    elapsedMs: game.elapsedMs,
    historyDepth: game.history.length,
    status: game.status,
    selection: JSON.stringify(game.selection),
    agent: JSON.stringify(agentStore.getState()),
  };
}

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 31337));
  const empty = store.getState().cells.findIndex((c) => c.value === null);
  store.dispatch(selectCell({ row: Math.floor(empty / 9) + 1, col: (empty % 9) + 1 }));
  store.dispatch(enterDigit(6, 'player'));
  store.dispatch(tick(1500));
});

describe('read-only tools change nothing', () => {
  it('has at least one read-only tool to check', () => {
    expect(readOnlyTools().length).toBeGreaterThan(0);
  });

  for (const descriptor of readOnlyTools()) {
    it(`${descriptor.name} leaves board, timer, history, and annotations untouched`, async () => {
      const before = snapshot();
      const result = await descriptor.execute({});
      const after = snapshot();

      expect(result.ok).toBe(true);
      expect(after).toEqual(before);
    });

    it(`${descriptor.name} changes nothing even when its input is rejected`, async () => {
      const before = snapshot();
      await descriptor.execute({ hostile: true });
      expect(snapshot()).toEqual(before);
    });

    it(`${descriptor.name} does not move the learner's selection`, async () => {
      const selection = JSON.stringify(store.getState().selection);
      await descriptor.execute({});
      expect(JSON.stringify(store.getState().selection)).toBe(selection);
    });
  }
});
