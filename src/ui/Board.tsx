'use client';

import { ALL_INDICES } from '@/engine/grid';
import { Cell } from './Cell';

/**
 * The 9x9 grid.
 *
 * Exposed as a real grid to assistive technology from Slice 0 onward, because
 * the constitution treats accessibility as a gate rather than a follow-up task.
 */
export function Board() {
  return (
    <div
      role="grid"
      aria-label="Sudoku board"
      aria-rowcount={9}
      aria-colcount={9}
      className={[
        'grid grid-cols-9',
        'w-full max-w-[min(92vw,34rem)] aspect-square',
        'bg-ground',
        'border-2 border-solid border-line-box',
      ].join(' ')}
    >
      {ALL_INDICES.map((index) => (
        <Cell key={index} index={index} />
      ))}
    </div>
  );
}
