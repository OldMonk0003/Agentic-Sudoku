import {
  beamsOnly, rolesByIndex, unexpired,
  type Annotation, type AnnotationRole, type BeamAnnotation,
} from './annotations';
import { onScreen, toastOrNull, type Explanation, type Toast } from './explanations';
import { pending, type Confirmation } from './confirmation';
import type { Difficulty } from './types';
import { liveSpotlight, type Spotlight } from './spotlight';
import { AGENT_ACTION_TYPES, type AgentAction } from './agentActions';
import { reduceAgent } from './agentReduce';

/**
 * The second store: everything the agent does that is not game data.
 *
 * WHY IT IS SEPARATE (research.md R3). FR-034 requires annotations never to be
 * saved, and never to alter elapsed time or undo history. On `GameSession` those
 * are three fields away from breaking, silently. Here, `serialiseSession` has no
 * route to this data at all -- the guarantee is structural, so it needs one test
 * rather than permanent vigilance.
 *
 * WHAT IT ALSO TURNED OUT TO BE: the only seam between the UI and the Tools
 * layer, in both directions. Neither imports the other (enforced by lint).
 *
 *   Tools -> UI   annotations, explanations, the toast, playback progress
 *   UI -> Tools   learnerActed (interrupts playback), requestDisconnect
 *
 * So `Board.tsx` never learns that playback exists, and the Disconnect button
 * never imports the registry.
 *
 * This file owns the STORE and the vocabulary; annotations.ts and
 * explanations.ts own the shapes and the selectors over them. It was split that
 * way when it crossed Principle III's 300-line review trigger.
 *
 * Like the game store: no React, no DOM, no timers, no randomness.
 */

export type ConnectionState = 'absent' | 'connected' | 'disconnected';

/**
 * Progress through a walkthrough, so the learner can see one is running and
 * tests can assert 002/FR-049's reported counts.
 *
 * It holds no step CONTENTS: those are the agent's, consumed by the sequencer as
 * it goes. Storing them would put agent-authored instructions into session state
 * for no reader.
 */
export interface PlaybackState {
  readonly running: boolean;
  readonly totalSteps: number;
  readonly completedSteps: number;
}

export type {
  Annotation, AnnotationInput, AnnotationRole, BeamAnnotation, CellAnnotation,
} from './annotations';
export type { Explanation, Toast } from './explanations';
export type { Confirmation, ConfirmationKind } from './confirmation';
export { CONFIRMATION_TTL_MS, canAsk } from './confirmation';
export { ANNOTATION_TTL_MS } from './annotations';
export { SPOTLIGHT_TTL_MS, SPOTLIGHT_MAX_CELLS, spotlitIndices, spotlightFocusIndex, spotlightEdgesFor } from './spotlight';
export type { Spotlight, SpotlightEdges } from './spotlight';
export { EXPLANATION_TTL_MS, TOAST_TTL_MS, MAX_VISIBLE_EXPLANATIONS } from './explanations';

export interface AgentSession {
  readonly connection: ConnectionState;
  readonly annotations: readonly Annotation[];
  /** The queue, oldest first. At most MAX_VISIBLE_EXPLANATIONS are shown. */
  readonly explanations: readonly Explanation[];
  readonly toast: Toast | null;
  /** Monotonic. The registry observes this rather than being called by the UI. */
  readonly disconnectRequests: number;
  /** Monotonic, never reset. The playback sequencer compares it between steps. */
  readonly learnerActivity: number;
  readonly reducedMotion: boolean;
  readonly playback: PlaybackState | null;
  readonly confirmation: Confirmation | null;
  /**
   * Where the agent last changed something (003/FR-018). A SLOT, so FR-022's
   * "at most one spotlight" is structural -- a later write overwrites it, and
   * there is no code path that could accumulate two.
   */
  readonly spotlight: Spotlight | null;
  /**
   * The Tools -> UI seam for generation (003/R1). The UI is subscribed and
   * performs the generation; the Tools layer never reaches into it.
   */
  readonly puzzleRequest: { readonly difficulty: Difficulty; readonly id: number } | null;
  /** Monotonic. The UI observes this rather than being called by the Tools layer. */
  readonly puzzleRequests: number;
  /** Monotonic. Lets switch_difficulty report FR-036 rather than only timing out. */
  readonly puzzleFailures: number;
  /** Monotonic id source. No randomness: the constitution routes all of it through the Engine PRNG. */
  readonly nextId: number;
}

export * from './agentActions';

export type AgentDispatchResult =
  | { readonly ok: true; readonly changed: boolean }
  | { readonly ok: false; readonly reason: 'unknown-action' };

export interface AgentStore {
  getState(): AgentSession;
  subscribe(listener: () => void): () => void;
  dispatch(action: AgentAction): AgentDispatchResult;
}

export function emptyAgentSession(): AgentSession {
  return {
    // Not "no agent connected" -- the ABSENCE of any agent affordance. FR-013
    // and SC-010 require a host-less page to be indistinguishable from 001.
    connection: 'absent',
    annotations: [],
    explanations: [],
    toast: null,
    disconnectRequests: 0,
    learnerActivity: 0,
    reducedMotion: false,
    playback: null,
    confirmation: null,
    spotlight: null,
    puzzleRequest: null,
    puzzleRequests: 0,
    puzzleFailures: 0,
    nextId: 1,
  };
}

// --- selectors: pure functions of (session, now) ---------------------------

export const visibleAnnotations = (session: AgentSession, now: number): readonly Annotation[] =>
  unexpired(session.annotations, now);

export const visibleExplanations = (session: AgentSession, now: number): readonly Explanation[] =>
  onScreen(session.explanations, now);

export const visibleToast = (session: AgentSession, now: number): Toast | null =>
  toastOrNull(session.toast, now);

export const annotatedRoles = (
  session: AgentSession,
  now: number,
): ReadonlyMap<number, AnnotationRole> => rolesByIndex(visibleAnnotations(session, now));

export const visibleBeams = (session: AgentSession, now: number): readonly BeamAnnotation[] =>
  beamsOnly(visibleAnnotations(session, now));

/** The prompt on screen: unanswered, and not yet timed out. */
export const visibleConfirmation = (session: AgentSession, now: number): Confirmation | null =>
  pending(session.confirmation, now);

/** The spotlight still on screen: raised, and not yet expired (003/FR-023). */
export const visibleSpotlight = (session: AgentSession, now: number): Spotlight | null =>
  liveSpotlight(session.spotlight, now);

// --- the reducer -----------------------------------------------------------

export function createAgentStore(initial: AgentSession): AgentStore {
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

    dispatch(action: AgentAction): AgentDispatchResult {
      if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
        return { ok: false, reason: 'unknown-action' };
      }
      if (!AGENT_ACTION_TYPES.has(action.type)) {
        return { ok: false, reason: 'unknown-action' };
      }

      const next = reduceAgent(state, action);
      if (next === null || next === state) return { ok: true, changed: false };

      state = next;
      for (const listener of listeners) listener();
      return { ok: true, changed: true };
    },
  };
}

/** The single agent-session store instance. */
export const agentStore: AgentStore = createAgentStore(emptyAgentSession());
