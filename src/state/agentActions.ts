import type { Coord } from '@/engine/grid';
import type { AnnotationInput } from './annotations';

/**
 * The vocabulary of the agent session store: every action, and nothing else.
 *
 * Split out of agentSession.ts when it crossed Principle III's 300-line review
 * trigger for the second time -- the same shape the game store took, and for the
 * same reason: vocabulary, reducer, and store are three responsibilities.
 */

export type AgentAction =
  | { type: 'agentConnected' }
  | { type: 'agentDisconnected' }
  | { type: 'agentAbsent' }
  | { type: 'requestDisconnect' }
  | { type: 'learnerActed' }
  | { type: 'addAnnotations'; annotations: readonly AnnotationInput[]; now: number; ttlMs?: number }
  | { type: 'clearAnnotations' }
  | { type: 'raiseSpotlight'; cells: readonly Coord[]; now: number }
  | { type: 'pushExplanation'; text: string; tool: string; now: number; ttlMs?: number }
  | { type: 'dismissExplanation'; id: string }
  | { type: 'showToast'; text: string; now: number; ttlMs?: number }
  | { type: 'dismissToast' }
  | { type: 'expire'; now: number }
  | { type: 'setReducedMotion'; value: boolean }
  | { type: 'playbackStarted'; totalSteps: number }
  | { type: 'playbackAdvanced' }
  | { type: 'playbackEnded' }
  | { type: 'askConfirmation'; technique: string; prompt: string; now: number; ttlMs?: number }
  | { type: 'answerConfirmation'; id: string; accepted: boolean }
  | { type: 'clearConfirmation' };

export const agentConnected = (): AgentAction => ({ type: 'agentConnected' });
export const agentDisconnected = (): AgentAction => ({ type: 'agentDisconnected' });
export const agentAbsent = (): AgentAction => ({ type: 'agentAbsent' });
export const requestDisconnect = (): AgentAction => ({ type: 'requestDisconnect' });
export const learnerActed = (): AgentAction => ({ type: 'learnerActed' });

export const addAnnotations = (payload: {
  annotations: readonly AnnotationInput[];
  now: number;
  ttlMs?: number;
}): AgentAction => ({ type: 'addAnnotations', ...payload });

export const clearAnnotations = (): AgentAction => ({ type: 'clearAnnotations' });

/**
 * Mark where the agent just changed something (003/FR-018).
 *
 * A SLOT, not a list entry: FR-022's "at most one" is then structural rather
 * than an invariant a future code path can forget. Raised by `defineWriteTool`
 * for every cell-changing write, so no write tool has to remember (003/R4).
 */
export const raiseSpotlight = (payload: {
  cells: readonly Coord[];
  now: number;
}): AgentAction => ({ type: 'raiseSpotlight', cells: payload.cells, now: payload.now });

export const pushExplanation = (payload: {
  text: string;
  tool: string;
  now: number;
  ttlMs?: number;
}): AgentAction => ({ type: 'pushExplanation', ...payload });

export const dismissExplanation = (payload: { id: string }): AgentAction =>
  ({ type: 'dismissExplanation', id: payload.id });

export const showToast = (payload: { text: string; now: number; ttlMs?: number }): AgentAction =>
  ({ type: 'showToast', ...payload });

export const dismissToast = (): AgentAction => ({ type: 'dismissToast' });
export const expire = (payload: { now: number }): AgentAction => ({ type: 'expire', now: payload.now });
export const setReducedMotion = (payload: { value: boolean }): AgentAction =>
  ({ type: 'setReducedMotion', value: payload.value });

/**
 * An unanswered prompt resolves as declined after this, rather than hanging the
 * agent's call forever (spec Assumptions).
 */
export const CONFIRMATION_TTL_MS = 60_000;

export const playbackStarted = (payload: { totalSteps: number }): AgentAction =>
  ({ type: 'playbackStarted', totalSteps: payload.totalSteps });
export const playbackAdvanced = (): AgentAction => ({ type: 'playbackAdvanced' });
export const playbackEnded = (): AgentAction => ({ type: 'playbackEnded' });

export const askConfirmation = (payload: {
  technique: string;
  prompt: string;
  now: number;
  ttlMs?: number;
}): AgentAction => ({ type: 'askConfirmation', ...payload });
export const answerConfirmation = (payload: { id: string; accepted: boolean }): AgentAction =>
  ({ type: 'answerConfirmation', id: payload.id, accepted: payload.accepted });
export const clearConfirmation = (): AgentAction => ({ type: 'clearConfirmation' });

export const AGENT_ACTION_TYPES: ReadonlySet<string> = new Set<AgentAction['type']>([
  'agentConnected', 'agentDisconnected', 'agentAbsent', 'requestDisconnect', 'learnerActed',
  'addAnnotations', 'clearAnnotations', 'raiseSpotlight', 'pushExplanation', 'dismissExplanation',
  'showToast', 'dismissToast', 'expire', 'setReducedMotion',
  'playbackStarted', 'playbackAdvanced', 'playbackEnded',
  'askConfirmation', 'answerConfirmation', 'clearConfirmation',
]);

