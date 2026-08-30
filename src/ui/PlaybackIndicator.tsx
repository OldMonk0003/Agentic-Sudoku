'use client';

import { useAgentSelector } from './useAgentStore';

/**
 * "The agent is walking you through something, and it is on step 2 of 3."
 *
 * Deliberately NOT a blocker: no backdrop, no focus trap, no disabled controls.
 * FR-051 and SC-007 require the board to stay visible and the learner never to
 * be prevented from acting -- and acting is what STOPS the walkthrough, so a
 * control that got in the way would defeat its own purpose.
 */
export function PlaybackIndicator() {
  const playback = useAgentSelector((session) => session.playback);

  if (!playback?.running) return null;

  return (
    <p
      data-testid="playback-indicator"
      role="status"
      aria-live="polite"
      className={[
        'w-full max-w-[min(92vw,34rem)] rounded-sm border border-dashed border-agent-edge',
        'bg-agent-surface px-3 py-1.5 text-center text-xs text-ink-note',
      ].join(' ')}
    >
      Agent walkthrough, step {Math.min(playback.completedSteps + 1, playback.totalSteps)} of{' '}
      {playback.totalSteps}. Touch the board at any time to take over.
    </p>
  );
}
