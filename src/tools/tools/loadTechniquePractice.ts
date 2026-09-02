import { store } from '@/state/store';
import { loadPuzzle } from '@/state/actions';
import { DRILLABLE_TECHNIQUES, drillFor } from '@/engine/drills';
import { hasUniqueSolution } from '@/engine/uniqueness';
import { parsePuzzleString, toPuzzleString } from '@/engine/puzzleString';
import { rateDifficulty } from '@/engine/rating';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import type { ToolDescriptor } from '../types';

/**
 * `load_technique_practice` -- a curated board that drills one technique.
 *
 * FEATURE 005 REPEALED ITS CONFIRMATION. This used to ask before replacing a
 * board with progress on it (002/FR-053) and wait up to a minute for the answer.
 * It no longer asks -- the drill prompt and the difficulty prompt were one
 * mechanism, and they went together.
 *
 * The cost is the same one recorded on `switch_difficulty`: an hour of the
 * learner's work can now be discarded with nothing asked, no undo, and no
 * retained copy. The required explanation is their only account of it.
 *
 * The drill is re-verified for uniqueness on the way in (Principle IV applies to
 * a bundled puzzle exactly as to a generated one) and its difficulty is
 * re-derived rather than stored, exactly as 001 does on restore.
 */

const NAME = 'load_technique_practice';

export function createDrillTool(): ToolDescriptor {
  return defineWriteTool({
    name: NAME,
    description: [
      'Replace the current Sudoku puzzle with a curated one that drills a specific technique.',
      ADDRESSING,
      "This DISCARDS the human's current board and they are NOT asked first, so only do it when they",
      'have asked you to, and say why.',
      `Drills are available for: ${DRILLABLE_TECHNIQUES.join(', ')}.`,
      'Every drill has exactly one solution and genuinely requires its technique -- it cannot be finished',
      'without it.',
    ].join(' '),

    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        technique: { type: 'string', enum: [...DRILLABLE_TECHNIQUES] },
      },
      required: ['technique'],
    },

    async run(input) {
      const technique = input.technique as string;
      const drill = drillFor(technique);

      if (!drill) {
        // FR-054: name what IS available, so the agent can correct itself in one
        // turn rather than guessing.
        return {
          ok: false,
          code: 'unknown-technique',
          message: `There is no practice drill for "${technique}". Available: ${DRILLABLE_TECHNIQUES.join(', ')}.`,
          details: { available: [...DRILLABLE_TECHNIQUES] },
        };
      }

      const clues = parsePuzzleString(drill.puzzleString);

      // A bundled puzzle earns no exemption from the uniqueness rule. Asked
      // through `hasUniqueSolution` rather than the solver, so this layer is
      // never in a position to hold a completed grid at all.
      if (!hasUniqueSolution(clues)) {
        return {
          ok: false,
          code: 'internal-error',
          message: 'That drill failed this site\'s own uniqueness check and was not loaded.',
        };
      }

      // Difficulty is DERIVED, never taken on trust from a stored label.
      const rating = rateDifficulty(clues);
      store.dispatch(
        loadPuzzle({
          clues,
          difficulty: rating.difficulty,
          puzzleString: toPuzzleString(clues),
          techniquesRequired: rating.techniquesRequired,
        }),
      );

      return {
        ok: true,
        data: {
          outcome: 'loaded',
          technique,
          difficulty: rating.difficulty,
        },
      };
    },
  });
}

export const loadTechniquePractice: ToolDescriptor = createDrillTool();
