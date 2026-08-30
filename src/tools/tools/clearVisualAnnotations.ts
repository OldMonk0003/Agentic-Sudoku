import { agentStore, clearAnnotations, visibleAnnotations, visibleToast } from '@/state/agentSession';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import type { ToolDescriptor } from '../types';

/**
 * `clear_visual_annotations` -- the agent wipes its own marks.
 *
 * ORDERING MATTERS, and it is the reason this tool needs a comment at all: it
 * clears annotations and the toast, and then its own explanation is published by
 * the wrapper. It does NOT clear the explanation queue -- otherwise this call
 * would erase its own narration the instant it made it (FR-031, FR-014).
 */

const NAME = 'clear_visual_annotations';

export const clearVisualAnnotations: ToolDescriptor = defineWriteTool({
  name: NAME,
  description: [
    'Remove every highlight, beam, and coaching note you have placed on the Sudoku board.',
    ADDRESSING,
    "The human's digits, pencil marks, timer, and undo history are untouched -- this clears only your own marks.",
  ].join(' '),

  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
    required: [],
  },

  async run() {
    const now = Date.now();
    const session = agentStore.getState();
    const cleared = visibleAnnotations(session, now).length;
    const hadToast = visibleToast(session, now) !== null;

    agentStore.dispatch(clearAnnotations());

    return { ok: true, data: { cleared_annotations: cleared, cleared_toast: hadToast } };
  },
});
