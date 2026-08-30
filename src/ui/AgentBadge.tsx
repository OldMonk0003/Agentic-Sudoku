'use client';

import { requestDisconnect } from '@/state/agentSession';
import { agentStore, useAgentSelector } from './useAgentStore';

/**
 * FR-057: the learner can see that an agent is connected, and can disconnect it.
 *
 * The important case is `absent`, and it is easy to get wrong: it renders
 * **nothing**. Not a badge saying "no agent connected" -- nothing. FR-013 and
 * SC-010 require a page with no host to be indistinguishable from feature 001,
 * and a control advertising a capability the learner cannot use would fail that
 * while looking helpful.
 *
 * Disconnect dispatches into the agent store. The registry is subscribed and
 * aborts its controller; this component imports nothing from the Tools layer,
 * and lint enforces that it cannot.
 */
export function AgentBadge() {
  const connection = useAgentSelector((session) => session.connection);

  if (connection === 'absent') return null;

  const connected = connection === 'connected';

  return (
    <div
      data-testid="agent-badge"
      className="flex items-center gap-2 rounded-sm border border-line-hairline bg-surface px-2.5 py-1.5 text-sm text-ink-note"
    >
      {/*
        The dot is reinforcement, never the sole carrier: the state is also in
        the visible text, so nothing here is conveyed by colour alone (FR-035).
      */}
      <span
        aria-hidden="true"
        className={[
          'inline-block h-2 w-2 rounded-full',
          connected ? 'bg-mark-agent' : 'bg-line-box',
        ].join(' ')}
      />
      <span>{connected ? 'Agent connected' : 'Agent disconnected'}</span>

      {connected && (
        <button
          type="button"
          onClick={() => agentStore.dispatch(requestDisconnect())}
          className={[
            'rounded-sm border border-line-hairline px-2 py-0.5 text-xs',
            'transition-colors hover:bg-wash-crosshair',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
          ].join(' ')}
        >
          Disconnect
        </button>
      )}
    </div>
  );
}
