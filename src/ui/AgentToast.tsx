'use client';

import { dismissToast, visibleToast } from '@/state/agentSession';
import { agentStore, useAgentSession } from './useAgentStore';

/**
 * The five-second coaching note (FR-030).
 *
 * Distinct from the explanation queue on purpose: an explanation accompanies a
 * CHANGE and is attributed to the tool that made it, while a hint accompanies
 * nothing and is simply advice. There is only ever one, because a queue of
 * coaching notes would outlive the moment they were coaching about.
 *
 * Like the queue: agent text rendered as a text node, polite live region, never
 * focused, dismissible sooner by the learner.
 */
export function AgentToast() {
  const session = useAgentSession();
  const toast = visibleToast(session, Date.now());

  if (!toast) return null;

  return (
    <div
      data-testid="agent-toast"
      role="status"
      aria-live="polite"
      className={[
        'flex w-full max-w-[min(92vw,34rem)] items-start gap-2',
        'rounded-sm border border-dashed border-agent-edge bg-agent-surface px-3 py-2',
        'text-sm text-ink-note',
      ].join(' ')}
    >
      <span className="sr-only">Agent hint:</span>
      <p className="flex-1">{toast.text}</p>

      <button
        type="button"
        aria-label="Dismiss hint"
        onClick={() => agentStore.dispatch(dismissToast())}
        className={[
          'shrink-0 rounded-sm px-1.5 text-xs',
          'transition-colors hover:bg-wash-crosshair',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
        ].join(' ')}
      >
        ✕
      </button>
    </div>
  );
}
