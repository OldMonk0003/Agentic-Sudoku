import { store } from '@/state/store';
import { setCandidatesAt } from '@/state/actions';
import type { Digit } from '@/engine/grid';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import type { ErrorCode, ToolDescriptor } from '../types';

/**
 * `update_pencil_marks` -- prune or write candidates for named cells.
 *
 * ALL-OR-NOTHING by design (FR-039, FR-043). One explanation accompanied the
 * call, so a half-applied batch would be described on screen by text that no
 * longer matches the board. The state layer enforces it; this tool reports it.
 */

const NAME = 'update_pencil_marks';

const CODES: Record<string, ErrorCode> = {
  'cell-is-clue': 'cell-is-clue',
  'cell-not-empty': 'cell-not-empty',
  'out-of-range': 'out-of-range',
  'wrong-status': 'wrong-status',
};

const MESSAGES: Record<string, string> = {
  'cell-is-clue':
    'One of the cells you listed is a starting clue, which has no pencil marks. Nothing was changed.',
  'cell-not-empty':
    'One of the cells you listed already holds a digit, so it has no pencil marks. Nothing was changed.',
  'out-of-range': 'One of the coordinates you listed is not on the board. Rows and columns are 1-9.',
  'wrong-status': 'The board is paused or complete, so it cannot be changed right now.',
};

export const updatePencilMarks: ToolDescriptor = defineWriteTool({
  name: NAME,
  description: [
    'Set the pencil candidates of specific empty cells of the Sudoku board to exactly the digits you list.',
    ADDRESSING,
    'This replaces whatever was in those cells -- an empty digit list erases that cell\'s marks. No other',
    'cell is touched, and the whole call is a single undo step for the human.',
    'Cells holding a digit, and starting clues, are rejected: if any cell you list is invalid, NOTHING is',
    'changed, so you can retry the whole call after correcting it.',
    'Requires explanation: one or two sentences the human will see, saying why these digits and not others.',
  ].join(' '),

  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      cells: {
        type: 'array',
        minItems: 1,
        maxItems: 81,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            row: { type: 'integer', minimum: 1, maximum: 9 },
            col: { type: 'integer', minimum: 1, maximum: 9 },
            digits: {
              type: 'array',
              maxItems: 9,
              uniqueItems: true,
              items: { type: 'integer', minimum: 1, maximum: 9 },
            },
          },
          required: ['row', 'col', 'digits'],
        },
      },
    },
    required: ['cells'],
  },

  async run(input) {
    const cells = input.cells as { row: number; col: number; digits: number[] }[];

    const result = store.dispatch(
      setCandidatesAt(
        cells.map(({ row, col, digits }) => ({ coord: { row, col }, digits: digits as Digit[] })),
        'agent',
      ),
    );

    if (!result.ok) {
      return {
        ok: false,
        code: CODES[result.reason] ?? 'internal-error',
        message: MESSAGES[result.reason] ?? `The board refused: ${result.reason}.`,
        details: { cells: cells.length },
      };
    }

    return {
      ok: true,
      // Spotlit as a region rather than a crosshair when more than one cell
      // changed, and not at all above the threshold (003/FR-026, R3).
      changed: cells.map(({ row, col }) => ({ row, col })),
      data: { cells_updated: cells.length, undo_depth: store.getState().history.length },
    };
  },
});
