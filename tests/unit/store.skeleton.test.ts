import { describe, it, expect, vi } from 'vitest';
import { createStore } from '@/state/store';
import type { GameSession } from '@/state/types';

/**
 * The store is framework-agnostic on purpose (research.md R6). Constitution
 * Principle I requires the agent surface to be registered outside the component
 * tree and enumerable with no DOM mounted -- which is only possible if the state
 * layer never touches React. These tests run in a `node` environment, so an
 * accidental React or DOM import here fails immediately.
 */

const emptySession = (): GameSession => ({
  puzzle: null,
  cells: Array.from({ length: 81 }, () => ({ value: null, candidates: new Set(), origin: 'player' as const })),
  selection: null,
  inputMode: 'normal',
  elapsedMs: 0,
  status: 'generating',
  history: [],
});

describe('store skeleton', () => {
  it('exposes getState, subscribe and dispatch', () => {
    const store = createStore(emptySession());
    expect(typeof store.getState).toBe('function');
    expect(typeof store.subscribe).toBe('function');
    expect(typeof store.dispatch).toBe('function');
  });

  it('returns the current session from getState', () => {
    const store = createStore(emptySession());
    expect(store.getState().cells).toHaveLength(81);
    expect(store.getState().status).toBe('generating');
  });

  it('notifies subscribers when state changes', () => {
    const store = createStore(emptySession());
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: 'setInputMode', mode: 'notes' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns a working unsubscribe', () => {
    const store = createStore(emptySession());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.dispatch({ type: 'setInputMode', mode: 'notes' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('rejects an unknown action without throwing', () => {
    const store = createStore(emptySession());
    // @ts-expect-error deliberately invalid action
    const result = store.dispatch({ type: 'nonsense' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown-action');
  });

  it('does not notify subscribers when a dispatch changes nothing', () => {
    const store = createStore(emptySession());
    const listener = vi.fn();
    store.subscribe(listener);
    // @ts-expect-error deliberately invalid action
    store.dispatch({ type: 'nonsense' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('never throws, whatever it is handed', () => {
    const store = createStore(emptySession());
    for (const bad of [null, undefined, {}, { type: 42 }, 'string']) {
      // @ts-expect-error hostile input by design
      expect(() => store.dispatch(bad)).not.toThrow();
    }
  });

  it('keeps state immutable across a rejected dispatch', () => {
    const store = createStore(emptySession());
    const before = store.getState();
    // @ts-expect-error deliberately invalid action
    store.dispatch({ type: 'nonsense' });
    expect(store.getState()).toBe(before);
  });
});
