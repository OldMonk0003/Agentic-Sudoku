import { describe, it, expect } from 'vitest';
import { createStore, emptySession } from '@/state/store';
import { newPuzzle, selectCell, enterDigit, tick } from '@/state/actions';
import { serialiseSession, type MemoryStorage } from '@/state/persistence';
import {
  agentStore,
  addAnnotations,
  clearAnnotations,
  pushExplanation,
  showToast,
  dismissToast,
  expire,
  learnerActed,
  agentConnected,
  agentDisconnected,
  requestDisconnect,
  setReducedMotion,
  type AgentAction,
} from '@/state/agentSession';

/**
 * FR-034: annotations MUST NOT alter board data, elapsed time, or undo history,
 * and MUST NOT be saved as part of the restorable session.
 *
 * This is the test that pays for the second store (research.md R3). On
 * `GameSession` those would be three fields away from breaking, silently, and
 * each break would ship. Here the guarantee is STRUCTURAL: `serialiseSession`
 * reads the game store, which has no route to this data at all.
 *
 * So this file does not check that we remembered to keep them apart. It checks
 * that they *cannot* meet.
 */

/** Every agent-session action, exercised in one go. */
const EVERY_AGENT_ACTION: AgentAction[] = [
  agentConnected(),
  addAnnotations({
    annotations: [
      { kind: 'cell', role: 'target', cells: [{ row: 4, col: 5 }] },
      { kind: 'cell', role: 'because', cells: [{ row: 4, col: 1 }, { row: 4, col: 3 }] },
    ],
    now: 1_000_000,
  }),
  pushExplanation({ text: 'An explanation that must never reach storage.', tool: 'fill_cell', now: 1_000_000 }),
  showToast({ text: 'A coaching note that must never reach storage.', now: 1_000_000 }),
  setReducedMotion({ value: true }),
  learnerActed(),
  expire({ now: 2_000_000 }),
  dismissToast(),
  clearAnnotations(),
  requestDisconnect(),
  agentDisconnected(),
];

function memoryStorage(): MemoryStorage & { readonly written: Map<string, string> } {
  const written = new Map<string, string>();
  return {
    written,
    getItem: (key) => written.get(key) ?? null,
    setItem: (key, value) => void written.set(key, value),
    removeItem: (key) => void written.delete(key),
  };
}

function playedGame() {
  const game = createStore(emptySession());
  game.dispatch(newPuzzle('easy', 777));
  const empty = game.getState().cells.findIndex((c) => c.value === null);
  game.dispatch(selectCell({ row: Math.floor(empty / 9) + 1, col: (empty % 9) + 1 }));
  game.dispatch(enterDigit(4, 'player'));
  game.dispatch(tick(5000));
  return game;
}

describe('the two stores cannot meet', () => {
  it('runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it('leaves the game store byte-identical after every agent action', () => {
    const game = playedGame();
    const before = JSON.stringify(game.getState(), (_key, value) =>
      value instanceof Set ? [...value] : value,
    );

    for (const action of EVERY_AGENT_ACTION) agentStore.dispatch(action);

    const after = JSON.stringify(game.getState(), (_key, value) =>
      value instanceof Set ? [...value] : value,
    );
    expect(after).toBe(before);
  });

  it('leaves elapsed time and undo depth untouched', () => {
    const game = playedGame();
    const { elapsedMs, history } = game.getState();

    for (const action of EVERY_AGENT_ACTION) agentStore.dispatch(action);

    expect(game.getState().elapsedMs).toBe(elapsedMs);
    expect(game.getState().history).toHaveLength(history.length);
  });

  it('writes no annotation, explanation, or toast into persisted state', () => {
    const game = playedGame();
    for (const action of EVERY_AGENT_ACTION) agentStore.dispatch(action);

    const storage = memoryStorage();
    expect(serialiseSession(game.getState(), storage)).toBe(true);

    const payload = storage.written.get('agentic-sudoku/session')!;
    expect(payload).toBeDefined();
    for (const forbidden of [
      'annotation', 'explanation', 'toast', 'because', 'target',
      'must never reach storage', 'coaching',
    ]) {
      expect(payload.toLowerCase(), `persisted payload contains "${forbidden}"`).not.toContain(
        forbidden,
      );
    }
  });

  it('persists agent AUTHORSHIP but nothing else about the agent', () => {
    // `origin: 'agent'` survives a reload as the code 'a' -- that is 001's own
    // schema, and it is what keeps FR-044's visual distinction after a refresh.
    // Everything else the agent did is transient by design.
    const game = playedGame();
    const empty = game.getState().cells.findIndex((c) => c.value === null);
    game.dispatch(selectCell({ row: Math.floor(empty / 9) + 1, col: (empty % 9) + 1 }));
    game.dispatch(enterDigit(9, 'agent'));

    const storage = memoryStorage();
    serialiseSession(game.getState(), storage);
    const payload = storage.written.get('agentic-sudoku/session')!;

    expect(JSON.parse(payload).origins).toContain('a');
  });

  it('the agent store imports no React and no persistence', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const source = readFileSync(
      fileURLToPath(new URL('../../src/state/agentSession.ts', import.meta.url)),
      'utf8',
    );

    expect(source).not.toMatch(/from 'react'/);
    expect(source).not.toMatch(/from '\.\/persistence'/);
    // No timers either: expiry is a selector over an absolute stamp.
    expect(source).not.toMatch(/setTimeout|setInterval/);
  });
});
