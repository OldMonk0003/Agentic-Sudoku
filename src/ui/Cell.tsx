'use client';

import { colOf, rowOf, toCoord, type CellIndex } from '@/engine/grid';
import type { Cell as CellData } from '@/state/types';

/**
 * One board cell.
 *
 * The shoji framing comes from BORDER WEIGHT, not colour (FR-053), so the 3x3
 * structure survives greyscale. Clue and player digits differ by BOTH ink and
 * weight, so they stay distinguishable with colour removed (SC-004).
 */

interface CellProps {
  readonly index: CellIndex;
  readonly colIndex: number;
  readonly cell: CellData;
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

function inkClasses(cell: CellData): string {
  if (cell.origin === 'clue') return 'text-ink-clue font-medium';
  if (cell.origin === 'agent') return 'text-ink-player italic';
  return 'text-ink-player';
}

function describe(row: number, col: number, cell: CellData): string {
  const where = `Row ${row}, column ${col}`;
  if (cell.value === null) return `${where}, empty`;
  if (cell.origin === 'clue') return `${where}, ${cell.value}, given`;
  return `${where}, ${cell.value}`;
}

export function Cell({ index, colIndex, cell, selected, onSelect }: CellProps) {
  const { row, col } = toCoord(index);
  const origin = cell.value === null ? 'empty' : cell.origin;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={describe(row, col, cell)}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      aria-colindex={colIndex}
      data-index={index}
      data-origin={origin}
      data-selected={selected ? 'true' : 'false'}
      onClick={() => onSelect(index)}
      className={[
        'relative flex items-center justify-center',
        'aspect-square select-none bg-transparent',
        'text-cell leading-none',
        'border-solid',
        borderClasses(index),
        inkClasses(cell),
        // Selection is a RING, never a fill -- that is what keeps every wash tier
        // legible beneath text (research.md R3).
        selected ? 'z-10 outline-2 outline-offset-[-2px] outline-ring-selected' : '',
      ].join(' ')}
    >
      {cell.value ?? ''}
    </button>
  );
}
