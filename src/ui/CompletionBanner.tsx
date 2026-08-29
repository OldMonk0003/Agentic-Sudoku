'use client';

/**
 * Completion feedback.
 *
 * FR-038 requires this to be non-blocking, and Principle V is explicit that a
 * dialog the player must dismiss is exactly the blocking feedback the
 * constitution bans. So this is an inline banner, announced politely, that never
 * takes focus -- the player can sit and look at their finished board for as long
 * as they like.
 */

interface CompletionBannerProps {
  readonly complete: boolean;
  readonly elapsedMs: number;
  readonly onNewPuzzle: () => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function CompletionBanner({ complete, elapsedMs, onNewPuzzle }: CompletionBannerProps) {
  if (!complete) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex w-full max-w-[min(92vw,34rem)] items-center justify-between gap-4',
        'rounded-sm border border-line-hairline bg-surface px-4 py-3',
        'text-ink-clue',
      ].join(' ')}
    >
      <p className="text-sm">
        Solved in <span className="font-medium tabular-nums">{formatElapsed(elapsedMs)}</span>
      </p>
      <button
        type="button"
        onClick={onNewPuzzle}
        className={[
          'rounded-sm border border-line-box px-3 py-1.5 text-sm',
          'text-ink-player transition-colors hover:bg-wash-crosshair',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
        ].join(' ')}
      >
        New puzzle
      </button>
    </div>
  );
}
