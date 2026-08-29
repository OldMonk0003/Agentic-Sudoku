import type { Digit } from './grid';
import type { TechniqueId } from './techniques/types';

/**
 * Engine-owned domain types.
 *
 * These live here, not in the State layer, because the Engine PRODUCES them.
 * State consumes and re-exports them. The import-direction lint caught this the
 * moment it was the other way round -- exactly what Principle III's enforcement
 * is for.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Puzzle {
  readonly clues: readonly (Digit | null)[];
  /** OUR technique-derived rating, never the generator's label (Principle IV). */
  readonly difficulty: Difficulty;
  /** 81 chars, '-' for empty. The reproducibility record (Principle IV). */
  readonly puzzleString: string;
  readonly techniquesRequired: readonly TechniqueId[];
}
