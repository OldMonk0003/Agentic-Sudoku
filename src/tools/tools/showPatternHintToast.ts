import { agentStore, showToast, TOAST_TTL_MS } from '@/state/agentSession';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import type { ToolDescriptor } from '../types';

/**
 * `show_pattern_hint_toast` -- a short coaching note beside the board.
 *
 * The one tool where the narration text IS the payload rather than an
 * accompaniment. It keeps the property name `explanation` so the write contract
 * stays uniform -- one property, one length rule, one enforcement point -- and
 * declares `narration: 'self'` so the wrapper does not ALSO queue a popup
 * saying the same words twice.
 */

const NAME = 'show_pattern_hint_toast';

export const showPatternHintToast: ToolDescriptor = defineWriteTool({
  name: NAME,
  narration: 'self',
  description: [
    'Show the human a short coaching note near the Sudoku board.',
    ADDRESSING,
    'It disappears after five seconds, or sooner if they dismiss it. It never takes their keyboard focus',
    'and never stops them playing.',
    'The explanation you supply IS the note the human reads, so write it to them, not about them.',
  ].join(' '),

  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
    required: [],
  },

  async run(input) {
    agentStore.dispatch(showToast({ text: input.explanation, now: Date.now() }));
    return { ok: true, data: { expires_in_ms: TOAST_TTL_MS } };
  },
});
