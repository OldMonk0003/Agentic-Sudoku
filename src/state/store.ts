import { reduce, ACTION_TYPES, type Action } from './actions';
import type { DispatchResult, GameSession } from './types';

/**
 * The framework-agnostic store.
 *
 * This file must never import React, touch the DOM, or read a timer. That is not
 * stylistic: constitution Principle I requires the WebMCP tool surface (feature
 * 002) to be registered outside the component tree and enumerable with no DOM
 * mounted. State reachable only through a React hook makes that impossible,
 * which is why `webmcp-react` was rejected and why this store exists.
 *
 * Every mutation passes through `dispatch`. There is no other write path, and
 * every rejection is a RETURNED value -- dispatch never throws.
 */

export interface Store {
  getState(): GameSession;
  subscribe(listener: () => void): () => void;
  dispatch(action: Action): DispatchResult;
}

export function createStore(initial: GameSession): Store {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispatch(action: Action): DispatchResult {
      // Hostile input is a returned rejection, never an exception. Established
      // here so the agent and human paths get identical treatment (Principle I).
      if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
        return { ok: false, reason: 'unknown-action' };
      }
      if (!ACTION_TYPES.has(action.type)) {
        return { ok: false, reason: 'unknown-action' };
      }

      const outcome = reduce(state, action);
      if (!outcome.ok) return { ok: false, reason: outcome.reason };
      if (outcome.session === null || outcome.session === state) {
        return { ok: true, changed: false };
      }

      state = outcome.session;
      for (const listener of listeners) listener();
      return { ok: true, changed: true };
    },
  };
}

/** The starting session, before any puzzle exists. */
export function emptySession(): GameSession {
  return {
    puzzle: null,
    cells: Array.from({ length: 81 }, () => ({
      value: null,
      candidates: new Set<never>(),
      origin: 'player' as const,
    })),
    selection: null,
    inputMode: 'normal',
    elapsedMs: 0,
    status: 'generating',
    history: [],
  };
}

/** The single application store instance. */
export const store: Store = createStore(emptySession());
