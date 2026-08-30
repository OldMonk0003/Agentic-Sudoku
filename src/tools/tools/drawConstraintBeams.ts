import { agentStore, addAnnotations, ANNOTATION_TTL_MS, type AnnotationInput } from '@/state/agentSession';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import type { Digit } from '@/engine/grid';
import type { ToolDescriptor } from '../types';

/**
 * `draw_constraint_beams` -- show the constraint instead of describing it.
 *
 * Elimination reasoning is the hardest thing to convey in words and the easiest
 * to convey with a line, which is the whole argument for this tool.
 *
 * Beams are LINES where the learner's own highlighting is FILLS. That is what
 * keeps them distinguishable from the crosshair (FR-032) and what keeps two
 * crossing beams individually readable (FR-029): a row beam runs horizontally
 * and a column beam vertically, so they remain separable by direction rather
 * than by colour -- which means the distinction survives greyscale.
 */

const NAME = 'draw_constraint_beams';

export const drawConstraintBeams: ToolDescriptor = defineWriteTool({
  name: NAME,
  description: [
    'Cast a visible ray along a whole row, column, or box of the Sudoku board to show a constraint --',
    'for example, the row that already contains a 6 and therefore rules a 6 out elsewhere.',
    ADDRESSING,
    'Beams are drawn as lines, which keeps them distinct from the human\'s own square highlighting, and',
    'several beams stay individually readable where they cross. Optionally name the digit a beam is',
    'about. Beams fade on their own after about a minute and change nothing on the board.',
    'Requires explanation: one or two sentences the human will see, saying what the beams rule out.',
  ].join(' '),

  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      beams: {
        type: 'array',
        minItems: 1,
        maxItems: 9,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            unit_type: { type: 'string', enum: ['row', 'col', 'box'] },
            unit_number: { type: 'integer', minimum: 1, maximum: 9 },
            digit: { type: 'integer', minimum: 1, maximum: 9 },
          },
          required: ['unit_type', 'unit_number'],
        },
      },
    },
    required: ['beams'],
  },

  async run(input) {
    const beams = input.beams as { unit_type: 'row' | 'col' | 'box'; unit_number: number; digit?: number }[];

    const annotations: AnnotationInput[] = beams.map((beam) => ({
      kind: 'beam',
      unit: { type: beam.unit_type, n: beam.unit_number },
      digit: (beam.digit ?? null) as Digit | null,
    }));

    agentStore.dispatch(addAnnotations({ annotations, now: Date.now() }));

    return { ok: true, data: { beams_drawn: beams.length, expires_in_ms: ANNOTATION_TTL_MS } };
  },
});
