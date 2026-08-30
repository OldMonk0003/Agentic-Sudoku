import { agentStore, addAnnotations, ANNOTATION_TTL_MS, type AnnotationInput } from '@/state/agentSession';
import { defineWriteTool } from '../narration';
import { ADDRESSING, COORD_SCHEMA, toCoords } from '../coordinates';
import type { ToolDescriptor } from '../types';

/**
 * `highlight_pattern_cells` -- the agent points, and changes nothing.
 *
 * Two roles, because a deduction has two halves and a learner who cannot tell
 * them apart has been shown a decoration rather than an argument: `target` is
 * what the deduction concludes about, `because` is what forces it (FR-028).
 *
 * The marks are drawn as an OUTLINE and a HATCH -- forms the learner's own
 * wash-based highlighting never uses -- so they stay distinguishable from the
 * learner's own selection in greyscale and under any colour vision deficiency
 * (FR-032, FR-035).
 */

const NAME = 'highlight_pattern_cells';

export const highlightPatternCells: ToolDescriptor = defineWriteTool({
  name: NAME,
  description: [
    'Tint cells on the board to point the human at a pattern, without changing anything they have written.',
    ADDRESSING,
    'Use target_cells for the cells your deduction concludes about, and because_cells for the cells that',
    'justify it; the two are drawn differently so the human can tell them apart. Supply at least one of',
    'the two. Marks fade on their own after about a minute, and change no digit and no pencil mark.',
    'Requires explanation: one or two sentences the human will see, saying what you are pointing at and why.',
  ].join(' '),

  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      target_cells: { type: 'array', items: COORD_SCHEMA, maxItems: 81, uniqueItems: true },
      because_cells: { type: 'array', items: COORD_SCHEMA, maxItems: 81, uniqueItems: true },
    },
    required: [],
  },

  async run(input) {
    const targets = toCoords((input.target_cells as unknown[]) ?? []);
    const because = toCoords((input.because_cells as unknown[]) ?? []);

    // "At least one of two arrays is non-empty" is not expressible in the schema
    // subset without `anyOf`, so it is checked here and stated in the description.
    if (targets.length === 0 && because.length === 0) {
      return {
        ok: false,
        code: 'no-annotation-target',
        message:
          'Supply at least one cell in target_cells or because_cells; there is nothing to highlight otherwise.',
      };
    }

    const annotations: AnnotationInput[] = [];
    if (targets.length > 0) annotations.push({ kind: 'cell', role: 'target', cells: targets });
    if (because.length > 0) annotations.push({ kind: 'cell', role: 'because', cells: because });

    agentStore.dispatch(addAnnotations({ annotations, now: Date.now() }));

    return {
      ok: true,
      data: {
        target_cells: targets.length,
        because_cells: because.length,
        annotated_cells: targets.length + because.length,
        expires_in_ms: ANNOTATION_TTL_MS,
      },
    };
  },
});
