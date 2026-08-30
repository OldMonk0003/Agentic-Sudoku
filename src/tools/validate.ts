import type { JsonSchema } from './types';

/**
 * A JSON Schema interpreter for the subset this tool surface uses.
 *
 * It validates against the SAME `inputSchema` object handed to the browser
 * (research.md R5). That is the entire point: hand-written type guards beside a
 * hand-written schema drift, and the drift is the worst failure available at the
 * agent boundary -- a tool that advertises one contract and enforces another,
 * where no human is watching. One object, no drift.
 *
 * We validate rather than trusting the host, because FR-003 and SC-012 require
 * unrecognised arguments to be REJECTED rather than ignored and "the browser
 * probably checked" is not a defence.
 *
 * Supported: object (properties, required, additionalProperties: false),
 * string (minLength, maxLength, enum), integer (minimum, maximum), boolean,
 * array (items, minItems, maxItems, uniqueItems). Nothing else, deliberately --
 * a keyword we do not implement is a keyword no schema here may use.
 */

export interface Violation {
  /** Dotted path to the offending value, e.g. `cells.0.col`. Empty at the root. */
  readonly path: string;
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly value: Record<string, unknown> }
  | { readonly ok: false; readonly violations: readonly Violation[] };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function join(path: string, key: string | number): string {
  return path === '' ? String(key) : `${path}.${key}`;
}

function check(schema: JsonSchema, value: unknown, path: string, out: Violation[]): void {
  switch (schema.type) {
    case 'object': {
      if (!isPlainObject(value)) {
        out.push({ path, message: `expected an object, received ${describe(value)}` });
        return;
      }

      for (const key of schema.required ?? []) {
        if (!Object.hasOwn(value, key)) {
          out.push({ path: join(path, key), message: `"${key}" is required` });
        }
      }

      const known = schema.properties ?? {};
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!Object.hasOwn(known, key)) {
            out.push({
              path: join(path, key),
              message: `"${key}" is not a recognised argument; permitted: ${Object.keys(known).join(', ') || 'none'}`,
            });
          }
        }
      }

      for (const [key, propertySchema] of Object.entries(known)) {
        if (!Object.hasOwn(value, key)) continue;
        check(propertySchema, value[key], join(path, key), out);
      }
      return;
    }

    case 'array': {
      if (!Array.isArray(value)) {
        out.push({ path, message: `expected an array, received ${describe(value)}` });
        return;
      }
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        out.push({ path, message: `expected at least ${schema.minItems} item(s), received ${value.length}` });
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        out.push({ path, message: `expected at most ${schema.maxItems} item(s), received ${value.length}` });
      }
      if (schema.uniqueItems === true) {
        const seen = new Set(value.map((item) => JSON.stringify(item)));
        if (seen.size !== value.length) out.push({ path, message: 'items must be unique' });
      }
      if (schema.items) {
        value.forEach((item, index) => check(schema.items!, item, join(path, index), out));
      }
      return;
    }

    case 'string': {
      if (typeof value !== 'string') {
        out.push({ path, message: `expected a string, received ${describe(value)}` });
        return;
      }
      if (schema.enum && !schema.enum.includes(value)) {
        out.push({ path, message: `expected one of: ${schema.enum.join(', ')}; received "${value}"` });
      }
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        out.push({ path, message: `expected at least ${schema.minLength} characters, received ${value.length}` });
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        out.push({ path, message: `expected at most ${schema.maxLength} characters, received ${value.length}` });
      }
      return;
    }

    case 'integer': {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        out.push({ path, message: `expected an integer, received ${describe(value)}` });
        return;
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        out.push({ path, message: `expected at least ${schema.minimum}, received ${value}` });
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        out.push({ path, message: `expected at most ${schema.maximum}, received ${value}` });
      }
      return;
    }

    case 'boolean': {
      if (typeof value !== 'boolean') {
        out.push({ path, message: `expected a boolean, received ${describe(value)}` });
      }
      return;
    }
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (Number.isNaN(value)) return 'NaN';
  return typeof value;
}

/**
 * Validate an agent's arguments. Reports EVERY violation rather than the first,
 * so an agent can correct itself in one round trip (FR-009).
 */
export function validate(schema: JsonSchema, value: unknown): ValidationResult {
  const violations: Violation[] = [];
  check(schema, value, '', violations);

  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, value: value as Record<string, unknown> };
}
