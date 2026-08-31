import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, enterDigitAt } from '@/state/actions';
import { agentStore, raiseSpotlight, clearAnnotations } from '@/state/agentSession';
import { serialiseSession, type MemoryStorage } from '@/state/persistence';
import { toCoord } from '@/engine/grid';

/**
 * FR-024: the spotlight is never saved and never in the undo history.
 *
 * This holds STRUCTURALLY rather than by discipline -- the spotlight lives on the
 * agent session store, and `serialiseSession` has no route to that data at all.
 * This file is the proof the structure was not quietly worked around, and it is
 * the direct descendant of the same guarantee 002 relies on for annotations.
 */

function fakeStorage(): MemoryStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; },
  };
}

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 8080));
  agentStore.dispatch(clearAnnotations());
});

describe('the spotlight is not game data', () => {
  it('runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it('never reaches the persisted session payload (FR-024)', () => {
    agentStore.dispatch(raiseSpotlight({ cells: [{ row: 4, col: 4 }], now: Date.now() }));

    const storage = fakeStorage();
    expect(serialiseSession(store.getState(), storage)).toBe(true);

    const raw = storage.data['agentic-sudoku/session']!;
    expect(raw).not.toMatch(/spotlight/i);
    expect(raw).not.toMatch(/focus/i);
  });

  it('adds no undo entry (FR-024)', () => {
    const depth = store.getState().history.length;
    agentStore.dispatch(raiseSpotlight({ cells: [{ row: 4, col: 4 }], now: Date.now() }));
    expect(store.getState().history.length).toBe(depth);
  });

  it('an agent fill records ONE undo step, and the spotlight is not part of it', () => {
    const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
    const depth = store.getState().history.length;

    store.dispatch(enterDigitAt(coord, 6, 'agent'));
    agentStore.dispatch(raiseSpotlight({ cells: [coord], now: Date.now() }));

    expect(store.getState().history.length).toBe(depth + 1);
    expect(JSON.stringify(store.getState().history)).not.toMatch(/spotlight/i);
  });

  it('does not alter elapsed time', () => {
    const elapsed = store.getState().elapsedMs;
    agentStore.dispatch(raiseSpotlight({ cells: [{ row: 1, col: 1 }], now: Date.now() }));
    expect(store.getState().elapsedMs).toBe(elapsed);
  });
});
