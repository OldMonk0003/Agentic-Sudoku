/**
 * The learner's answer to the one destructive agent action (002/FR-053).
 *
 * Its own module because it has its own rule: a prompt is only "on screen" while
 * it is unanswered AND unexpired, and an unanswered one must resolve as declined
 * rather than hanging the agent's call forever. That is a small responsibility,
 * but it is a distinct one.
 *
 * `prompt` is agent-authored and UNTRUSTED, rendered as a text node like every
 * other piece of agent text (002/FR-021).
 */

export interface Confirmation {
  readonly id: string;
  readonly technique: string;
  readonly prompt: string;
  readonly expiresAt: number;
  /** Set once the learner answers. `null` means still waiting. */
  readonly answer: 'accepted' | 'declined' | null;
}

/**
 * An unanswered prompt resolves as declined after this, so an agent's call
 * cannot hang on a learner who simply carried on playing (spec Assumptions).
 */
export const CONFIRMATION_TTL_MS = 60_000;

/** The prompt to show: unanswered, and not yet timed out. */
export function pending(confirmation: Confirmation | null, now: number): Confirmation | null {
  if (!confirmation || confirmation.answer !== null) return null;
  return confirmation.expiresAt > now ? confirmation : null;
}
