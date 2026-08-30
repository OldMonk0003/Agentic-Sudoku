import { isValidCoord, type Coord } from '@/engine/grid';
import type { JsonSchema } from './types';

/**
 * The one coordinate convention the whole tool surface speaks (FR-007).
 *
 * Rows 1-9 top to bottom, columns 1-9 left to right, boxes 1-9 in reading order
 * -- stated in every tool description and never varied between tools. Defining
 * the schema fragment once is what makes "never varied" structural instead of
 * editorial.
 */

export const COORD_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    row: { type: 'integer', minimum: 1, maximum: 9 },
    col: { type: 'integer', minimum: 1, maximum: 9 },
  },
  required: ['row', 'col'],
};

/** The sentence every tool description carries, so an agent never has to infer it. */
export const ADDRESSING =
  'Rows are numbered 1-9 top to bottom, columns 1-9 left to right, and boxes 1-9 in reading order.';

/**
 * Narrow already-schema-validated input to `Coord`.
 *
 * The schema has enforced the bounds; this re-checks them anyway, because the
 * Engine's own guard is cheap and the cost of trusting a validator by accident
 * is an out-of-range index reaching the store.
 */
export function toCoords(values: readonly unknown[]): readonly Coord[] {
  return values
    .map((value) => value as Coord)
    .filter((coord) => isValidCoord(coord))
    .map(({ row, col }) => ({ row, col }));
}
