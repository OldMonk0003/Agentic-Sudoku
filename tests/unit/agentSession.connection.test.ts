import { describe, it, expect, vi } from 'vitest';
import {
  createAgentStore,
  emptyAgentSession,
  agentConnected,
  agentDisconnected,
  requestDisconnect,
  learnerActed,
} from '@/state/agentSession';

/**
 * The second store (research.md R3).
 *
 * It holds everything the agent does that is not game data, and it is the ONLY
 * seam between the UI and the Tools layer -- neither imports the other. Two of
 * those crossings are established here:
 *
 *   UI -> Tools:  requestDisconnect, observed by the registry (FR-057)
 *   UI -> Tools:  learnerActed, observed by the playback sequencer (FR-048)
 *
 * Like the game store, it runs with no DOM.
 */

describe('the agent session store', () => {
  it('runs with no DOM mounted', () => {
    expect(typeof document).toBe('undefined');
    const store = createAgentStore(emptyAgentSession());
    expect(store.getState()).toBeDefined();
  });
});

describe('connection state', () => {
  it('starts absent, so a page with no host renders nothing agent-related', () => {
    const store = createAgentStore(emptyAgentSession());
    // FR-013 / SC-010: "absent" is the absence of a badge, not a badge saying
    // there is no agent.
    expect(store.getState().connection).toBe('absent');
  });

  it('moves absent -> connected -> disconnected', () => {
    const store = createAgentStore(emptyAgentSession());

    store.dispatch(agentConnected());
    expect(store.getState().connection).toBe('connected');

    store.dispatch(agentDisconnected());
    expect(store.getState().connection).toBe('disconnected');
  });

  it('notifies subscribers on a change and not on a no-op', () => {
    const store = createAgentStore(emptyAgentSession());
    const listener = vi.fn();
    store.subscribe(listener);

    store.dispatch(agentConnected());
    expect(listener).toHaveBeenCalledTimes(1);

    store.dispatch(agentConnected()); // already connected
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('never throws on a malformed action; it returns a rejection', () => {
    const store = createAgentStore(emptyAgentSession());
    for (const hostile of [null, undefined, 'nope', 42, {}, { type: 'not-an-action' }]) {
      const result = store.dispatch(hostile as never);
      expect(result.ok).toBe(false);
    }
  });
});

describe('the UI -> Tools crossings', () => {
  it('raises a disconnect request the registry can observe without the UI importing it', () => {
    const store = createAgentStore(emptyAgentSession());
    store.dispatch(agentConnected());

    const seen: number[] = [];
    store.subscribe(() => seen.push(store.getState().disconnectRequests));

    store.dispatch(requestDisconnect());
    expect(store.getState().disconnectRequests).toBe(1);
    expect(seen.at(-1)).toBe(1);
  });

  it('raises a monotonic learner activity counter the sequencer can observe', () => {
    const store = createAgentStore(emptyAgentSession());
    expect(store.getState().learnerActivity).toBe(0);

    store.dispatch(learnerActed());
    store.dispatch(learnerActed());

    // Monotonic and never reset: the sequencer compares the value it saw at the
    // previous step, so it cannot miss an interruption between two steps.
    expect(store.getState().learnerActivity).toBe(2);
  });
});
