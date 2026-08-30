import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle } from '@/state/actions';
import { agentStore, learnerActed, clearAnnotations } from '@/state/agentSession';
import { createPlaybackTool, playbackDeductionSequence } from '@/tools/tools/playbackDeductionSequence';
import { toCoord, toIndex } from '@/engine/grid';
import type { Scheduler } from '@/tools/playback';

/**
 * Contract test for `playback_deduction_sequence` (FR-047 through FR-051).
 *
 * Driven through a fake clock so the whole sequence resolves instantly. The
 * REGISTERED tool uses a real one -- that is the point of the exemption recorded
 * in plan.md -- so the injectable factory is what makes it testable.
 */

const instant: Scheduler = { async wait() {} };
const tool = createPlaybackTool({ scheduler: instant });

const emptyCoords = (n: number) =>
  store.getState().cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell.value === null)
    .slice(0, n)
    .map(({ index }) => toCoord(index));

const steps = (count: number) =>
  emptyCoords(count).map((coord, i) => ({
    action: 'fill',
    ...coord,
    digit: (i % 9) + 1,
    explanation: `Step ${i}: this cell can only take that digit, for the reasons shown here.`,
  }));

const SEQUENCE_EXPLANATION = 'Three steps that finish this box; follow the reasoning as it goes.';

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 999331));
  agentStore.dispatch(clearAnnotations());
});

describe('playback_deduction_sequence — descriptor', () => {
  it('is named, mutating, and requires narration on the CALL and on each STEP', () => {
    expect(playbackDeductionSequence.name).toBe('playback_deduction_sequence');
    expect(playbackDeductionSequence.readOnly).toBe(false);
    expect(playbackDeductionSequence.inputSchema.required).toEqual(
      expect.arrayContaining(['steps', 'explanation']),
    );

    const stepSchema = playbackDeductionSequence.inputSchema.properties!.steps!.items!;
    expect(stepSchema.required).toEqual(expect.arrayContaining(['action', 'explanation']));
  });

  it('bounds the sequence length, so a walkthrough stays a lesson', () => {
    const stepsSchema = playbackDeductionSequence.inputSchema.properties!.steps!;
    expect(stepsSchema.minItems).toBe(2);
    expect(stepsSchema.maxItems).toBe(8);
  });

  it('warns an agent that it takes seconds and can be interrupted', () => {
    const description = playbackDeductionSequence.description.toLowerCase();
    expect(description).toContain('seconds');
    expect(description).toMatch(/stop|interrupt|halt/);
  });
});

describe('playback_deduction_sequence — success', () => {
  it('plays every step and reports finishing', async () => {
    const result = await tool.execute({
      steps: steps(3),
      explanation: SEQUENCE_EXPLANATION,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        steps_requested: 3,
        steps_completed: 3,
        stopped_because: 'finished',
      });
    }
  });

  it('an INTERRUPTION is ok:true -- the learner taking over is not an error', async () => {
    // The learner touches the board during the first pause.
    let waits = 0;
    const interrupting: Scheduler = {
      async wait() {
        if (waits++ === 0) agentStore.dispatch(learnerActed());
      },
    };

    const result = await createPlaybackTool({ scheduler: interrupting }).execute({
      steps: steps(4),
      explanation: SEQUENCE_EXPLANATION,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ steps_completed: 1, stopped_because: 'interrupted' });
    }
  });
});

describe('playback_deduction_sequence — failure', () => {
  it('validates EVERY step before running any of them', async () => {
    const coords = emptyCoords(2);
    const result = await tool.execute({
      steps: [
        { action: 'fill', ...coords[0]!, digit: 1, explanation: 'A first step that would succeed.' },
        { action: 'beam', explanation: 'A second step missing its unit entirely, so invalid.' },
      ],
      explanation: SEQUENCE_EXPLANATION,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-input');
      expect(result.error.message).toContain('Step 2');
      expect(result.error.message).toContain('Nothing was played');
    }
    // Step one did NOT run: rejection happens before the sequence starts.
    expect(store.getState().cells[toIndex(coords[0]!)]!.value).toBeNull();
  });

  it('reports a step that fails its own precondition, keeping what came before', async () => {
    const coords = emptyCoords(1);
    const clue = toCoord(store.getState().cells.findIndex((c) => c.origin === 'clue'));

    const result = await tool.execute({
      steps: [
        { action: 'fill', ...coords[0]!, digit: 1, explanation: 'A first step that will succeed nicely.' },
        { action: 'fill', ...clue, digit: 2, explanation: 'A second step that targets a starting clue.' },
      ],
      explanation: SEQUENCE_EXPLANATION,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('playback-step-failed');
      expect(result.error.details).toMatchObject({ steps_completed: 1 });
      expect(result.error.message).toContain('step 2');
    }
    // FR-049: completed steps are NOT rolled back.
    expect(store.getState().cells[toIndex(coords[0]!)]!.value).toBe(1);
  });

  it('rejects a sequence of one step, or of nine', async () => {
    for (const count of [1, 9]) {
      const result = await tool.execute({ steps: steps(count), explanation: SEQUENCE_EXPLANATION });
      expect(result.ok, String(count)).toBe(false);
    }
  });

  it('rejects a step with no explanation of its own (FR-047)', async () => {
    const coords = emptyCoords(2);
    const result = await tool.execute({
      steps: [
        { action: 'fill', ...coords[0]!, digit: 1, explanation: 'A first step with a proper explanation.' },
        { action: 'fill', ...coords[1]!, digit: 2 },
      ],
      explanation: SEQUENCE_EXPLANATION,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-input');
  });

  it('rejects a call with no explanation for the sequence itself', async () => {
    const result = await tool.execute({ steps: steps(2) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-required');
  });

  it('rejects an unknown step action', async () => {
    const result = await tool.execute({
      steps: [
        { action: 'erase', row: 1, col: 1, explanation: 'A step using an action that does not exist.' },
        { action: 'fill', row: 1, col: 1, digit: 1, explanation: 'A second step, never reached at all.' },
      ],
      explanation: SEQUENCE_EXPLANATION,
    });
    expect(result.ok).toBe(false);
  });

  it('never rejects its promise', async () => {
    for (const hostile of [null, undefined, 'x', 42, [], { steps: 'two' }]) {
      await expect(tool.execute(hostile)).resolves.toMatchObject({ ok: false });
    }
  });
});
