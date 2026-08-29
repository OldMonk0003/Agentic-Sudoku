'use client';

import { useEffect, useRef } from 'react';
import { Pause } from 'lucide-react';
import { pause, tick } from '@/state/actions';
import { store, useSession } from './useStore';

/**
 * The elapsed clock and the pause control.
 *
 * The VIEW owns the interval; the STORE owns the number. That keeps the state
 * layer free of timers (Principle III) and makes elapsed time deterministic in
 * tests -- they dispatch `tick` directly rather than waiting on wall time.
 *
 * The store rejects `tick` unless the status is `playing`, so pausing and
 * completing both stop the clock without this component having to know why.
 */

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function Timer() {
  const session = useSession();
  const running = session.status === 'playing';
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!running) return;

    lastTickRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      store.dispatch(tick(delta));
    }, 500);

    return () => window.clearInterval(id);
  }, [running]);

  const paused = session.status === 'paused';
  const complete = session.status === 'complete';

  return (
    <div className="flex items-center gap-2">
      <span
        data-testid="timer"
        aria-label={`Elapsed time ${formatElapsed(session.elapsedMs)}`}
        className="font-medium tabular-nums text-ink-clue"
      >
        {formatElapsed(session.elapsedMs)}
      </span>

      {/*
        While paused, the overlay owns Resume. Rendering a second "Resume" here
        would give the page two controls with the same accessible name, which is
        ambiguous for screen-reader users and puts the action away from where the
        player is looking.
      */}
      {!paused && (
        <button
          type="button"
          disabled={complete}
          aria-label="Pause"
          onClick={() => store.dispatch(pause())}
          className={[
            'flex items-center gap-1.5 rounded-sm border border-line-hairline bg-surface px-2.5 py-1.5',
            'text-sm text-ink-note transition-colors',
            'hover:bg-wash-crosshair',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
            'disabled:cursor-not-allowed disabled:opacity-40',
          ].join(' ')}
        >
          <Pause aria-hidden="true" size={14} />
          <span>Pause</span>
        </button>
      )}
    </div>
  );
}
