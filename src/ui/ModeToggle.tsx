'use client';

import { toggleInputMode } from '@/state/actions';
import { store, useSelector } from './useStore';

/**
 * Normal / pencil mode switch.
 *
 * FR-013 requires the ACTIVE mode to be visible at all times, not merely which
 * mode is available. A `switch` role with `aria-checked` states that to assistive
 * technology, and the visible label plus fill states it to everyone else -- so
 * the mode is never conveyed by styling alone.
 */
export function ModeToggle() {
  const notes = useSelector((s) => s.inputMode === 'notes');

  return (
    <button
      type="button"
      role="switch"
      aria-checked={notes}
      aria-label="Pencil notes"
      onClick={() => {
        store.dispatch(toggleInputMode());
        // Return focus to the board. This control exists solely to change how
        // typing on the board behaves, so leaving focus on the button means the
        // player's very next keystroke goes nowhere -- and toggling then typing
        // is the primary flow. The selected cell announces itself on focus, so
        // screen-reader users are told where they landed.
        //
        // Synchronous, not deferred: the selected cell is already in the DOM
        // (the selection did not change), and deferring to a frame let a fast
        // keystroke land before focus moved.
        document.querySelector<HTMLElement>('[role="gridcell"][data-selected="true"]')?.focus();
      }}
      className={[
        'flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
        notes
          ? 'border-line-box bg-wash-matching text-ink-clue'
          : 'border-line-hairline bg-surface text-ink-note',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'inline-block h-2 w-2 rounded-full',
          notes ? 'bg-ink-clue' : 'bg-line-box',
        ].join(' ')}
      />
      <span>Pencil</span>
      <span className="sr-only">{notes ? 'on' : 'off'}</span>
    </button>
  );
}
