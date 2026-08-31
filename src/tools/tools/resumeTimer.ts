import { store } from '@/state/store';
import { resume } from '@/state/actions';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import type { ToolDescriptor } from '../types';

/**
 * `resume_timer` -- restart the clock and uncover the board.
 *
 * THE ONE TOOL EXEMPT FROM 002/FR-045 (003/FR-040).
 *
 * Every other agent change is rejected while the board is paused. A tool whose
 * only purpose is to LEAVE the paused state cannot be barred by the paused
 * state, or `pause_timer` becomes a one-way door the agent can walk through and
 * not back.
 *
 * NO CODE IMPLEMENTS THAT EXEMPTION, and that is deliberate rather than an
 * omission. The store's `resumeSession` already requires `status === 'paused'`,
 * and nothing in `defineWriteTool` gates on board status -- the status checks
 * live in each tool that needs one. So the exemption exists by construction. A
 * contract test pins it, so it cannot be closed by accident by someone adding a
 * blanket paused-board guard to the wrapper.
 */

const NAME = 'resume_timer';

export const resumeTimer: ToolDescriptor = defineWriteTool({
  name: NAME,
  description: [
    'Resume a paused game: the clock restarts from where it stopped and the board becomes playable',
    'again.',
    ADDRESSING,
    'This is the one tool that works while the board is paused -- every other tool that changes the board',
    'is refused until the game is running again.',
    'This changes no digit, no candidate, and nothing that can be undone.',
    'Requires explanation: one or two sentences, which the human sees.',
  ].join(' '),

  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
    required: [],
  },

  async run() {
    const before = store.getState();
    const result = store.dispatch(resume());

    if (!result.ok) {
      const state =
        before.status === 'playing'
          ? 'The board is not paused -- it is already running.'
          : before.status === 'complete'
            ? 'The board is complete, so there is no clock to restart.'
            : 'A puzzle is still being generated, so there is nothing to resume yet.';

      return {
        ok: false,
        code: 'wrong-status',
        message: `${state} Resuming only works on a board that is currently paused.`,
        details: { status: before.status },
      };
    }

    return {
      ok: true,
      data: { outcome: 'resumed', elapsed_ms: store.getState().elapsedMs },
    };
  },
});
