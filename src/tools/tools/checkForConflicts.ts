import { store } from '@/state/store';
import { findConflictGroups } from '@/engine/conflicts';
import { toCoord } from '@/engine/grid';
import { validate } from '../validate';
import { failure, success, type JsonSchema, type ToolDescriptor, type ToolResult } from '../types';

/**
 * `check_for_conflicts` -- duplicates only, never correctness.
 *
 * Read-only, departing from the description's "Read + Write" classification by
 * the decision recorded in the spec's Assumptions: feature 001 already flags
 * conflicts continuously and automatically (001/FR-025, 001/FR-028), so there is
 * nothing here to write.
 *
 * It cannot report whether a digit is RIGHT, only whether it duplicates another.
 * That is structural, not restraint: the grouping comes from the Engine, whose
 * signature takes the visible board and nothing else.
 */

const NAME = 'check_for_conflicts';

const inputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
};

const description = [
  'List every cell involved in a duplicate digit within a row, column, or box, grouped so you can see',
  'which cells collide with which. Rows are numbered 1-9 top to bottom and columns 1-9 left to right.',
  'Returns an empty list when the board has no duplicates.',
  'This reports duplicates only -- it does not tell you whether a digit is correct, because the site',
  'never reveals the puzzle solution.',
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

  const values = store.getState().cells.map((cell) => cell.value);
  const groups = findConflictGroups(values);

  const conflicted = new Set<number>();
  for (const group of groups) for (const index of group.indices) conflicted.add(index);

  return success(NAME, {
    conflicts: groups.map((group) => ({
      unit: { type: group.kind, n: group.n },
      digit: group.digit,
      cells: group.indices.map(toCoord),
    })),
    conflicted_cell_count: conflicted.size,
  });
}

export const checkForConflicts: ToolDescriptor = {
  name: NAME,
  description,
  inputSchema,
  readOnly: true,
  execute,
};
