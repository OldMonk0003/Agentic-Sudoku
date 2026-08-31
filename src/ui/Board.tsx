'use client';

import { useEffect, useRef } from 'react';
import { ALL_INDICES, toCoord, toIndex, type CellIndex, type Digit } from '@/engine/grid';
import { enterDigit, eraseCell, moveSelection, selectCell, toggleCandidate, toggleInputMode } from '@/state/actions';
import { boardTiers, conflictSet } from '@/state/selectors';
import { Cell } from './Cell';
import { AnnotationLayer } from './AnnotationLayer';
import { CoordinateRuler } from './CoordinateRuler';
import { store, useSession } from './useStore';
import { agentStore, useAgentSession } from './useAgentStore';
import { annotatedRoles, learnerActed } from '@/state/agentSession';
import { useRulerVisible } from './usePreferences';
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
  const agentSession = useAgentSession();
  // Computed per render, never stored -- FR-028 holds by construction.
  const conflicts = conflictSet(session);
  const tiers = boardTiers(session, conflicts);
  const annotations = annotatedRoles(agentSession, Date.now());
  const rulerVisible = useRulerVisible();
  const gridRef = useRef<HTMLDivElement>(null);

  /**
   * The interruption signal (002/FR-048).
   *
   * The board raises a counter; the playback sequencer in the Tools layer
   * watches it. This component does not know that playback exists, and lint
   * forbids it from importing anything that does -- they meet only at the agent
   * session store.
   */
  const noteLearnerActivity = () => agentStore.dispatch(learnerActed());

  // Move programmatic focus with the selection, so keyboard and screen-reader
  // navigation stay in step (FR-047).
  useEffect(() => {
    if (session.selection === null) return;
    const index = toIndex(session.selection);
    const cell = gridRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (cell && document.activeElement !== cell) cell.focus({ preventScroll: true });
  }, [session.selection]);

  const onSelect = (index: CellIndex) => {
    noteLearnerActivity();
    store.dispatch(selectCell(toCoord(index)));
  };

  // Exactly one cell is tabbable: the selection, or the first cell when there is
  // none. Otherwise Tab skips the board entirely (FR-046, SC-005).
  const tabbableIndex = session.selection === null ? 0 : toIndex(session.selection);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const { key } = event;
    noteLearnerActivity();

    if (key in ARROWS) {
      event.preventDefault();
      store.dispatch(moveSelection(ARROWS[key]!));
      return;
    }

    if (key >= '1' && key <= '9') {
      event.preventDefault();
      const digit = Number(key) as Digit;
      // The active mode decides whether a digit is a value or a candidate.
      store.dispatch(
        session.inputMode === 'notes'
          ? toggleCandidate(digit, 'player')
          : enterDigit(digit, 'player'),
      );
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

  // Announced politely and never given focus, so it cannot interrupt the player
  // mid-entry (FR-026, FR-018).
  const conflictMessage =
    conflicts.size === 0
      ? ''
      : `${conflicts.size} cell${conflicts.size === 1 ? '' : 's'} in conflict`;

  const describeCells = (role: 'target' | 'because') =>
    [...annotations.entries()]
      .filter(([, value]) => value === role)
      .map(([index]) => `row ${Math.floor(index / 9) + 1} column ${(index % 9) + 1}`)
      .join(', ');

  const annotationMessage = (() => {
    if (annotations.size === 0) return '';
    const targets = describeCells('target');
    const because = describeCells('because');
    return [
      targets && `Agent highlighted ${targets} as the target`,
      because && `justified by ${because}`,
    ]
      .filter(Boolean)
      .join(', ') + '.';
  })();

  return (
    <>
    {/*
      The positioning context for the annotation overlay. The overlay must be a
      SIBLING of the grid, never a child: role="grid" requires role="row"
      children and axe flags anything else as critical (001 learned this).

      003: the coordinate ruler adds GRID TRACKS around the board rather than
      overlaying it or padding its inside -- a gutter inside role="grid" would
      break the row structure axe checks, and an overlay would sit on top of the
      cells it is meant to label. When the ruler is hidden no tracks are
      rendered at all, so that state is byte-identical to the pre-003 board.
    */}
    <div
      className="w-full max-w-[min(92vw,34rem)]"
      style={
        rulerVisible
          ? { display: 'grid', gridTemplateColumns: 'auto 1fr', gridTemplateRows: 'auto 1fr' }
          : undefined
      }
    >
      {rulerVisible && (
        <>
          {/* Top-left corner: the captions, outside both number tracks so the
              nine columns stay aligned with the nine cells. */}
          <div
            aria-hidden="true"
            className="flex flex-col items-end justify-end pb-1 pr-1.5 text-candidate leading-tight text-ink-note"
          >
            <span>Columns</span>
            <span>Row</span>
          </div>
          <CoordinateRuler axis="columns" />
          <CoordinateRuler axis="rows" />
        </>
      )}
    <div className="relative w-full">
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
        'w-full aspect-square',
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
              tier={tiers[index]!}
              annotation={annotations.get(index) ?? null}
              conflict={conflicts.has(index)}
              selected={session.selection !== null && toIndex(session.selection) === index}
              tabbable={index === tabbableIndex}
              onSelect={onSelect}
            />
          ))}
        </div>
      ))}
    </div>
    <AnnotationLayer />
    </div>
    </div>
    <p data-testid="conflict-announcement" role="status" aria-live="polite" className="sr-only">
      {conflictMessage}
    </p>
    {/*
      002/FR-060 and SC-011: a screen-reader learner must be able to determine
      every annotated cell. Announced politely, never taking focus; the cell's
      own label carries the same fact in place, for a learner arrowing the board.
    */}
    <p data-testid="annotation-announcement" role="status" aria-live="polite" className="sr-only">
      {annotationMessage}
    </p>
    </>
  );
}
