/**
 * What the agent SAID: the explanation queue and the coaching toast.
 *
 * Separate from annotations because they answer different questions -- an
 * annotation says "look here", an explanation says "because of this" -- and
 * because 002/FR-031 turns on the difference: clearing the agent's marks must
 * NOT erase the record of what it said, or the board would change with no
 * stated reason.
 *
 * Explanation text is agent-authored and UNTRUSTED. It is rendered as a text
 * node and nothing else (002/FR-021).
 */

export interface Explanation {
  readonly id: string;
  readonly text: string;
  /** Which tool produced it -- the attribution 002/FR-017 requires. */
  readonly tool: string;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export interface Toast {
  readonly id: string;
  readonly text: string;
  readonly expiresAt: number;
}

/** Spec assumption: explanation popups persist about six seconds. */
export const EXPLANATION_TTL_MS = 6_000;
/** 002/FR-030: the coaching toast dismisses itself after five seconds. */
export const TOAST_TTL_MS = 5_000;
/** 002/FR-020: a cap, so the board is never obscured by narration. */
export const MAX_VISIBLE_EXPLANATIONS = 3;

/**
 * The explanations on screen: unexpired, oldest first, capped.
 *
 * Queued ones surface as older ones expire; they are never dropped, because an
 * agent that explained itself must not have that explanation swallowed by a
 * busier one arriving after it.
 */
export function onScreen(
  explanations: readonly Explanation[],
  now: number,
): readonly Explanation[] {
  return explanations
    .filter((explanation) => explanation.expiresAt > now)
    .slice(0, MAX_VISIBLE_EXPLANATIONS);
}

export function unexpiredExplanations(
  explanations: readonly Explanation[],
  now: number,
): readonly Explanation[] {
  return explanations.filter((explanation) => explanation.expiresAt > now);
}

export function toastOrNull(toast: Toast | null, now: number): Toast | null {
  if (!toast) return null;
  return toast.expiresAt > now ? toast : null;
}
