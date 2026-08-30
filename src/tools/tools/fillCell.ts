import { store } from '@/state/store';
import { enterDigitAt } from '@/state/actions';
import { findConflicts } from '@/engine/conflicts';
import { toIndex, type Digit } from '@/engine/grid';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import type { ErrorCode, ToolDescriptor } from '../types';

/**
 * `fill_cell` -- the agent places one digit, and cannot do it silently.
 *
 * This is the tool that makes the product a tutor rather than an autosolver.
 * Three properties come free from feature 001 rather than being built here:
 *
 *   - It dispatches the SAME action a human keypress does, with a different
 *     `origin`, so one undo reverses it (FR-042).
 *   - It is coordinate-addressed, so the learner's selection never moves
 *     (FR-056) -- they may be mid-thought somewhere else.
 *   - The precondition is evaluated against the board AS IT STANDS at the moment
 *     of the call, because the store is the only source of truth (FR-046). An
 *     agent that read a stale board is rejected, not applied.
 *
 * The agent is ALLOWED TO BE WRONG. A digit that duplicates one in the same row,
 * column, or box is placed and flagged as a conflict by 001's existing rules
 * (FR-038) -- a tutor whose errors are invisible cannot be checked, and checking
 * the tutor is part of learning.
 */

const NAME = 'fill_cell';

/** The store's rejection reasons map one-for-one onto tool error codes. */
const CODES: Record<string, ErrorCode> = {
  'cell-is-clue': 'cell-is-clue',
  'cell-not-empty': 'cell-not-empty',
  'out-of-range': 'out-of-range',
  'wrong-status': 'wrong-status',
  'no-selection': 'invalid-input',
  'nothing-to-undo': 'nothing-to-undo',
  'unknown-action': 'internal-error',
};

const MESSAGES: Record<string, (row: number, col: number) => string> = {
  'cell-is-clue': (row, col) =>
    `Row ${row}, column ${col} is one of the puzzle's starting clues and cannot be changed.`,
  'cell-not-empty': (row, col) =>
    `Row ${row}, column ${col} already holds a digit. Only empty cells can be filled; the human can erase it if they want it changed.`,
  'out-of-range': (row, col) => `Row ${row}, column ${col} is not on the board. Rows and columns are 1-9.`,
  'wrong-status': () =>
    'The board is paused or complete, so it cannot be changed right now. Reading the board still works.',
};

export const fillCell: ToolDescriptor = defineWriteTool({
  name: NAME,
  description: [
    'Put one digit into one empty, non-clue cell of the Sudoku board.',
    ADDRESSING,
    'The cell must be empty and not a starting clue, and the board must not be paused or complete, or the',
    'call is rejected and nothing changes.',
    'You are allowed to be wrong: a digit that duplicates one in the same row, column, or box will be',
    'placed and flagged as a conflict, exactly as it would be for the human.',
    'The human can undo it with a single press of their Undo button, and your digit is marked as yours on',
    'the board. Their selected cell does not move.',
    'Requires explanation: one or two sentences saying why this digit goes here, which the human sees.',
  ].join(' '),

  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      row: { type: 'integer', minimum: 1, maximum: 9 },
      col: { type: 'integer', minimum: 1, maximum: 9 },
      digit: { type: 'integer', minimum: 1, maximum: 9 },
    },
    required: ['row', 'col', 'digit'],
  },

  async run(input) {
    const row = input.row as number;
    const col = input.col as number;
    const digit = input.digit as Digit;

    const result = store.dispatch(enterDigitAt({ row, col }, digit, 'agent'));

    if (!result.ok) {
      const message = MESSAGES[result.reason]?.(row, col) ?? `The board refused: ${result.reason}.`;
      return {
        ok: false,
        code: CODES[result.reason] ?? 'internal-error',
        message,
        details: { row, col, digit },
      };
    }

    const session = store.getState();
    const conflicts = findConflicts(session.cells.map((cell) => cell.value));

    return {
      ok: true,
      data: {
        row,
        col,
        digit,
        // Told plainly, so the agent can narrate its own mistake next turn.
        created_conflict: conflicts.has(toIndex({ row, col })),
        board_complete: session.status === 'complete',
        undo_depth: session.history.length,
      },
    };
  },
});
