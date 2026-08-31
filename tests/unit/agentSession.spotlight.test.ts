import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgentStore,
  emptyAgentSession,
  raiseSpotlight,
  clearAnnotations,
  expire,
  visibleSpotlight,
  type AgentStore,
} from '@/state/agentSession';
import { SPOTLIGHT_TTL_MS } from '@/state/spotlight';

/**
 * FR-022: "At most one agent spotlight MUST exist at a time: a later agent
 * change replaces the earlier spotlight rather than adding to it."
 *
 * That is why the spotlight is a SLOT rather than an entry in the annotations
 * list. On a shared list, "replace the previous spotlight but leave the
 * highlights and beams alone" is a filter-and-splice over data other tools also
 * write to; as a slot it is an assignment, and the invariant cannot be violated
 * by a code path that forgets.
 *
 * The store already has two single-valued slots for the same reason -- `toast`
 * and `confirmation`.
 */

const NOW = 500_000;
let store: AgentStore;

beforeEach(() => {
  store = createAgentStore(emptyAgentSession());
});

describe('the spotlight slot', () => {
  it('runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it('starts empty', () => {
    expect(store.getState().spotlight).toBeNull();
    expect(visibleSpotlight(store.getState(), NOW)).toBeNull();
  });

  it('holds the cells the agent changed', () => {
    store.dispatch(raiseSpotlight({ cells: [{ row: 1, col: 3 }], now: NOW }));

    const spotlight = visibleSpotlight(store.getState(), NOW + 100);
    expect(spotlight).not.toBeNull();
    expect(spotlight!.cells).toEqual([{ row: 1, col: 3 }]);
    expect(spotlight!.focus).toEqual({ row: 1, col: 3 });
  });

  it('REPLACES rather than accumulating (FR-022)', () => {
    store.dispatch(raiseSpotlight({ cells: [{ row: 1, col: 3 }], now: NOW }));
    store.dispatch(raiseSpotlight({ cells: [{ row: 7, col: 2 }], now: NOW }));

    const spotlight = visibleSpotlight(store.getState(), NOW + 100);
    expect(spotlight!.cells).toEqual([{ row: 7, col: 2 }]);
  });

  it('is cleared by clear_visual_annotations along with everything else (FR-023)', () => {
    store.dispatch(raiseSpotlight({ cells: [{ row: 4, col: 4 }], now: NOW }));
    store.dispatch(clearAnnotations());

    expect(store.getState().spotlight).toBeNull();
  });

  it('is reaped by the expiry tick (FR-023)', () => {
    store.dispatch(raiseSpotlight({ cells: [{ row: 4, col: 4 }], now: NOW }));

    store.dispatch(expire({ now: NOW + 1000 }));
    expect(store.getState().spotlight).not.toBeNull();

    store.dispatch(expire({ now: NOW + SPOTLIGHT_TTL_MS + 1 }));
    expect(store.getState().spotlight).toBeNull();
  });

  it('reports no change when the expiry tick reaps nothing', () => {
    store.dispatch(raiseSpotlight({ cells: [{ row: 4, col: 4 }], now: NOW }));
    // A render loop twice a second is what this prevents.
    expect(store.dispatch(expire({ now: NOW + 10 }))).toEqual({ ok: true, changed: false });
  });

  it('raises nothing for a whole-board change', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      row: Math.floor(i / 9) + 1,
      col: (i % 9) + 1,
    }));
    store.dispatch(raiseSpotlight({ cells: many, now: NOW }));

    expect(store.getState().spotlight).toBeNull();
  });

  it('clears an existing spotlight when a whole-board change follows it', () => {
    store.dispatch(raiseSpotlight({ cells: [{ row: 1, col: 1 }], now: NOW }));
    const many = Array.from({ length: 40 }, (_, i) => ({
      row: Math.floor(i / 9) + 1,
      col: (i % 9) + 1,
    }));
    store.dispatch(raiseSpotlight({ cells: many, now: NOW }));

    // Leaving the OLD spotlight up would point at a cell that is no longer the
    // most recent change -- worse than showing nothing.
    expect(store.getState().spotlight).toBeNull();
  });
});
