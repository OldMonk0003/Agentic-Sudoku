import { store } from '@/state/store';
import { toCoord } from '@/engine/grid';
import { validate } from '../validate';
import { failure, success, type JsonSchema, type ToolDescriptor, type ToolResult } from '../types';

/**
 * `get_board_state` -- the agent's eyes.
 *
 * A thin adapter: it reads the store and serialises. No game rules live here
 * (Principle III), and no solution can: nothing above the Engine can express one
 * (FR-026, FR-058), so there is nothing to leak.
 */

const NAME = 'get_board_state';

const inputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
};

const description = [
  'Read the current Sudoku board.',
  'Rows are numbered 1-9 top to bottom, columns 1-9 left to right, and boxes 1-9 in reading order.',
  "Returns all 81 cells with their digit (or null if empty), who put it there ('clue' for the puzzle's",
  "starting digits, 'player' for the human, 'agent' for you), and the pencil candidates written in that",
  'cell. Also returns the difficulty, elapsed time, and whether the board is playing, paused, or complete.',
  'The puzzle solution is not available through any tool -- reason from the visible board, as the human does.',
].join(' ');

async function execute(input: unknown): Promise<ToolResult> {
  const validation = validate(inputSchema, input);
  if (!validation.ok) {
    const unexpected = validation.violations.find((v) => v.message.includes('not a recognised argument'));
    return failure(
      NAME,
      unexpected ? 'unexpected-argument' : 'invalid-input',
      unexpected?.message ?? validation.violations[0]!.message,
      { violations: validation.violations },
    );
  }

  const session = store.getState();

  const cells = session.cells.map((cell, index) => {
    const { row, col } = toCoord(index);
    return {
      row,
      col,
      value: cell.value,
      // 'empty' is not an origin: an empty cell has no author. Reporting the
      // stored origin of an empty cell would be noise the agent has to ignore.
      origin: cell.value === null ? null : cell.origin,
      candidates: [...cell.candidates].sort((a, b) => a - b),
    };
  });

  return success(NAME, {
    cells,
    difficulty: session.puzzle?.difficulty ?? null,
    status: session.status,
    elapsed_ms: session.elapsedMs,
    empty_count: cells.filter((cell) => cell.value === null).length,
    is_complete: session.status === 'complete',
  });
}

export const getBoardState: ToolDescriptor = {
  name: NAME,
  description,
  inputSchema,
  readOnly: true,
  execute,
};
