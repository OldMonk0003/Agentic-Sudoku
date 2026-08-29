'use client';

import { DIGITS, colOf, rowOf, toCoord, type CellIndex } from '@/engine/grid';
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
  readonly conflict: boolean;
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

function inkClass(cell: CellData, conflict: boolean): string {
  if (conflict) return 'text-ink-conflict';
  if (cell.origin === 'clue') return 'text-ink-clue';
  if (cell.origin === 'agent') return 'text-ink-player italic';
  return 'text-ink-player';
}

function describe(row: number, col: number, cell: CellData, conflict: boolean): string {
  const where = `Row ${row}, column ${col}`;
  const notes = [...cell.candidates].sort().join(' ');
  const what =
    cell.value === null
      ? cell.candidates.size > 0
        ? `notes ${notes}`
        : 'empty'
      : cell.origin === 'clue'
        ? `${cell.value}, given`
        : String(cell.value);
  // The conflict is named in the label itself, so a screen reader hears it in
  // place rather than only via the live region (FR-026, FR-047).
  return `${where}, ${what}${conflict ? ', conflict' : ''}`;
}

export function Cell({ index, colIndex, cell, tier, conflict, selected, onSelect }: CellProps) {
  const { row, col } = toCoord(index);
  const origin = cell.value === null ? 'empty' : cell.origin;

  // What wash this cell would show if it were not the selected one. A selected
  // cell that is ALSO in conflict keeps the conflict wash -- losing it would hide
  // the more important signal behind the less important one.
  const underlying: HighlightTier = selected ? (conflict ? 'conflict' : 'crosshair') : tier;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={describe(row, col, cell, conflict)}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      aria-colindex={colIndex}
      data-index={index}
      data-origin={origin}
      data-tier={tier}
      data-conflict={conflict ? 'true' : 'false'}
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
        inkClass(cell, conflict),
        // The ring, composed over whatever wash applies.
        selected ? 'z-10 outline-2 outline-offset-[-2px] outline-ring-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {cell.value ?? ''}

      {/*
        Candidates occupy FIXED positions in a 3x3 sub-grid, so a missing
        candidate reads as a gap rather than shifting its neighbours (FR-022).
        That is what makes a pencilled cell scannable at a glance.
      */}
      {cell.value === null && cell.candidates.size > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 p-[8%]"
        >
          {DIGITS.map((digit) => (
            <span
              key={digit}
              {...(cell.candidates.has(digit) ? { 'data-candidate': digit } : {})}
              className="flex items-center justify-center text-candidate leading-none text-ink-note"
            >
              {cell.candidates.has(digit) ? digit : ''}
            </span>
          ))}
        </span>
      )}
      {/*
        The NON-COLOUR cue for a conflict (FR-026). The author's brief specified
        "soft red"; Principle V forbids conveying anything by colour alone, so the
        wash is accompanied by a corner wedge that survives greyscale and
        colour-blind rendering.
      */}
      {conflict && (
        <span
          data-conflict-marker
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 h-0 w-0 border-r-6 border-b-6 border-r-ink-conflict border-b-transparent"
        />
      )}
    </button>
  );
}
