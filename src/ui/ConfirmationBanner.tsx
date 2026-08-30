'use client';

import { answerConfirmation, visibleConfirmation } from '@/state/agentSession';
import { agentStore, useAgentSession } from './useAgentStore';

/**
 * "Shall I replace your board with a drill?" (FR-053)
 *
 * AN INLINE BANNER, NOT A MODAL, and that is the whole design.
 *
 * Principle V bans blocking feedback outright and FR-056 says no agent action
 * may prevent the learner from playing -- so there is no backdrop, no focus
 * trap, and nothing behind it is disabled. The learner can ignore it entirely
 * and keep solving; after a minute it gives up and the agent is told they
 * declined.
 *
 * That is not a weaker confirmation than a modal. It is a more honest one: the
 * only thing at stake is whether the agent may throw away their work, and the
 * default when they say nothing is that it may not.
 */
export function ConfirmationBanner() {
  const session = useAgentSession();
  const confirmation = visibleConfirmation(session, Date.now());

  if (!confirmation) return null;

  const answer = (accepted: boolean) =>
    agentStore.dispatch(answerConfirmation({ id: confirmation.id, accepted }));

  return (
    <div
      data-testid="confirmation-banner"
      role="status"
      aria-live="polite"
      className={[
        'flex w-full max-w-[min(92vw,34rem)] flex-wrap items-center justify-between gap-3',
        'rounded-sm border border-agent-edge bg-agent-surface px-4 py-3 text-sm text-ink-clue',
      ].join(' ')}
    >
      <span className="sr-only">Agent asks:</span>
      {/* Agent-authored, so a text node and nothing else (FR-021). */}
      <p className="flex-1">{confirmation.prompt}</p>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => answer(true)}
          className={[
            'rounded-sm border border-line-box px-3 py-1.5 text-sm text-ink-player',
            'transition-colors hover:bg-wash-crosshair',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
          ].join(' ')}
        >
          Load drill
        </button>
        <button
          type="button"
          onClick={() => answer(false)}
          className={[
            'rounded-sm border border-line-hairline px-3 py-1.5 text-sm text-ink-note',
            'transition-colors hover:bg-wash-crosshair',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
          ].join(' ')}
        >
          Keep my board
        </button>
      </div>
    </div>
  );
}
