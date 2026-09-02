import { store } from '@/state/store';
import { undo } from '@/state/actions';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import { toCoord } from '@/engine/grid';
import type { Coord } from '@/engine/grid';
import type { ToolDescriptor } from '../types';

/**
 * `undo_move` -- take back the last change, exactly as the learner's button does.
 *
 * TWO STATUS RULES THAT POINT OPPOSITE WAYS, and getting either backwards makes
 * the tool wrong in a way no other test would catch:
 *
 *   COMPLETE -> ALLOWED. `undoLast` carries no status guard and deliberately
 *   returns a finished board to `playing`; the learner's Undo button is disabled
 *   only by an empty history. 005/FR-012 requires this tool to produce "exactly
 *   the result the learner's own control produces", so refusing here would break
 *   the one promise the tool makes.
 *
 *   PAUSED -> REJECTED, and THIS FILE MUST ENFORCE IT. 002/FR-045 bars every
 *   agent change on a paused board. But `undoLast` does not check status, and
 *   `defineWriteTool` deliberately does not gate on status either -- that is
 *   precisely what keeps `resume_timer` able to leave the paused state. So
 *   nothing upstream will refuse this call. The guard below is the only one.
 *
 * THE RECORD IS READ BEFORE THE DISPATCH. Afterwards it is gone from history and
 * there is nothing left to report, so `undone_origin` would be unanswerable
 * (005/FR-016).
 *
 * IT MAY REVERSE THE LEARNER'S OWN WORK, and there is no redo. Three things
 * bound that rather than prevent it: the change is narrated on screen, the result
 * names whose work it was, and the learner can disconnect the agent at any
 * moment. Restricting the agent to its own changes was considered and rejected --
 * "undo" would then mean something other than what the button does.
 */

const NAME = 'undo_move';

export const undoMove: ToolDescriptor = defineWriteTool({
  name: NAME,
  description: [
    "Take back the most recent change to the Sudoku board -- exactly what the human's own Undo button",
    'does, and reversible by them in the same way.',
    ADDRESSING,
    'It always takes back the LAST change, whoever made it: yours or theirs. The result tells you which,',
    'so you can say what you just took back.',
    'A change that touched several cells at once, such as filling every pencil mark, is taken back',
    'whole in a single step.',
    'There is nothing to undo on a board where nothing has been changed yet, and the call is refused',
    'while the board is paused. There is no redo, so a change you take back is gone.',
    'Requires explanation: one or two sentences saying why you are taking this back, which the human',
    'sees.',
  ].join(' '),

  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
    required: [],
  },

  async run() {
    const before = store.getState();

    // 002/FR-045. Nothing upstream enforces this -- see the header.
    if (before.status === 'paused') {
      return {
        ok: false,
        code: 'wrong-status',
        message:
          'The board is paused, so it cannot be changed right now. Resume it first, or read the board instead.',
        details: { status: before.status },
      };
    }

    // Read the record BEFORE dispatching: afterwards it is gone from history.
    const record = before.history.at(-1);
    if (!record) {
      return {
        ok: false,
        code: 'nothing-to-undo',
        message:
          'There is nothing to undo -- no changes have been made to this board yet. A board that was just started or restarted is always in this state.',
      };
    }

    // The `after` side is what the change WROTE, so its origin is the actor who
    // made it. No field is added to the record: a second copy of the author
    // could disagree with the cells it describes.
    const origin = record.after[0]?.cell.origin ?? 'player';
    const restored: readonly Coord[] = record.before.map(({ index }) => toCoord(index));

    const result = store.dispatch(undo());
    if (!result.ok) {
      return {
        ok: false,
        code: result.reason === 'nothing-to-undo' ? 'nothing-to-undo' : 'internal-error',
        message: `The board refused to undo: ${result.reason}.`,
      };
    }

    const after = store.getState();

    return {
      ok: true,
      // The wrapper spotlights these, so the learner sees WHERE the board
      // stepped back. A many-celled reversal raises no spotlight -- 21 cells of
      // dashes would obscure the board rather than point at it.
      changed: restored,
      data: {
        outcome: 'undone',
        undone_origin: origin,
        undone_action: record.action,
        cells_restored: record.before.length,
        undo_depth: after.history.length,
        board_complete: after.status === 'complete',
      },
    };
  },
});
