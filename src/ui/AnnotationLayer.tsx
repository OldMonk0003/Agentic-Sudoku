'use client';

import { ALL_INDICES } from '@/engine/grid';
import { annotatedRoles, visibleBeams, type AnnotationRole } from '@/state/agentSession';
import { useAgentSession } from './useAgentStore';

/**
 * The agent's marks, drawn OVER the board.
 *
 * Three decisions here are load-bearing:
 *
 * 1. **It is a SIBLING of the grid, never a child.** `role="grid"` requires
 *    `role="row"` children and axe flags anything else as critical -- 001 already
 *    paid to learn that. This layer is absolutely positioned over the grid and is
 *    `aria-hidden` with `pointer-events: none`, so it can neither be focused nor
 *    intercept a click meant for a cell.
 *
 * 2. **Roles are distinguished by FORM before colour** (FR-035). `target` is a
 *    solid outline plus a FILLED corner dot; `because` is a diagonal hatch plus a
 *    HOLLOW corner dot. Filled versus hollow survives greyscale; two tints of
 *    sage do not. Neither uses a full ring -- that is the learner's selection cue
 *    and it must keep meaning exactly one thing (FR-032).
 *
 * 3. **Beams are lines where the learner's highlighting is fills.** Where a row
 *    beam crosses a column beam, the two stay readable because they run in
 *    different directions, not because they are different colours (FR-029).
 *
 * Screen-reader users get this same information from the summary in Board.tsx and
 * from each cell's own label -- never from here.
 */

function CellMark({ role }: { readonly role: AnnotationRole }) {
  const target = role === 'target';

  return (
    <span
      data-agent-annotation={role}
      className={[
        'relative block h-full w-full',
        target ? 'outline-2 -outline-offset-2 outline-mark-agent' : '',
      ].join(' ')}
    >
      {/*
        The `because` hatch is a FRAME, not a fill.

        Hatching the whole cell was the obvious implementation and it was wrong:
        the stripes run straight through the digit underneath, and a clue's `4`
        became genuinely hard to read. The contrast test could not catch it --
        the ratios are computed against the flat token, while the damage is done
        by stripes crossing the glyph. It took looking at the board.

        Framing keeps the pattern (which is the greyscale-safe cue) and leaves
        the middle of the cell completely clear for whatever is written there.
      */}
      {!target && (
        <>
          <span className="agent-hatch absolute inset-x-0 top-0 h-[22%]" />
          <span className="agent-hatch absolute inset-x-0 bottom-0 h-[22%]" />
          <span className="agent-hatch absolute inset-y-0 left-0 w-[22%]" />
          <span className="agent-hatch absolute inset-y-0 right-0 w-[22%]" />
        </>
      )}

      {/*
        The non-colour cue. Filled for target, hollow for because -- the one
        difference that survives having all colour removed.
      */}
      <span
        className={[
          'absolute left-[6%] top-[6%] h-[18%] w-[18%] rounded-full border border-mark-agent',
          target ? 'bg-mark-agent' : 'bg-ground',
        ].join(' ')}
      />
    </span>
  );
}

export function AnnotationLayer() {
  const session = useAgentSession();
  // Read `now` at render. The expiry interval in GameScreen dispatches `expire`,
  // which re-renders us; this makes the filter exact rather than up to a tick late.
  const now = Date.now();
  const roles = annotatedRoles(session, now);
  const beams = visibleBeams(session, now);
  // Read as a VALUE from the store, published by the View (002/FR-061). The
  // tools layer never queries a media query, and this component never has to
  // decide what "reduced" means.
  const still = session.reducedMotion;

  if (roles.size === 0 && beams.length === 0) return null;

  return (
    <div
      data-testid="annotation-layer"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 grid grid-cols-9"
    >
      {ALL_INDICES.map((index) => {
        const role = roles.get(index);
        const row = Math.floor(index / 9) + 1;
        const col = (index % 9) + 1;
        const box = Math.floor((row - 1) / 3) * 3 + Math.floor((col - 1) / 3) + 1;

        const rowBeam = beams.some((b) => b.unit.type === 'row' && b.unit.n === row);
        const colBeam = beams.some((b) => b.unit.type === 'col' && b.unit.n === col);
        const boxBeam = beams.some((b) => b.unit.type === 'box' && b.unit.n === box);

        return (
          <span key={index} className="relative aspect-square">
            {role && <CellMark role={role} />}

            {/* A ray along the row: horizontal, through the middle. */}
            {rowBeam && (
              <span
                data-agent-beam="row"
                className={[
                  'absolute inset-x-0 top-1/2 border-t-2 border-dashed border-mark-agent',
                  still ? '' : 'agent-beam-row',
                ].join(' ')}
              />
            )}
            {/* A ray along the column: vertical. Crossing beams stay separable
                because they run in different directions. */}
            {colBeam && (
              <span
                data-agent-beam="col"
                className={[
                  'absolute inset-y-0 left-1/2 border-l-2 border-dashed border-mark-agent',
                  still ? '' : 'agent-beam-col',
                ].join(' ')}
              />
            )}
            {/* A box is an area rather than a line, so it is framed. */}
            {boxBeam && (
              <span
                data-agent-beam="box"
                className="absolute inset-[8%] border-2 border-dotted border-mark-agent"
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
