import { ALL_INDICES, peersOf, toCoord, type Coord } from '../grid';
import type { Technique, TechniqueFinding } from './types';

/**
 * Naked single: a cell with exactly one remaining candidate.
 *
 * The justification is every peer that eliminated one of the other eight digits.
 */
export const nakedSingle: Technique = {
  id: 'naked-single',
  band: 'easy',

  find(board): TechniqueFinding | null {
    for (const index of ALL_INDICES) {
      if (board.values[index] !== null) continue;

      const candidates = board.candidates[index]!;
      if (candidates.size !== 1) continue;

      const digit = [...candidates][0]!;
      const because: Coord[] = [];
      for (const peer of peersOf(index)) {
        if (board.values[peer] !== null) because.push(toCoord(peer));
      }

      return { kind: 'placement', technique: 'naked-single', target: toCoord(index), digit, because };
    }
    return null;
  },
};
