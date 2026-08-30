import { describe, it, expect } from 'vitest';
import { validate } from '@/tools/validate';
import type { JsonSchema } from '@/tools/types';

/**
 * The schema interpreter (research.md R5).
 *
 * It validates against the SAME `inputSchema` object handed to the browser, so
 * there is no second source of truth to drift. FR-003 and SC-012 require
 * unrecognised arguments to be REJECTED rather than ignored, and we cannot
 * assume the host validated anything.
 */

const coord: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    row: { type: 'integer', minimum: 1, maximum: 9 },
    col: { type: 'integer', minimum: 1, maximum: 9 },
  },
  required: ['row', 'col'],
};

const fillCell: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    row: { type: 'integer', minimum: 1, maximum: 9 },
    col: { type: 'integer', minimum: 1, maximum: 9 },
    digit: { type: 'integer', minimum: 1, maximum: 9 },
    explanation: { type: 'string', minLength: 20, maxLength: 240 },
  },
  required: ['row', 'col', 'digit', 'explanation'],
};

const ok = (schema: JsonSchema, value: unknown) => validate(schema, value).ok;
const violations = (schema: JsonSchema, value: unknown) => {
  const result = validate(schema, value);
  return result.ok ? [] : result.violations;
};

describe('schema validation', () => {
  const good = { row: 4, col: 5, digit: 7, explanation: 'x'.repeat(30) };

  it('accepts a fully valid input', () => {
    expect(ok(fillCell, good)).toBe(true);
  });

  it('rejects a missing required property, naming it', () => {
    const withoutRow: Record<string, unknown> = { ...good };
    delete withoutRow.row;
    expect(ok(fillCell, withoutRow)).toBe(false);
    expect(violations(fillCell, withoutRow)[0]!.message).toMatch(/required/i);
    expect(violations(fillCell, withoutRow)[0]!.path).toBe('row');
  });

  it('REJECTS an unrecognised property rather than ignoring it (FR-003)', () => {
    const result = validate(fillCell, { ...good, sneaky: 1 });
    expect(result.ok).toBe(false);
    expect(violations(fillCell, { ...good, sneaky: 1 })[0]!.path).toBe('sneaky');
  });

  it('rejects a non-object at the root', () => {
    for (const value of [null, undefined, 'string', 42, [], true]) {
      expect(ok(fillCell, value), `${String(value)} should be rejected`).toBe(false);
    }
  });

  it('rejects wrong primitive types', () => {
    expect(ok(fillCell, { ...good, row: '4' })).toBe(false);
    expect(ok(fillCell, { ...good, digit: null })).toBe(false);
    expect(ok(fillCell, { ...good, explanation: 30 })).toBe(false);
  });

  it('rejects a non-integer where an integer is required', () => {
    expect(ok(fillCell, { ...good, row: 4.5 })).toBe(false);
    expect(ok(fillCell, { ...good, row: NaN })).toBe(false);
    expect(ok(fillCell, { ...good, row: Infinity })).toBe(false);
  });

  it('enforces integer bounds at both ends', () => {
    expect(ok(fillCell, { ...good, row: 0 })).toBe(false);
    expect(ok(fillCell, { ...good, row: 10 })).toBe(false);
    expect(ok(fillCell, { ...good, row: 1 })).toBe(true);
    expect(ok(fillCell, { ...good, row: 9 })).toBe(true);
  });

  it('enforces string length at both ends', () => {
    expect(ok(fillCell, { ...good, explanation: 'x'.repeat(19) })).toBe(false);
    expect(ok(fillCell, { ...good, explanation: 'x'.repeat(20) })).toBe(true);
    expect(ok(fillCell, { ...good, explanation: 'x'.repeat(240) })).toBe(true);
    expect(ok(fillCell, { ...good, explanation: 'x'.repeat(241) })).toBe(false);
  });

  it('enforces enum membership', () => {
    const schema: JsonSchema = {
      type: 'object',
      additionalProperties: false,
      properties: { unit_type: { type: 'string', enum: ['row', 'col', 'box'] } },
      required: ['unit_type'],
    };
    expect(ok(schema, { unit_type: 'row' })).toBe(true);
    expect(ok(schema, { unit_type: 'diagonal' })).toBe(false);
  });

  it('enforces array bounds, item schemas, and uniqueness', () => {
    const schema: JsonSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        cells: { type: 'array', minItems: 1, maxItems: 3, uniqueItems: true, items: coord },
      },
      required: ['cells'],
    };

    expect(ok(schema, { cells: [{ row: 1, col: 1 }] })).toBe(true);
    expect(ok(schema, { cells: [] })).toBe(false);
    expect(ok(schema, { cells: [1, 2, 3, 4].map(() => ({ row: 1, col: 1 })) })).toBe(false);
    expect(ok(schema, { cells: [{ row: 1, col: 1 }, { row: 1, col: 1 }] })).toBe(false);
    expect(ok(schema, { cells: [{ row: 1, col: 12 }] })).toBe(false);
    expect(ok(schema, { cells: [{ row: 1 }] })).toBe(false);
    expect(ok(schema, { cells: 'not an array' })).toBe(false);
  });

  it('validates nested objects and reports a dotted path', () => {
    const schema: JsonSchema = {
      type: 'object',
      additionalProperties: false,
      properties: { cells: { type: 'array', items: coord } },
      required: ['cells'],
    };
    const found = violations(schema, { cells: [{ row: 1, col: 99 }] });
    expect(found[0]!.path).toBe('cells.0.col');
  });

  it('reports every violation, not merely the first', () => {
    const found = violations(fillCell, { row: 0, col: 99, digit: 'x', explanation: '' });
    expect(found.length).toBeGreaterThanOrEqual(4);
  });

  it('is not fooled by prototype pollution attempts', () => {
    const hostile = JSON.parse('{"row":4,"col":5,"digit":7,"__proto__":{"polluted":true}}');
    hostile.explanation = 'x'.repeat(30);
    // `__proto__` from JSON.parse is an own property, and it is not in the schema.
    expect(ok(fillCell, hostile)).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('accepts booleans only where declared', () => {
    const schema: JsonSchema = {
      type: 'object',
      additionalProperties: false,
      properties: { acknowledges: { type: 'boolean' } },
    };
    expect(ok(schema, { acknowledges: true })).toBe(true);
    expect(ok(schema, { acknowledges: 'true' })).toBe(false);
    expect(ok(schema, {})).toBe(true); // not required
  });

  it('accepts an empty object against an empty schema, and rejects any argument', () => {
    const schema: JsonSchema = { type: 'object', additionalProperties: false, properties: {} };
    expect(ok(schema, {})).toBe(true);
    expect(ok(schema, { anything: 1 })).toBe(false);
  });
});
