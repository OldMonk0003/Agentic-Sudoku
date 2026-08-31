import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle } from '@/state/actions';
import { agentStore, clearAnnotations, visibleSpotlight } from '@/state/agentSession';
import { defineWriteTool } from '@/tools/narration';

/**
 * FR-018, raised in ONE PLACE (research.md R4).
 *
 * `defineWriteTool` already injects and validates the explanation so no write
 * can be silent. It now also raises the spotlight so no cell-changing write can
 * be invisible. The argument is verbatim the one narration.ts already makes
 * about the explanation: with nine write tools written independently, the
 * guarantee holds only if nine implementations are each correct and stay
 * correct forever.
 *
 * A spotlight that some write tools remember and others forget would be WORSE
 * than none, because the learner would learn to trust it and then be misled once.
 *
 * The ordering assertion is the other half. `validate -> mutate -> publish` means
 * a REJECTED write raises no spotlight: one that pointed at a cell which did not
 * change would be a lie of exactly the kind the narration contract exists to
 * prevent.
 */

const EXPLANATION = 'Placing this digit here because every other candidate is already used nearby.';

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 777));
  agentStore.dispatch(clearAnnotations());
});

const succeedingTool = (changed: { row: number; col: number }[]) =>
  defineWriteTool({
    name: 'test_tool_success',
    description: 'A test tool. Rows 1-9 top to bottom, columns 1-9 left to right, boxes in reading order.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {}, required: [] },
    async run() {
      return { ok: true, data: { fine: true }, changed };
    },
  });

const failingTool = defineWriteTool({
  name: 'test_tool_failure',
  description: 'A test tool. Rows 1-9 top to bottom, columns 1-9 left to right, boxes in reading order.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  async run() {
    return { ok: false, code: 'cell-not-empty', message: 'nope' };
  },
});

const noChangeTool = defineWriteTool({
  name: 'test_tool_no_cells',
  description: 'A test tool. Rows 1-9 top to bottom, columns 1-9 left to right, boxes in reading order.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  async run() {
    return { ok: true, data: { fine: true } };
  },
});

describe('the write wrapper raises the spotlight', () => {
  it('runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it('spotlights the cells a successful write changed', async () => {
    await succeedingTool([{ row: 2, col: 6 }]).execute({ explanation: EXPLANATION });

    const spotlight = visibleSpotlight(agentStore.getState(), Date.now());
    expect(spotlight).not.toBeNull();
    expect(spotlight!.focus).toEqual({ row: 2, col: 6 });
  });

  it('raises NO spotlight when the write was rejected', async () => {
    await failingTool.execute({ explanation: EXPLANATION });
    expect(agentStore.getState().spotlight).toBeNull();
  });

  it('raises no spotlight when the write was rejected for a missing explanation', async () => {
    await succeedingTool([{ row: 2, col: 6 }]).execute({});
    expect(agentStore.getState().spotlight).toBeNull();
  });

  it('raises no spotlight for a write that changed no cells', async () => {
    await noChangeTool.execute({ explanation: EXPLANATION });
    expect(agentStore.getState().spotlight).toBeNull();
  });

  it('queues the explanation and the spotlight together', async () => {
    await succeedingTool([{ row: 3, col: 3 }]).execute({ explanation: EXPLANATION });

    const session = agentStore.getState();
    expect(session.explanations.at(-1)!.text).toBe(EXPLANATION);
    expect(session.spotlight).not.toBeNull();
  });

  it('replaces the previous spotlight on the next write (FR-022)', async () => {
    await succeedingTool([{ row: 1, col: 1 }]).execute({ explanation: EXPLANATION });
    await succeedingTool([{ row: 9, col: 9 }]).execute({ explanation: EXPLANATION });

    expect(visibleSpotlight(agentStore.getState(), Date.now())!.focus).toEqual({ row: 9, col: 9 });
  });
});
