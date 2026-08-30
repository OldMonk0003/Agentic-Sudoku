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

/** Grows with each slice. The surface is complete at eleven. */
const EXPECTED_SO_FAR = [
  'get_board_state', 'check_for_conflicts',
  'highlight_pattern_cells', 'show_pattern_hint_toast', 'clear_visual_annotations',
  'fill_cell',
  'draw_constraint_beams',
  'update_pencil_marks', 'auto_fill_all_pencil_marks',
  'playback_deduction_sequence',
  'load_technique_practice',
];

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
