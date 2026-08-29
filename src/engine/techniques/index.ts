import { nakedSingle } from './nakedSingle';
import { hiddenSingle } from './hiddenSingle';
import { lockedCandidates } from './lockedCandidates';
import { nakedPair } from './nakedPair';
import { xWing } from './xWing';
import type { Technique } from './types';

/**
 * The technique registry, in increasing order of difficulty.
 *
 * Adding a technique means adding a module and one line here. No switch
 * statement anywhere grows (Principle III).
 *
 * Three bands exist because the product offers three difficulties and Principle
 * IV requires the rating to be DERIVED from techniques required. Two singles
 * alone can only ever rate 'easy'.
 */
export const TECHNIQUES: readonly Technique[] = [
  nakedSingle,     // easy
  hiddenSingle,    // easy
  lockedCandidates, // medium
  nakedPair,       // medium
  xWing,           // hard
];

export type {
  Technique,
  TechniqueFinding,
  PlacementFinding,
  EliminationFinding,
  TechniqueId,
  BoardView,
} from './types';
