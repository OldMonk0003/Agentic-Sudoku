import { store } from '@/state/store';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import { refuseReplacement, storeGenerator, REFUSAL_MESSAGES, type PuzzleGenerator } from '../boardReplacement';
import type { Difficulty } from '@/state/types';
import type { ToolDescriptor } from '../types';

/**
 * `switch_difficulty` -- a fresh puzzle at a chosen level.
 *
 * THE ARCHITECTURAL POINT OF THIS FILE (research.md R1).
 *
 * This is the first tool that needs a GENERATED puzzle. Generation is
 * orchestrated by `requestPuzzle()` in `src/ui/puzzleLoader.ts`, which lives in
 * the UI layer because `Worker` is a browser API and the state layer must stay
 * DOM-free. `src/tools -> src/ui` is a LINT ERROR, not a convention:
 *
 *     Tools must not import UI. Tool handlers must not touch the DOM.
 *
 * So this tool does not call the generator. It RAISES A REQUEST on the agent
 * session store and waits for the game store to report the result. The UI is
 * subscribed and does the work. Neither layer imports the other, and the seam
 * already existed -- `requestDisconnect` runs in exactly this shape with the
 * arrow reversed.
 *
 * `load_technique_practice` never hit this wall because a drill is a bundled
 * constant it can dispatch straight into the store.
 *
 * FEATURE 005 REPEALED THE CONFIRMATION. This tool used to raise a prompt and
 * wait up to sixty seconds for a click whenever the board had progress on it
 * (002/FR-053, 003/FR-030). It no longer asks at all.
 *
 * What that bought: a hands-free session, and a call that no longer waits on a
 * human -- which NARROWS the 100 ms budget deviation recorded in 003 rather than
 * widening it. It still exceeds the budget, but only for generation.
 *
 * What it cost, stated where someone changing this file will read it: an agent
 * that misreads "this is too easy" as "replace this" now destroys the learner's
 * work with nothing asked, no undo -- a replaced board is not in the undo
 * history -- and no retained copy, since only one game is ever saved. The
 * explanation this tool requires is the learner's ONLY account of why their
 * board changed, which is why the narration contract was not relaxed with it.
 */

const NAME = 'switch_difficulty';

const LEVELS: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export function createSwitchDifficultyTool(
  options: { generator?: PuzzleGenerator } = {},
): ToolDescriptor {
  const generator = options.generator ?? storeGenerator;

  return defineWriteTool({
    name: NAME,
    description: [
      'Load a brand-new Sudoku puzzle at a chosen difficulty, replacing the one on screen.',
      ADDRESSING,
      'A new puzzle resets the clock to zero and clears the undo history, and every puzzle has exactly one',
      'solution. The board cannot be switched while it is paused.',
      'This DISCARDS whatever the human had done on the current board, and they are NOT asked first -- so',
      'only do it when they have asked you to, and say why.',
      'Requires explanation: one or two sentences saying why you are changing the difficulty, which the',
      'human sees.',
    ].join(' '),

    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        difficulty: { type: 'string', enum: [...LEVELS] },
      },
      required: ['difficulty'],
    },

    async run(input) {
      const difficulty = input.difficulty as Difficulty;

      // 003/FR-035, shared with restart_puzzle: permitted on a complete board --
      // there is no progress left to lose -- but not on a paused one.
      const refusal = refuseReplacement();
      if (refusal) {
        return { ok: false, code: 'wrong-status', message: REFUSAL_MESSAGES[refusal] };
      }

      const generated = await generator.generate(difficulty);
      if (!generated.ok) {
        // FR-036: the learner's board is exactly as it was.
        return {
          ok: false,
          code: 'generation-failed',
          message:
            'No puzzle passing this site\'s own uniqueness check could be produced, so the board is unchanged. You can try again.',
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
          outcome: 'loaded',
          // The DERIVED rating, from the techniques the puzzle actually
          // requires -- never the label it was asked for, echoed back on trust.
          difficulty: puzzle.difficulty,
          requested_difficulty: difficulty,
          clue_count: puzzle.clues.filter((clue) => clue !== null).length,
          techniques_required: [...puzzle.techniquesRequired],
          elapsed_ms: next.elapsedMs,
          undo_depth: next.history.length,
        },
      };
    },
  });
}

export const switchDifficulty: ToolDescriptor = createSwitchDifficultyTool();
