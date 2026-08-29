import type { DispatchResult, GameSession, InputMode } from './types';

/**
 * The framework-agnostic store.
 *
 * This file must never import React, touch the DOM, or read a timer. That is not
 * stylistic: constitution Principle I requires the WebMCP tool surface (feature
 * 002) to be registered outside the component tree and enumerable with no DOM
 * mounted. State reachable only through a React hook makes that impossible, which
 * is why `webmcp-react` was rejected and why this store exists.
 *
 * Every mutation passes through `dispatch`. There is no other write path.
 * Every rejection is a RETURNED value -- dispatch never throws.
 */

export type Action =
  | { type: 'setInputMode'; mode: InputMode }
  | { type: 'toggleInputMode' };

export interface Store {
  getState(): GameSession;
  subscribe(listener: () => void): () => void;
  dispatch(action: Action): DispatchResult;
}

type Reducer = (session: GameSession, action: Action) => GameSession | null;

/**
 * Phase 2 ships the skeleton plus the two mode actions. Every remaining action
 * is registered here by its own user story, so no story has to reopen this file's
 * dispatch plumbing.
 */
const baseReducer: Reducer = (session, action) => {
  switch (action.type) {
    case 'setInputMode':
      if (session.inputMode === action.mode) return null;
      return { ...session, inputMode: action.mode };

    case 'toggleInputMode':
      return { ...session, inputMode: session.inputMode === 'normal' ? 'notes' : 'normal' };

    default:
      return null;
  }
};

const KNOWN_ACTIONS = new Set<string>(['setInputMode', 'toggleInputMode']);

export function createStore(initial: GameSession, reducer: Reducer = baseReducer): Store {
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
      // Hostile input is a returned rejection, never an exception (Principle I,
      // established here so agent and human paths get identical treatment).
      if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
        return { ok: false, reason: 'unknown-action' };
      }
      if (!KNOWN_ACTIONS.has(action.type)) {
        return { ok: false, reason: 'unknown-action' };
      }

      const next = reducer(state, action);
      if (next === null || next === state) {
        return { ok: true, changed: false };
      }

      state = next;
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
