import { isValidCoord, peersOf, toIndex, type Coord } from '@/engine/grid';

/**
 * Where the agent last changed something (002/FR-018).
 *
 * WHY IT IS A SLOT AND NOT AN ANNOTATION. FR-022 requires at most one spotlight
 * at a time. On the shared annotations list, "replace the previous spotlight but
 * leave the highlights and beams alone" is a filter-and-splice over data other
 * tools also write to -- an invariant a future code path can forget. As a slot
 * it is an assignment, and the invariant cannot be violated. The agent store
 * already has two single-valued slots for the same reason: `toast` and
 * `confirmation`.
 *
 * WHY IT HAS TWO SHAPES. A single changed cell gets its row, column, and box, so
 * the learner's eye is drawn to the deduction's neighbourhood. Several changed
 * cells get only themselves -- a crosshair through each would be a wall of tint.
 *
 * WHY IT SOMETIMES RAISES NOTHING. `auto_fill_all_pencil_marks` writes into
 * every empty cell. Spotlighting sixty cells conveys nothing, obscures the
 * board, and is the opposite of "so the learner can see where the change
 * happened without searching for it". FR-026 asks the spotlight to convey
 * EXTENT; for a whole-board write the honest conveyance is the explanation text,
 * which 002/FR-041 already requires to say what it replaced.
 *
 * EXPIRY IS A SELECTOR, NOT A TIMER -- the pattern annotations.ts established.
 * The spotlight carries an absolute `expiresAt`; the View supplies `now`.
 */

export interface Spotlight {
  /** The cells that actually changed. */
  readonly cells: readonly Coord[];
  /** Set only when exactly one cell changed; drives the row/column/box form. */
  readonly focus: Coord | null;
  readonly expiresAt: number;
}

/** Aligned with ANNOTATION_TTL_MS: one expiry vocabulary for every agent mark. */
export const SPOTLIGHT_TTL_MS = 60_000;

/**
 * Above this many changed cells, no spotlight is raised at all. Nine is one
 * unit's worth -- a row, a column, or a box -- which is the largest change a
 * learner can still take in as a place rather than as a wash.
 */
export const SPOTLIGHT_MAX_CELLS = 9;

/** Build a spotlight, or `null` when one would not help. */
export function makeSpotlight(cells: readonly Coord[], now: number): Spotlight | null {
  if (cells.length === 0 || cells.length > SPOTLIGHT_MAX_CELLS) return null;

  return {
    cells: cells.map(({ row, col }) => ({ row, col })),
    focus: cells.length === 1 ? { row: cells[0]!.row, col: cells[0]!.col } : null,
    expiresAt: now + SPOTLIGHT_TTL_MS,
  };
}

/** Still on screen: not expired. */
export function liveSpotlight(spotlight: Spotlight | null, now: number): Spotlight | null {
  if (!spotlight) return null;
  return spotlight.expiresAt > now ? spotlight : null;
}

const EMPTY: ReadonlySet<number> = new Set();

/**
 * Flat indices to render.
 *
 * At most 21, so recomputing per render is trivially inside the frame budget --
 * and computing rather than storing keeps it from drifting out of step with the
 * board, exactly as selectors.ts does for the learner's own crosshair.
 */
export function spotlitIndices(spotlight: Spotlight | null, now: number): ReadonlySet<number> {
  const live = liveSpotlight(spotlight, now);
  if (!live) return EMPTY;

  if (live.focus && isValidCoord(live.focus)) {
    const index = toIndex(live.focus);
    // A cell's row + column + box union is exactly itself plus its 20 peers.
    return new Set<number>([index, ...peersOf(index)]);
  }

  const indices = new Set<number>();
  for (const coord of live.cells) {
    if (isValidCoord(coord)) indices.add(toIndex(coord));
  }
  return indices;
}

/**
 * Which sides of a spotlit cell face OUT of the band.
 *
 * WHY THIS EXISTS. The first implementation drew a dashed rule around every cell
 * in the band, and the screenshot showed why that is wrong: twenty-one boxed
 * cells read as a mesh of dashes fighting the grid's own 3x3 structure, not as
 * one place the eye is being sent. It obscured the board instead of pointing at
 * it.
 *
 * Drawing only the edges that face outward gives ONE outline around the union of
 * the row, the column, and the box -- a shape, which is what a spotlight is.
 */
export interface SpotlightEdges {
  readonly top: boolean;
  readonly right: boolean;
  readonly bottom: boolean;
  readonly left: boolean;
}

const NO_EDGES: SpotlightEdges = Object.freeze({
  top: false, right: false, bottom: false, left: false,
});

export function spotlightEdgesFor(
  index: number,
  spotlit: ReadonlySet<number>,
): SpotlightEdges {
  if (!spotlit.has(index)) return NO_EDGES;

  const row = Math.floor(index / 9);
  const col = index % 9;

  return {
    top: row === 0 || !spotlit.has(index - 9),
    bottom: row === 8 || !spotlit.has(index + 9),
    left: col === 0 || !spotlit.has(index - 1),
    right: col === 8 || !spotlit.has(index + 1),
  };
}

/** The focus cell itself, for the corner glyph. Null in the region form. */
export function spotlightFocusIndex(spotlight: Spotlight | null, now: number): number | null {
  const live = liveSpotlight(spotlight, now);
  if (!live?.focus || !isValidCoord(live.focus)) return null;
  return toIndex(live.focus);
}
