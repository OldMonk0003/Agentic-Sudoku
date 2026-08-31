'use client';

import { useRulerVisible } from './usePreferences';

/**
 * The numbered gutters around the grid (FR-006, FR-007).
 *
 * WHY IT EXISTS: naming a cell on a board of 81 identical boxes means counting
 * across and counting down, every time, and miscounting is easy. With the guides
 * up the learner reads "row 4, column 7" straight off the board and says it to
 * the agent. That is the whole feature.
 *
 * THREE DECISIONS WORTH KNOWING:
 *
 *   1. `aria-hidden` (FR-017). Every cell ALREADY announces its own coordinates
 *      (001/FR-047), so exposing the ruler would append a second coordinate to
 *      every cell announcement -- making the board worse for a screen-reader
 *      learner in service of an aid that exists to stop sighted learners
 *      counting. The learner's TOGGLE is exposed; the numbers are not.
 *
 *   2. `--color-ink-note`, not the red of the original screenshot (research.md
 *      R6). 001/FR-052 mandates a warm low-saturation palette, and
 *      `--color-ink-conflict` is commented "muted clay, never alert red" -- so
 *      red in the gutters would borrow the board's conflict vocabulary for
 *      something that is not a conflict. FR-008 also wants the ruler
 *      SUBORDINATE to the grid.
 *
 *   3. It renders NOTHING when hidden, so the hidden board is byte-identical to
 *      the one that shipped before this feature.
 */

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

interface CoordinateRulerProps {
  readonly axis: 'columns' | 'rows';
}

export function CoordinateRuler({ axis }: CoordinateRulerProps) {
  const visible = useRulerVisible();
  if (!visible) return null;

  const columns = axis === 'columns';

  return (
    <div
      data-testid={`ruler-${axis}`}
      // FR-017. The numbers are decoration for the eye; the cells carry the
      // coordinates for assistive technology.
      aria-hidden="true"
      className={[
        'pointer-events-none select-none',
        'text-ink-note tabular-nums',
        // The smallest step of the existing scale -- legible, never competing
        // with the digits (FR-008).
        'text-candidate',
        columns
          ? 'grid grid-cols-9 w-full items-end pb-1'
          : 'grid grid-rows-9 h-full justify-end pr-1.5',
      ].join(' ')}
    >
      <span className={columns ? 'sr-only' : 'sr-only'}>{columns ? 'Columns' : 'Rows'}</span>
      {NUMBERS.map((n) => (
        <span
          key={n}
          data-ruler-index={n}
          className="flex items-center justify-center leading-none"
        >
          {n}
        </span>
      ))}
    </div>
  );
}
