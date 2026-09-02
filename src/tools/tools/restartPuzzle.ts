import { store } from '@/state/store';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import {
  refuseReplacement, storeGenerator, REFUSAL_MESSAGES, type PuzzleGenerator,
} from '../boardReplacement';
import type { ToolDescriptor } from '../types';

/**
 * `restart_puzzle` -- a different grid at the level the board is already on.
 *
 * IT TAKES NO ARGUMENTS, and that is the design rather than an omission. The
 * difficulty comes from the board. An agent that had to supply it could supply
 * the wrong one, and then this would be `switch_difficulty` under another name --
 * which is exactly what the learner does not want when they say "give me a
 * different one, same level".
 *
 * "RESTART" MEANS A NEW PUZZLE, NOT THE SAME ONE CLEARED. Most games mean the
 * opposite by the word. The author asked for "a different game", and the
 * "different grid" guarantee itself lives in `puzzleLoader` rather than here, so
 * the learner's own controls get it too (005/research.md R2).
 *
 * NO CONFIRMATION (005/FR-020). Feature 005 repealed the prompt for every
 * agent-initiated replacement, so this tool never had one to remove. What that
 * costs is recorded in the spec: an agent that misreads "this is too easy" as
 * "replace this" destroys the work with nothing asked, no undo -- a replaced
 * board is not in the undo history -- and no retained copy. The narration below
 * is the learner's only account of why their board changed, which is why it is
 * mandatory rather than merely expected.
 */

const NAME = 'restart_puzzle';

export function createRestartPuzzleTool(
  options: { generator?: PuzzleGenerator } = {},
): ToolDescriptor {
  const generator = options.generator ?? storeGenerator;

  return defineWriteTool({
    name: NAME,
    description: [
      'Replace the board with a DIFFERENT Sudoku puzzle at the SAME difficulty it is already on.',
      ADDRESSING,
      'Use this when the human wants a fresh grid rather than a harder or easier one -- for example when',
      'they come back to a half-finished board they no longer want.',
      'It takes no difficulty argument on purpose: the level is read from the board, so the level after',
      'is the level before.',
      'The new puzzle is always a different grid, has exactly one solution, resets the clock to zero, and',
      'clears the undo history. The board cannot be restarted while it is paused.',
      "This discards whatever the human had done, and they are NOT asked first -- so only do it when",
      'they have asked you to, and say why.',
      'Requires explanation: one or two sentences saying why, which the human sees.',
    ].join(' '),

    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },

    async run() {
      const refusal = refuseReplacement();
      if (refusal) {
        return { ok: false, code: 'wrong-status', message: REFUSAL_MESSAGES[refusal] };
      }

      const difficulty = store.getState().puzzle?.difficulty;
      if (!difficulty) {
        return {
          ok: false,
          code: 'wrong-status',
          message: 'There is no puzzle on the board yet, so there is nothing to restart.',
        };
      }

      const generated = await generator.generate(difficulty);
      if (!generated.ok) {
        // 003/FR-036: the learner's board is exactly as it was.
        return {
          ok: false,
          code: 'generation-failed',
          message:
            "No puzzle passing this site's own uniqueness check could be produced, so the board is unchanged. You can try again.",
          details: { difficulty },
        };
      }

      const next = store.getState();
      const puzzle = next.puzzle;
      if (!puzzle) {
        return {
          ok: false,
          code: 'generation-failed',
          message: 'The board did not settle on a new puzzle, so nothing was changed.',
        };
      }

      return {
        ok: true,
        data: {
          outcome: 'restarted',
          // The DERIVED rating of what actually loaded, never the label asked for.
          difficulty: puzzle.difficulty,
          clue_count: puzzle.clues.filter((clue) => clue !== null).length,
          techniques_required: [...puzzle.techniquesRequired],
          elapsed_ms: next.elapsedMs,
          undo_depth: next.history.length,
        },
      };
    },
  });
}

export const restartPuzzle: ToolDescriptor = createRestartPuzzleTool();
