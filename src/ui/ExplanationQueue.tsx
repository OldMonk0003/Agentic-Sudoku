'use client';

import { dismissExplanation, visibleExplanations } from '@/state/agentSession';
import { agentStore, useAgentSession } from './useAgentStore';

/**
 * What the agent said, and why the board changed.
 *
 * Four constraints, each of which would be a defect if dropped:
 *
 * - **Untrusted text (FR-021).** `explanation` is agent-authored. It is rendered
 *   as a React text child and nothing else: no `dangerouslySetInnerHTML`, no
 *   markdown, no URL auto-linking, no `<a>`. If someone later wants clickable
 *   cell references in explanations, this is the comment that says why they
 *   cannot simply parse the string.
 * - **Never blocking (FR-018, SC-007).** A polite live region, not a dialog. No
 *   focus trap, no backdrop, no autoFocus. The learner keeps typing through it.
 * - **Announced without stealing focus (FR-022).** `role="status"` +
 *   `aria-live="polite"` is exactly that contract.
 * - **Capped at three (FR-020).** Further explanations queue and surface as
 *   these expire, so the board is never buried under narration.
 *
 * MOUNTED ONLY WHILE AN AGENT EXISTS. The live region has to persist across
 * explanations for a screen reader to announce them reliably, so it deliberately
 * renders even when empty -- but with no host at all it must not exist, because
 * SC-010 requires a host-less page to carry zero agent-related elements and an
 * empty labelled status region is one. Gating on the connection gives both: a
 * stable region for the whole agent session, and nothing whatsoever without one.
 */
export function ExplanationQueue() {
  const session = useAgentSession();
  const explanations = visibleExplanations(session, Date.now());

  if (session.connection === 'absent') return null;

  return (
    <div
      data-testid="explanation-queue"
      role="status"
      aria-live="polite"
      aria-label="Agent explanations"
      className="flex w-full max-w-[min(92vw,34rem)] flex-col gap-2 empty:hidden"
    >
      {explanations.map((explanation) => (
        <div
          key={explanation.id}
          data-testid="explanation"
          data-tool={explanation.tool}
          className={[
            'flex items-start gap-2 rounded-sm border border-agent-edge bg-agent-surface px-3 py-2',
            'text-sm text-ink-clue',
          ].join(' ')}
        >
          {/* Attribution (FR-017), carried in text as well as by the mark. */}
          <span aria-hidden="true" className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-mark-agent" />
          <span className="sr-only">Agent:</span>

          {/*
            The agent's words, as a TEXT NODE. React escapes it; that is the
            whole defence and it must stay the whole defence.
          */}
          <p className="flex-1">{explanation.text}</p>

          <button
            type="button"
            aria-label="Dismiss explanation"
            onClick={() => agentStore.dispatch(dismissExplanation({ id: explanation.id }))}
            className={[
              'shrink-0 rounded-sm px-1.5 text-xs text-ink-note',
              'transition-colors hover:bg-wash-crosshair',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
            ].join(' ')}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
