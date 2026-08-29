'use client';

import type { CellIndex } from '@/engine/grid';
import { boxOf, colOf, rowOf, toCoord } from '@/engine/grid';

/**
 * One board cell.
 *
 * Slice 0 renders structure only -- no interactivity, no values. The shoji
 * framing comes from BORDER WEIGHT, not colour (FR-053), so the 3x3 structure
 * survives greyscale and colour-blind rendering.
 *
 * Only right and bottom edges are drawn per cell; the board container supplies
 * the outer frame. That avoids doubled lines between neighbours.
 */

interface CellProps {
  readonly index: CellIndex;
}

function borderClasses(index: CellIndex): string {
  const row = rowOf(index);
  const col = colOf(index);

  // Interior box seams are heavier. The outermost edges belong to the board frame.
  const heavyRight = col % 3 === 0 && col !== 9;
  const heavyBottom = row % 3 === 0 && row !== 9;

  return [
    col !== 9 ? (heavyRight ? 'border-r-2 border-r-line-box' : 'border-r border-r-line-hairline') : '',
    row !== 9 ? (heavyBottom ? 'border-b-2 border-b-line-box' : 'border-b border-b-line-hairline') : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function Cell({ index }: CellProps) {
  const { row, col } = toCoord(index);

  return (
    <div
      role="gridcell"
      aria-label={`Row ${row}, column ${col}, empty`}
      data-index={index}
      data-box={boxOf(index)}
      className={[
        'relative flex items-center justify-center',
        'aspect-square select-none',
        'text-cell leading-none',
        'border-solid',
        borderClasses(index),
      ].join(' ')}
    />
  );
}
