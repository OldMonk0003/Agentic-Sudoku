'use client';

import { colOf, rowOf, toCoord, type CellIndex } from '@/engine/grid';
import type { HighlightTier } from '@/state/selectors';
import type { Cell as CellData } from '@/state/types';

/**
 * One board cell.
 *
 * Two rules from research.md R3 are load-bearing here:
 *
 *   - The shoji framing comes from BORDER WEIGHT, not colour (FR-053).
 *   - The selection is a RING composed OVER whichever wash applies -- never a
 *     fourth, darker fill. That is what keeps text at 4.5:1 on every tier.
 *
 * Every tier also carries a non-colour cue so it survives greyscale (FR-009).
 */

interface CellProps {
  readonly index: CellIndex;
  readonly colIndex: number;
  readonly cell: CellData;
  readonly tier: HighlightTier;
  readonly selected: boolean;
  readonly onSelect: (index: CellIndex) => void;
}

function borderClasses(index: CellIndex): string {
  const row = rowOf(index);
  const col = colOf(index);
  const heavyRight = col % 3 === 0 && col !== 9;
  const heavyBottom = row % 3 === 0 && row !== 9;

  return [
    col !== 9 ? (heavyRight ? 'border-r-2 border-r-line-box' : 'border-r border-r-line-hairline') : '',
    row !== 9 ? (heavyBottom ? 'border-b-2 border-b-line-box' : 'border-b border-b-line-hairline') : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The wash a cell renders. A `selected` cell shows the wash it WOULD have had --
 * the ring is what marks it, not a fill -- so `underlyingTier` resolves that.
 */
function washClass(tier: HighlightTier, underlyingTier: HighlightTier): string {
  const effective = tier === 'selected' ? underlyingTier : tier;
  switch (effective) {
    case 'conflict':
      return 'bg-wash-conflict';
    case 'matching':
      return 'bg-wash-matching';
    case 'crosshair':
      return 'bg-wash-crosshair';
    default:
      // Explicit rather than inherited, so every tier resolves to a real
      // computed colour. A transparent cell reads as luminance 0, which made the
      // greyscale ladder test fail against a board it actually rendered fine on.
      return 'bg-ground';
  }
}

/** Non-colour cue: matching digits gain type weight (FR-009). */
function weightClass(tier: HighlightTier, cell: CellData): string {
  if (tier === 'matching') return 'font-semibold';
  if (cell.origin === 'clue') return 'font-medium';
  return 'font-normal';
}

function inkClass(cell: CellData, tier: HighlightTier): string {
  if (tier === 'conflict') return 'text-ink-conflict';
  if (cell.origin === 'clue') return 'text-ink-clue';
  if (cell.origin === 'agent') return 'text-ink-player italic';
  return 'text-ink-player';
}

function describe(row: number, col: number, cell: CellData, tier: HighlightTier): string {
  const where = `Row ${row}, column ${col}`;
  const what =
    cell.value === null
      ? 'empty'
      : cell.origin === 'clue'
        ? `${cell.value}, given`
        : String(cell.value);
  const state = tier === 'conflict' ? ', conflict' : '';
  return `${where}, ${what}${state}`;
}

export function Cell({ index, colIndex, cell, tier, selected, onSelect }: CellProps) {
  const { row, col } = toCoord(index);
  const origin = cell.value === null ? 'empty' : cell.origin;

  // What wash this cell would show if it were not the selected one.
  const underlying: HighlightTier = selected ? 'crosshair' : tier;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={describe(row, col, cell, tier)}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      aria-colindex={colIndex}
      data-index={index}
      data-origin={origin}
      data-tier={tier}
      data-selected={selected ? 'true' : 'false'}
      onClick={() => onSelect(index)}
      className={[
        'relative flex items-center justify-center',
        'aspect-square select-none',
        'text-cell leading-none',
        'border-solid',
        borderClasses(index),
        washClass(tier, underlying),
        weightClass(tier, cell),
        inkClass(cell, tier),
        // The ring, composed over whatever wash applies.
        selected ? 'z-10 outline-2 outline-offset-[-2px] outline-ring-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {cell.value ?? ''}
    </button>
  );
}
