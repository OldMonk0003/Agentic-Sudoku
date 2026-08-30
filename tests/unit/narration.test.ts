import { describe, it, expect, beforeEach } from 'vitest';
import { defineWriteTool, EXPLANATION_MAX, EXPLANATION_MIN } from '@/tools/narration';
import { descriptors } from '@/tools/registry';
import { agentStore, visibleExplanations, createAgentStore, emptyAgentSession } from '@/state/agentSession';
import type { JsonSchema } from '@/tools/types';

/**
 * The narration contract, enforced in ONE place (research.md R4).
 *
 * SC-002 and SC-003 are absolutes: "there is no path by which the board changes
 * silently", "100% of attempted changes lacking valid explanation text are
 * rejected". With nine write tools written independently those hold only if nine
 * implementations are each correct and stay correct.
 *
 * Through `defineWriteTool`, a write tool that forgets to narrate CANNOT BE
 * DECLARED -- the explanation is injected into the schema rather than trusted to
 * the author, and the wrapper checks it before the handler runs.
 */

const VALID = 'This is a perfectly ordinary explanation of a move, long enough to be useful.';

let ran = 0;

const probe = (extra: Partial<JsonSchema['properties']> = {}) =>
  defineWriteTool({
    name: 'probe_tool',
    description:
      'A probe used only in tests. Rows are numbered 1-9 top to bottom and columns 1-9 left to right.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: { row: { type: 'integer', minimum: 1, maximum: 9 }, ...extra },
      required: ['row'],
    },
    async run() {
      ran++;
      return { ok: true, data: { done: true } };
    },
  });

beforeEach(() => {
  ran = 0;
  // Start each test from a clean queue.
  agentStore.dispatch({ type: 'clearAnnotations' });
  for (const explanation of agentStore.getState().explanations) {
    agentStore.dispatch({ type: 'dismissExplanation', id: explanation.id });
  }
});

describe('the wrapper injects the contract into the schema', () => {
  it('adds `explanation` with its bounds, and marks it required', () => {
    const tool = probe();
    expect(tool.inputSchema.properties!.explanation).toEqual({
      type: 'string',
      minLength: EXPLANATION_MIN,
      maxLength: EXPLANATION_MAX,
    });
    expect(tool.inputSchema.required).toContain('explanation');
  });

  it('keeps the tool declaring itself as mutating (FR-005)', () => {
    expect(probe().readOnly).toBe(false);
  });

  it('preserves the tool author"s own properties and requirements', () => {
    const tool = probe();
    expect(tool.inputSchema.properties!.row).toBeDefined();
    expect(tool.inputSchema.required).toContain('row');
  });

  it('uses one-to-two-line bounds, per the spec assumption', () => {
    expect(EXPLANATION_MIN).toBe(20);
    expect(EXPLANATION_MAX).toBe(240);
  });
});

describe('rejection happens BEFORE the handler runs (FR-015, SC-003)', () => {
  it('rejects a missing explanation, and the handler never runs', async () => {
    const result = await probe().execute({ row: 4 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-required');
    expect(ran, 'the handler must not have run').toBe(0);
  });

  it('rejects an explanation that is too short, naming both bounds', async () => {
    const result = await probe().execute({ row: 4, explanation: 'too short' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('explanation-length');
      expect(result.error.details).toMatchObject({ minLength: 20, maxLength: 240 });
    }
    expect(ran).toBe(0);
  });

  it('rejects an essay', async () => {
    const result = await probe().execute({ row: 4, explanation: 'x'.repeat(241) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-length');
    expect(ran).toBe(0);
  });

  it('rejects a non-string explanation', async () => {
    for (const bad of [42, null, [], {}, true]) {
      const result = await probe().execute({ row: 4, explanation: bad });
      expect(result.ok, String(bad)).toBe(false);
      expect(ran).toBe(0);
    }
  });

  it('still rejects unrecognised arguments (FR-003)', async () => {
    const result = await probe().execute({ row: 4, explanation: VALID, sneaky: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unexpected-argument');
    expect(ran).toBe(0);
  });

  it('publishes NOTHING to the learner when the call is rejected', async () => {
    const before = agentStore.getState().explanations.length;
    await probe().execute({ row: 4 });
    expect(agentStore.getState().explanations).toHaveLength(before);
  });
});

describe('publication happens AFTER the handler succeeds (FR-017)', () => {
  it('shows the explanation, attributed to the tool that made the change', async () => {
    const result = await probe().execute({ row: 4, explanation: VALID });
    expect(result.ok).toBe(true);

    const visible = visibleExplanations(agentStore.getState(), Date.now());
    expect(visible.at(-1)!.text).toBe(VALID);
    expect(visible.at(-1)!.tool).toBe('probe_tool');
  });

  it('publishes nothing when the handler itself reports failure', async () => {
    const failing = defineWriteTool({
      name: 'failing_tool',
      description: 'Fails on purpose. Rows are 1-9 top to bottom, columns 1-9 left to right.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      async run() {
        return { ok: false as const, code: 'cell-is-clue' as const, message: 'that cell is a clue' };
      },
    });

    const before = agentStore.getState().explanations.length;
    const result = await failing.execute({ explanation: VALID });

    expect(result.ok).toBe(false);
    // An explanation for a change that did not happen would be a lie on screen.
    expect(agentStore.getState().explanations).toHaveLength(before);
  });

  it('never rejects its promise, even when the handler throws', async () => {
    const throwing = defineWriteTool({
      name: 'throwing_tool',
      description: 'Throws on purpose. Rows are 1-9 top to bottom, columns 1-9 left to right.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      async run(): Promise<never> {
        throw new RangeError('something unexpected');
      },
    });

    const result = await throwing.execute({ explanation: VALID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('internal-error');
  });

  it('lets a self-narrating tool publish its own surface instead of a popup', async () => {
    // show_pattern_hint_toast's explanation IS the message the learner reads, so
    // a popup as well would say the same thing twice.
    const store = createAgentStore(emptyAgentSession());
    expect(store.getState().explanations).toHaveLength(0);

    const selfNarrating = defineWriteTool({
      name: 'self_narrating_tool',
      description: 'Narrates itself. Rows are 1-9 top to bottom, columns 1-9 left to right.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      narration: 'self',
      async run() {
        return { ok: true as const, data: {} };
      },
    });

    const before = agentStore.getState().explanations.length;
    await selfNarrating.execute({ explanation: VALID });
    expect(agentStore.getState().explanations).toHaveLength(before);
  });
});

describe('the whole surface obeys the contract', () => {
  it('every write tool declares `explanation` with identical bounds', () => {
    const writeTools = descriptors.filter((d) => !d.readOnly);
    expect(writeTools.length).toBeGreaterThan(0);

    for (const tool of writeTools) {
      expect(tool.inputSchema.properties?.explanation, `${tool.name} explanation`).toEqual({
        type: 'string',
        minLength: EXPLANATION_MIN,
        maxLength: EXPLANATION_MAX,
      });
      expect(tool.inputSchema.required, `${tool.name} required`).toContain('explanation');
    }
  });

  it('no read-only tool requires an explanation (FR-023)', () => {
    for (const tool of descriptors.filter((d) => d.readOnly)) {
      expect(tool.inputSchema.properties?.explanation, `${tool.name}`).toBeUndefined();
    }
  });
});
