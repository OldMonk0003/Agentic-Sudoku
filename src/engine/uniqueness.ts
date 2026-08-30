import { countSolutions } from './solver';
import type { Digit } from './grid';

/**
 * "Does this puzzle have exactly one solution?" -- and nothing else.
 *
 * This exists so callers who need Principle IV's guarantee do not have to import
 * `solver.ts`, which also exports `solve()` -- the one function in the codebase
 * that returns a completed grid.
 *
 * The Tools layer is banned outright from importing the solver, and the ban is
 * at MODULE level on purpose: "import the module but only the safe export" is a
 * rule no lint rule enforces and no reviewer reliably checks. Giving the safe
 * question its own module means the Tools layer can ask it without ever being in
 * a position to leak an answer (002/FR-026, FR-058).
 *
 * It returns a BOOLEAN. There is no shape here that could carry a solution.
 */
export function hasUniqueSolution(clues: readonly (Digit | null)[]): boolean {
  return countSolutions(clues) === 1;
}
