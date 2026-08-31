import { store } from '@/state/store';
import { pause } from '@/state/actions';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import type { ToolDescriptor } from '../types';

/**
 * `pause_timer` -- stop the clock and cover the board.
 *
 * THE ONE PLACE IN THIS FEATURE WHERE AN AGENT ACTION OBSCURES THE BOARD, and
 * therefore the one worth arguing about. It sits closest of anything here to
 * Principle V's ban on blocking feedback and 002/FR-056's "no agent action may
 * prevent the learner from playing", and it is accepted on exactly one ground:
 * the learner's own Resume control is always present, never agent-dependent, and
 * one click away (FR-043).
 *
 * The overlay must genuinely obscure the board, or the clock could be stopped
 * while solving continues -- that is 001/FR-035, and it is why the overlay
 * exists. A pause tool that did not obscure would be a different, dishonest
 * feature.
 *
 * The agent gains no power the learner lacks: their own Pause button does
 * precisely this.
 *
 * Recorded as a deviation in plan.md § Complexity Tracking, so a reviewer can
 * object to it by name.
 */

const NAME = 'pause_timer';

export const pauseTimer: ToolDescriptor = defineWriteTool({
  name: NAME,
  description: [
    'Pause the game: the elapsed-time clock stops and the board is covered, exactly as it is when the',
    'human presses their own Pause button.',
    ADDRESSING,
    'The human can resume at any moment with their own Resume control, and you can resume with',
    '"resume_timer".',
    'While the board is paused, every other tool that changes it is refused; reading the board still',
    'works.',
    'This changes no digit, no candidate, and nothing that can be undone.',
    'Requires explanation: one or two sentences saying why you are pausing, which the human sees.',
  ].join(' '),

  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
    required: [],
  },

  async run() {
    const before = store.getState();
    const result = store.dispatch(pause());

    if (!result.ok) {
      // FR-041: name the ACTUAL state, so the agent can correct itself in one
      // turn rather than guessing why it was refused.
      const state =
        before.status === 'paused'
          ? 'The board is already paused.'
          : before.status === 'complete'
            ? 'The board is complete, so there is no clock left to stop.'
            : 'A puzzle is still being generated, so there is no clock running yet.';

      return {
        ok: false,
        code: 'wrong-status',
        message: `${state} Pausing only works on a board that is currently running.`,
        details: { status: before.status },
      };
    }

    return {
      ok: true,
      data: { outcome: 'paused', elapsed_ms: store.getState().elapsedMs },
    };
  },
});
