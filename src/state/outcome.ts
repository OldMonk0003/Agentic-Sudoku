import type { GameSession, RejectionReason } from './types';

/**
 * What a reducer handler returns.
 *
 * `session: null` means "valid, but nothing changed" -- distinct from a
 * rejection, and the distinction is what lets the store skip notifying
 * subscribers without pretending the action was refused.
 */
export type ReducerOutcome =
  | { readonly ok: true; readonly session: GameSession | null }
  | { readonly ok: false; readonly reason: RejectionReason };

export const reject = (reason: RejectionReason): ReducerOutcome => ({ ok: false, reason });
export const commit = (session: GameSession | null): ReducerOutcome => ({ ok: true, session });
