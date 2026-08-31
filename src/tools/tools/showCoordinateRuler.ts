import { preferencesStore, showRuler } from '@/state/preferences';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import type { ToolDescriptor } from '../types';

/**
 * `show_coordinate_ruler` -- number the grid so the human stops counting squares.
 *
 * This tool exists to reduce the HUMAN's effort, not the agent's. Naming a cell
 * on a board of 81 identical boxes means counting across and counting down every
 * single time, and miscounting is easy; with the guides up the learner reads a
 * coordinate straight off the board and says "row 4, column 7".
 *
 * Two properties separate it from every other mark the agent can make:
 *
 *   - It changes NO game data, so board status cannot bar it (FR-014). A learner
 *     who pauses to study the board is exactly who wants coordinates.
 *   - It DOES NOT EXPIRE. Every agent annotation self-destructs after sixty
 *     seconds so an abandoned session cannot deface the board (002/FR-033); the
 *     ruler is the single exemption, because a coordinate guide that vanishes
 *     mid-conversation defeats the purpose of having one (FR-012).
 *
 * The learner has their own toggle for it (FR-013), so neither actor's view of
 * the ruler is authoritative -- which is why this is idempotent rather than
 * failing when the ruler is already up.
 */

const NAME = 'show_coordinate_ruler';

export const showCoordinateRuler: ToolDescriptor = defineWriteTool({
  name: NAME,
  description: [
    'Show numbered guides around the Sudoku grid: the column numbers 1 to 9 across the top and the row',
    'numbers 1 to 9 down the left side.',
    ADDRESSING,
    'Use this so the human can read a cell’s coordinates straight off the board instead of counting',
    'squares — it makes it much easier for them to tell you which cell they mean.',
    'The guides stay until they are removed and change nothing about the puzzle: no digit, no candidate,',
    'no timer, and nothing to undo.',
    'Calling this when they are already showing is fine and simply does nothing.',
    'Requires explanation: one or two sentences saying why, which the human sees.',
  ].join(' '),

  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
    required: [],
  },

  async run() {
    const alreadyVisible = preferencesStore.getState().rulerVisible;
    preferencesStore.dispatch(showRuler());

    return {
      ok: true,
      data: {
        outcome: 'shown',
        // Told plainly, so an agent that has lost track can correct itself
        // without guessing (FR-011).
        already_visible: alreadyVisible,
      },
    };
  },
});
