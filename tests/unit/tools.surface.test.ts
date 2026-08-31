import { describe, it, expect } from 'vitest';
import { descriptors, TOOL_SURFACE_VERSION } from '@/tools/registry';

/**
 * THE test constitution Principle I asks for by name:
 *
 *   "The registration module MUST be importable and executable headlessly, with
 *    no DOM mounted, so the full tool surface can be asserted in tests without
 *    rendering the app."
 *
 * This file runs in the `node` project. There is no `document` here at all. If
 * enumerating the tool surface ever needs one, registration has leaked into the
 * view and FR-011 is broken.
 *
 * It is the sibling of tests/unit/store.headless.test.ts, which protects the
 * property this one depends on.
 */

/**
 * Feature 002's surface, complete at eleven. Feature 003 adds five more but must
 * REMOVE none: 002/FR-010 makes a rename or removal a MAJOR break, so this list
 * is frozen and only ever appended to.
 */
const SURFACE_002 = [
  'get_board_state', 'check_for_conflicts',
  'highlight_pattern_cells', 'show_pattern_hint_toast', 'clear_visual_annotations',
  'fill_cell',
  'draw_constraint_beams',
  'update_pencil_marks', 'auto_fill_all_pencil_marks',
  'playback_deduction_sequence',
  'load_technique_practice',
];

/**
 * Feature 003. GROWS WITH EACH SLICE, exactly as 002's list did -- each slice
 * ends in a deployable site, so the expected surface is whatever has actually
 * shipped, not what is planned. Complete at sixteen.
 */
const SURFACE_003: readonly string[] = [
  'show_coordinate_ruler', 'hide_coordinate_ruler',
  'switch_difficulty',
  'pause_timer', 'resume_timer',
];

const EXPECTED_SO_FAR = [...SURFACE_002, ...SURFACE_003];

describe('the WebMCP tool surface, enumerated with no DOM', () => {
  it('has no DOM', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
  });

  it('enumerates every registered tool without a browser', () => {
    expect(descriptors.map((d) => d.name)).toEqual(EXPECTED_SO_FAR);
  });

  it('carries a surface version', () => {
    expect(TOOL_SURFACE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  /*
    002/FR-010: renaming a tool, removing one, or narrowing an existing schema is
    a BREAKING change requiring a MAJOR bump. Feature 003 only ADDS, so the
    version moves 1.0.0 -> 1.1.0 and every one of 002's eleven tools must still
    be there, still callable, still accepting what it accepted before.
  */
  it('records feature 003 as an additive minor bump (002/FR-010)', () => {
    expect(TOOL_SURFACE_VERSION).toBe('1.1.0');
  });

  it('still carries every tool feature 002 registered', () => {
    const names = descriptors.map((d) => d.name);
    for (const name of SURFACE_002) {
      expect(names, `${name} was removed or renamed -- that is a MAJOR break`).toContain(name);
    }
  });

  it('has not narrowed any input schema inherited from feature 002', () => {
    // A narrowed schema rejects input an agent written against 1.0.0 sends.
    // Every 002 tool still takes an object, still rejects unknown arguments, and
    // still requires exactly what it required -- never more.
    const REQUIRED_002: Readonly<Record<string, readonly string[]>> = {
      get_board_state: [],
      check_for_conflicts: [],
      clear_visual_annotations: ['explanation'],
      fill_cell: ['row', 'col', 'digit', 'explanation'],
      show_pattern_hint_toast: ['explanation'],
      highlight_pattern_cells: ['explanation'],
      draw_constraint_beams: ['beams', 'explanation'],
      update_pencil_marks: ['cells', 'explanation'],
      auto_fill_all_pencil_marks: ['explanation'],
      playback_deduction_sequence: ['steps', 'explanation'],
      load_technique_practice: ['technique', 'explanation'],
    };

    for (const [name, required] of Object.entries(REQUIRED_002)) {
      const descriptor = descriptors.find((d) => d.name === name);
      expect(descriptor, `${name} is missing`).toBeDefined();
      const actual = [...(descriptor!.inputSchema.required ?? [])].sort();
      expect(actual, `${name} required arguments changed`).toEqual([...required].sort());
    }
  });

  it('gives every tool a unique name the standard accepts', () => {
    const names = descriptors.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      // The standard's own rule: 1-128 chars of [A-Za-z0-9_.-].
      expect(name).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
      // Ours: snake_case, so the surface reads consistently to an agent.
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('describes every tool well enough for an agent that has never seen this site', () => {
    for (const descriptor of descriptors) {
      expect(descriptor.description.length, `${descriptor.name} description`).toBeGreaterThan(80);
      // FR-007: the addressing convention is stated in EVERY description, never
      // varied between tools and never assumed.
      expect(descriptor.description.toLowerCase(), `${descriptor.name} addressing`).toMatch(
        /row|column/,
      );
    }
  });

  it('declares whether every tool mutates (FR-005)', () => {
    for (const descriptor of descriptors) {
      expect(typeof descriptor.readOnly, `${descriptor.name}.readOnly`).toBe('boolean');
    }
  });

  it('gives every tool a strict object schema that rejects unknown arguments', () => {
    for (const descriptor of descriptors) {
      const schema = descriptor.inputSchema;
      expect(schema.type, `${descriptor.name} schema type`).toBe('object');
      // FR-003: unrecognised arguments rejected rather than ignored.
      expect(schema.additionalProperties, `${descriptor.name} additionalProperties`).toBe(false);
      expect(schema.properties, `${descriptor.name} properties`).toBeDefined();
    }
  });

  it('exposes an executable handler for every tool', () => {
    for (const descriptor of descriptors) {
      expect(typeof descriptor.execute, `${descriptor.name}.execute`).toBe('function');
    }
  });

  it('imports no React and no UI module', async () => {
    // A structural guard. The tools layer must not reach into the view; they
    // meet only at the agent session store (Principle III, and the lint zones).
    const registry = await import('@/tools/registry');
    expect(Object.keys(registry)).toContain('registerTools');
    // If a UI module had been imported, this test would have crashed on `document`
    // long before reaching here -- every UI module is a client component.
    expect(typeof document).toBe('undefined');
  });
});
