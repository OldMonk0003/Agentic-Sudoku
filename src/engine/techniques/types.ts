import type { Coord, Digit } from '../grid';
import type { Difficulty } from '../types';

/**
 * One uniform interface per technique (Principle III: "each solving or hinting
 * technique MUST be its own Engine module with a uniform interface... No
 * monolithic solver switch statement.")
 *
 * A finding is either a PLACEMENT (this digit goes here) or an ELIMINATION
 * (this digit cannot go in these cells). Singles place; locked candidates,
 * naked pairs, and X-Wings eliminate. Both forms carry `because` -- the cells
 * that justify the deduction from the VISIBLE board alone, which is what makes
 * hints logically sound under Principle IV and what feature 002 will highlight.
 */

export type TechniqueId = string;

export interface BoardView {
  readonly values: readonly (Digit | null)[];
  readonly candidates: readonly ReadonlySet<Digit>[];
}

export interface PlacementFinding {
  readonly kind: 'placement';
  readonly technique: TechniqueId;
  readonly target: Coord;
  readonly digit: Digit;
  readonly because: readonly Coord[];
}

export interface EliminationFinding {
  readonly kind: 'elimination';
  readonly technique: TechniqueId;
  /** Cells losing candidates, and which digits they lose. */
  readonly eliminations: readonly { readonly target: Coord; readonly digits: readonly Digit[] }[];
  readonly because: readonly Coord[];
}

export type TechniqueFinding = PlacementFinding | EliminationFinding;

export interface Technique {
  readonly id: TechniqueId;
  readonly band: Difficulty;
  /** Pure. Returns the first finding, or null. NEVER consults a solution. */
  find(board: BoardView): TechniqueFinding | null;
}
