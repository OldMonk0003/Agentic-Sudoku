'use client';

import { Hash } from 'lucide-react';
import { preferencesStore, showRuler, hideRuler } from '@/state/preferences';
import { useRulerVisible } from './usePreferences';

/**
 * The learner's own control over the coordinate ruler (FR-013).
 *
 * This button is what makes the ruler an ORDINARY READABILITY AID rather than an
 * agent affordance. It is present and working whether or not an agent is
 * connected, which is why the no-host parity test had to be amended rather than
 * left alone: the ruler is the one thing feature 003 adds that a host-less page
 * still gets.
 *
 * It dispatches to the same store the agent's tools dispatch to, so neither
 * actor's view of the ruler is authoritative over the other's, and this control
 * reflects a change the agent made without knowing the agent exists.
 *
 * `role="switch"` with `aria-checked`, matching ModeToggle: the control reports
 * its STATE, not merely its next action.
 */
export function RulerToggle() {
  const visible = useRulerVisible();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={visible}
      aria-label="Row and column numbers"
      onClick={() => preferencesStore.dispatch(visible ? hideRuler() : showRuler())}
      className={[
        'flex items-center gap-1.5 rounded-sm border border-line-hairline px-2.5 py-1.5',
        'text-sm transition-colors',
        visible ? 'bg-wash-crosshair text-ink-clue' : 'bg-surface text-ink-note',
        'hover:bg-wash-crosshair',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
      ].join(' ')}
    >
      <Hash aria-hidden="true" size={14} />
      <span>Numbers</span>
    </button>
  );
}
