'use client';

import { Eraser, Undo2 } from 'lucide-react';
import { eraseCell, undo } from '@/state/actions';
import { store, useSelector } from './useStore';

/**
 * Erase and Undo.
 *
 * Icons are imported one by one, never from the barrel, against the bundle
 * budget (constitution, Technology Constraints). Each control carries a text
 * label as well as its glyph, so nothing is conveyed by icon alone (FR-046).
 */

const buttonClasses = [
  'flex items-center gap-1.5 rounded-sm border border-line-hairline bg-surface px-3 py-1.5',
  'text-sm text-ink-note transition-colors',
  'hover:bg-wash-crosshair',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
  'disabled:cursor-not-allowed disabled:opacity-40',
].join(' ');

export function Controls() {
  // A real `disabled` attribute is what assistive technology reads; the reduced
  // opacity is reinforcement, never the sole carrier of the state (FR-032, FR-048).
  const canUndo = useSelector((s) => s.history.length > 0);

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Game controls">
      <button
        type="button"
        aria-label="Erase"
        onClick={() => store.dispatch(eraseCell('player'))}
        className={buttonClasses}
      >
        <Eraser aria-hidden="true" size={14} />
        <span>Erase</span>
      </button>

      <button
        type="button"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={() => store.dispatch(undo())}
        className={buttonClasses}
      >
        <Undo2 aria-hidden="true" size={14} />
        <span>Undo</span>
      </button>
    </div>
  );
}
