import { preferencesStore, hideRuler } from '@/state/preferences';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import type { ToolDescriptor } from '../types';

/**
 * `hide_coordinate_ruler` -- take the numbered guides away again.
 *
 * The counterpart to `show_coordinate_ruler`, and idempotent for the same
 * reason: the learner has their own toggle (FR-013), so they may have already
 * hidden a ruler the agent put up. Neither actor's view of the ruler is
 * authoritative over the other's, and an agent that has lost track must not be
 * tripped by the mismatch (FR-011).
 */

const NAME = 'hide_coordinate_ruler';

export const hideCoordinateRuler: ToolDescriptor = defineWriteTool({
  name: NAME,
  description: [
    'Remove the numbered row and column guides from around the Sudoku grid.',
    ADDRESSING,
    'This changes nothing about the puzzle itself — no digit, no candidate, no timer, and nothing to undo.',
    'Calling this when the guides are not showing is fine and simply does nothing.',
    'Requires explanation: one or two sentences saying why, which the human sees.',
  ].join(' '),

  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
    required: [],
  },

  async run() {
    const alreadyHidden = !preferencesStore.getState().rulerVisible;
    preferencesStore.dispatch(hideRuler());

    return {
      ok: true,
      data: { outcome: 'hidden', already_hidden: alreadyHidden },
    };
  },
});
