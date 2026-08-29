'use client';

import { useEffect, useRef } from 'react';
import { ALL_INDICES, toCoord, toIndex, type CellIndex, type Digit } from '@/engine/grid';
import { enterDigit, eraseCell, moveSelection, selectCell, toggleInputMode } from '@/state/actions';
import { Cell } from './Cell';
import { store, useSession } from './useStore';
import type { Direction } from '@/state/actions';

/**
 * The 9x9 grid and the board's keyboard surface.
 *
 * Shortcuts are scoped to the board, so Space never flips pencil mode while the
 * player is operating the difficulty select or a button (spec edge case).
 */

/** Indices grouped by row, for the ARIA row structure. */
const ROWS: readonly (readonly CellIndex[])[] = Array.from({ length: 9 }, (_, r) =>
  ALL_INDICES.slice(r * 9, r * 9 + 9),
);

const ARROWS: Record<string, Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};

export function Board() {
  const session = useSession();
  const gridRef = useRef<HTMLDivElement>(null);

  // Move programmatic focus with the selection, so keyboard and screen-reader
  // navigation stay in step (FR-047).
  useEffect(() => {
    if (session.selection === null) return;
    const index = toIndex(session.selection);
    const cell = gridRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (cell && document.activeElement !== cell) cell.focus({ preventScroll: true });
  }, [session.selection]);

  const onSelect = (index: CellIndex) => store.dispatch(selectCell(toCoord(index)));

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const { key } = event;

    if (key in ARROWS) {
      event.preventDefault();
      store.dispatch(moveSelection(ARROWS[key]!));
      return;
    }

    if (key >= '1' && key <= '9') {
      event.preventDefault();
      store.dispatch(enterDigit(Number(key) as Digit, 'player'));
      return;
    }

    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      store.dispatch(eraseCell('player'));
      return;
    }

    if (key === ' ' || key === 'n' || key === 'N') {
      event.preventDefault();
      store.dispatch(toggleInputMode());
    }
  };

  const generating = session.status === 'generating';

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label="Sudoku board"
      aria-rowcount={9}
      aria-colcount={9}
      aria-busy={generating}
      onKeyDown={onKeyDown}
      className={[
        'grid grid-cols-9',
        'w-full max-w-[min(92vw,34rem)] aspect-square',
        'bg-ground',
        'border-2 border-solid border-line-box',
        // A skeleton, never a blank page or a blocking spinner (SC-011).
        generating ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/*
        role="grid" REQUIRES role="row" children -- axe flags this as critical
        otherwise. `display: contents` keeps the rows out of the CSS grid layout
        while giving assistive technology the structure it needs.
      */}
      {ROWS.map((rowIndices, row) => (
        <div key={row} role="row" aria-rowindex={row + 1} className="contents">
          {rowIndices.map((index, col) => (
            <Cell
              key={index}
              index={index}
              colIndex={col + 1}
              cell={session.cells[index]!}
              selected={session.selection !== null && toIndex(session.selection) === index}
              onSelect={onSelect}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
