'use client';

import { RotateCcw } from 'lucide-react';
import { requestPuzzle } from './puzzleLoader';
import { useSelector } from './useStore';

/**
 * A different puzzle, at the level you are already on (005/FR-001 -- FR-007).
 *
 * WHAT "RESTART" MEANS HERE, because the word usually means the opposite. Most
 * games restart *the level you are on* -- same board, your progress wiped. This
 * hands you a NEW grid at the same difficulty. The author asked for "a different
 * game", and the distinction is the whole feature: it answers "I closed the tab
 * and I do not want this puzzle back", which clearing the board would not.
 *
 * IT IS THE DIFFICULTY CONTROL AIMED AT THE LEVEL YOU ARE ALREADY ON, and it
 * reuses the function that proves it: `requestPuzzle` is what `DifficultySelect`
 * calls, and what `CompletionBanner` has called since feature 001. The "different
 * grid" guarantee lives in `puzzleLoader` rather than here, so every caller gets
 * it (005/research.md R2).
 *
 * NO CONFIRMATION (FR-006). Pressing a button labelled Restart is an intentional
 * act, and the difficulty control already discards a board without asking. A
 * prompt here would be inconsistent -- and, given that this feature exists to
 * remove the last thing requiring a hand, self-defeating.
 *
 * WHERE IT IS MOUNTED IS PART OF THE DESIGN. It sits beside the difficulty
 * control, NOT beside Erase and Undo (005/research.md R7). It replaces the board
 * without asking, Erase and Undo are the two most-pressed controls on the page,
 * and a replaced board cannot be recovered -- it is not in the undo history, and
 * only one game is ever saved. `tests/a11y/restart.spec.ts` asserts the two are
 * not adjacent in the tab order, so a later layout change cannot quietly undo
 * that reasoning.
 */
export function RestartButton() {
  // Read at click time via the store rather than closing over a render value,
  // so a board replaced between render and click cannot restart the wrong level.
  const difficulty = useSelector((s) => s.puzzle?.difficulty ?? 'easy');
  const generating = useSelector((s) => s.status === 'generating');

  return (
    <button
      type="button"
      aria-label="Restart"
      onClick={() => requestPuzzle(difficulty)}
      className={[
        'flex items-center gap-1.5 rounded-sm border border-line-hairline bg-surface px-2.5 py-1.5',
        'text-sm text-ink-note transition-colors',
        'hover:bg-wash-crosshair',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-selected',
      ].join(' ')}
    >
      {/*
        Imported icon by icon, never from the barrel, against the bundle budget
        (constitution, Technology Constraints). Decoration only -- the word
        carries the meaning, so nothing is conveyed by glyph alone (001/FR-046).
      */}
      <RotateCcw aria-hidden="true" size={14} className={generating ? 'opacity-40' : ''} />
      <span>Restart</span>
    </button>
  );
}
