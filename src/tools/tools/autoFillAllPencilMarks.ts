import { store } from '@/state/store';
import { fillAllCandidates } from '@/state/actions';
import { handWrittenCandidateCount } from '@/state/edits';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import type { ToolDescriptor } from '../types';

/**
 * `auto_fill_all_pencil_marks` -- the bookkeeping, done in one narrated step.
 *
 * THE ACKNOWLEDGEMENT FLAG, and why it exists.
 *
 * FR-041 requires that when this replaces candidates the learner wrote by hand,
 * "the explanation MUST say so". Text cannot be checked for meaning -- but
 * CONSENT can be checked for presence. So when any hand-written mark would be
 * overwritten and `acknowledges_replacing_marks` is absent, the call is rejected
 * with a message telling the agent to admit it in the explanation.
 *
 * That turns an unenforceable requirement into a mechanical one. It is the same
 * move as the narration wrapper: make the guarantee structural rather than
 * hoping nine implementations are polite.
 *
 * The candidates themselves come from the Engine's legal-candidate computation
 * over the VISIBLE board, so this is wrong in exactly the ways the learner's own
 * pencilling would be wrong and reveals nothing about the solution (FR-026).
 */

const NAME = 'auto_fill_all_pencil_marks';

export const autoFillAllPencilMarks: ToolDescriptor = defineWriteTool({
  name: NAME,
  description: [
    'Fill every empty cell of the Sudoku board with exactly the digits that are still legal there, given',
    'the board as it stands.',
    ADDRESSING,
    'Cells that already hold a digit are not touched. This is one undo step for the human.',
    'If the human has written their own pencil marks, this replaces them -- in that case you must pass',
    'acknowledges_replacing_marks: true AND say so in your explanation, or the call is rejected.',
    'The candidates are worked out from the visible board only, exactly as the human would work them out.',
  ].join(' '),

  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      acknowledges_replacing_marks: { type: 'boolean' },
    },
    required: [],
  },

  async run(input) {
    const acknowledged = input.acknowledges_replacing_marks === true;
    const handWritten = handWrittenCandidateCount(store.getState());

    if (handWritten > 0 && !acknowledged) {
      return {
        ok: false,
        code: 'acknowledgement-required',
        message:
          `The human has pencil marks of their own in ${handWritten} cell${handWritten === 1 ? '' : 's'}, and this would replace them. ` +
          'Retry with acknowledges_replacing_marks: true, and say in your explanation that you are replacing their marks.',
        details: { hand_written_cells: handWritten },
      };
    }

    const result = store.dispatch(fillAllCandidates('agent'));
    if (!result.ok) {
      return {
        ok: false,
        code: result.reason === 'wrong-status' ? 'wrong-status' : 'internal-error',
        message:
          result.reason === 'wrong-status'
            ? 'The board is paused or complete, so it cannot be changed right now.'
            : `The board refused: ${result.reason}.`,
      };
    }

    const session = store.getState();
    const filled = session.cells.filter(
      (cell) => cell.value === null && cell.candidates.size > 0,
    ).length;

    return {
      ok: true,
      /*
        No `changed` at all, and that is the design rather than an omission.

        This tool writes into EVERY empty cell. `makeSpotlight` would refuse
        anything over nine cells anyway (003/R3), but saying nothing here states
        the intent at the call site: sixty spotlit cells convey nothing, obscure
        the board, and are the opposite of "see where the change happened
        without searching for it". FR-026 asks for EXTENT, and for a whole-board
        write the honest conveyance is the explanation -- which FR-041 already
        requires to say what it replaced.
      */
      data: {
        cells_filled: filled,
        hand_written_marks_replaced: handWritten,
        undo_depth: session.history.length,
      },
    };
  },
});
