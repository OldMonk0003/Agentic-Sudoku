import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, undo } from '@/state/actions';
import { agentStore, learnerActed, setReducedMotion, clearAnnotations } from '@/state/agentSession';
import {
  runSequence, validateSteps, PACE_MS, PACE_REDUCED_MS,
  type PlaybackStep, type Scheduler,
} from '@/tools/playback';
import { toCoord, toIndex } from '@/engine/grid';

/**
 * The sequencer, driven by a FAKE CLOCK (research.md R8).
 *
 * Every timing assertion below is exact and instant because the scheduler is
 * injected. A real `setTimeout` here would make the suite slow and flaky, and
 * would test the clock rather than the sequence.
 */

/** Records the waits it was asked for, and can act between them. */
function fakeClock(onWait?: (index: number) => void): Scheduler & { waits: number[] } {
  const waits: number[] = [];
  return {
    waits,
    async wait(ms: number) {
      onWait?.(waits.length);
      waits.push(ms);
    },
  };
}

const emptyCoords = (n: number) =>
  store.getState().cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell.value === null)
    .slice(0, n)
    .map(({ index }) => toCoord(index));

function fillSteps(count: number): PlaybackStep[] {
  return emptyCoords(count).map((coord, i) => ({
    action: 'fill' as const,
    row: coord.row,
    col: coord.col,
    digit: ((i % 9) + 1),
    explanation: `Step ${i}: this cell can only take that digit, for reasons shown here.`,
  }));
}

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 112358));
  agentStore.dispatch(clearAnnotations());
  agentStore.dispatch(setReducedMotion({ value: false }));
});

describe('running a sequence', () => {
  it('runs every step in order and reports finishing', async () => {
    const steps = fillSteps(3);
    const clock = fakeClock();

    const outcome = await runSequence(steps, { scheduler: clock });

    expect(outcome).toMatchObject({
      stepsRequested: 3,
      stepsCompleted: 3,
      stoppedBecause: 'finished',
    });
    for (const step of steps) {
      expect(store.getState().cells[toIndex({ row: step.row!, col: step.col! })]!.value).toBe(step.digit);
    }
  });

  it('publishes each step"s OWN explanation as that step runs (FR-047)', async () => {
    const seenAtEachWait: number[] = [];
    const clock = fakeClock(() => seenAtEachWait.push(agentStore.getState().explanations.length));

    const before = agentStore.getState().explanations.length;
    await runSequence(fillSteps(3), { scheduler: clock });

    // One more explanation before each pause -- not three at the end.
    expect(seenAtEachWait).toEqual([before + 1, before + 2]);
    expect(agentStore.getState().explanations).toHaveLength(before + 3);
  });

  it('paces between steps but not after the last one', async () => {
    const clock = fakeClock();
    await runSequence(fillSteps(3), { scheduler: clock });

    expect(clock.waits).toEqual([PACE_MS, PACE_MS]);
  });

  it('makes each step an INDIVIDUAL undo entry (FR-050)', async () => {
    const depth = store.getState().history.length;
    await runSequence(fillSteps(3), { scheduler: fakeClock() });

    expect(store.getState().history).toHaveLength(depth + 3);

    // And they unwind one at a time, not as a lump.
    store.dispatch(undo());
    expect(store.getState().history).toHaveLength(depth + 2);
  });

  it('reports progress through the store so the learner can see it', async () => {
    const seen: number[] = [];
    const clock = fakeClock(() => seen.push(agentStore.getState().playback!.completedSteps));

    await runSequence(fillSteps(3), { scheduler: clock });

    expect(seen).toEqual([1, 2]);
    expect(agentStore.getState().playback).toMatchObject({ running: false, completedSteps: 3 });
  });
});

describe('interruption (FR-048, FR-049)', () => {
  it('stops immediately when the learner acts, and does NOT roll back', async () => {
    const steps = fillSteps(4);
    // The learner touches the board during the first pause.
    const clock = fakeClock((index) => {
      if (index === 0) agentStore.dispatch(learnerActed());
    });

    const outcome = await runSequence(steps, { scheduler: clock });

    expect(outcome).toMatchObject({ stepsCompleted: 1, stoppedBecause: 'interrupted' });
    // Step 1 stands.
    expect(store.getState().cells[toIndex({ row: steps[0]!.row!, col: steps[0]!.col! })]!.value)
      .toBe(steps[0]!.digit);
    // Step 2 never happened.
    expect(store.getState().cells[toIndex({ row: steps[1]!.row!, col: steps[1]!.col! })]!.value)
      .toBeNull();
  });

  it('is not cancelled by something the learner did BEFORE it started', async () => {
    // The baseline is captured when the sequence begins. A click a moment
    // earlier is not an interruption of a walkthrough that had not begun -- the
    // learner asked for this, and cancelling it before step one would look like
    // the tool simply not working.
    const steps = fillSteps(3);
    agentStore.dispatch(learnerActed());

    const outcome = await runSequence(steps, { scheduler: fakeClock() });

    expect(outcome).toMatchObject({ stepsCompleted: 3, stoppedBecause: 'finished' });
  });

  it('stops before step TWO when the learner acts during step one"s pause', async () => {
    const steps = fillSteps(3);
    const clock = fakeClock((index) => {
      if (index === 0) agentStore.dispatch(learnerActed());
    });

    const outcome = await runSequence(steps, { scheduler: clock });

    expect(outcome).toMatchObject({ stepsCompleted: 1, stoppedBecause: 'interrupted' });
    expect(store.getState().cells[toIndex({ row: steps[1]!.row!, col: steps[1]!.col! })]!.value)
      .toBeNull();
  });

  it('stops when the host aborts the call', async () => {
    const controller = new AbortController();
    const clock = fakeClock((index) => {
      if (index === 1) controller.abort();
    });

    const outcome = await runSequence(fillSteps(4), {
      scheduler: clock,
      signal: controller.signal,
    });

    expect(outcome).toMatchObject({ stepsCompleted: 2, stoppedBecause: 'interrupted' });
  });

  it('leaves the board consistent: every completed step is undoable one at a time', async () => {
    const clock = fakeClock((index) => {
      if (index === 1) agentStore.dispatch(learnerActed());
    });
    const depth = store.getState().history.length;

    const outcome = await runSequence(fillSteps(4), { scheduler: clock });

    expect(outcome.stepsCompleted).toBe(2);
    expect(store.getState().history).toHaveLength(depth + 2);
    store.dispatch(undo());
    expect(store.getState().history).toHaveLength(depth + 1);
  });
});

describe('a step that fails its own precondition (FR-049)', () => {
  it('halts there, keeps what came before, and names the step', async () => {
    const coords = emptyCoords(2);
    const clue = toCoord(store.getState().cells.findIndex((c) => c.origin === 'clue'));

    const steps: PlaybackStep[] = [
      { action: 'fill', ...coords[0]!, digit: 1, explanation: 'A first step that will succeed nicely.' },
      { action: 'fill', ...clue, digit: 2, explanation: 'A second step that targets a starting clue.' },
      { action: 'fill', ...coords[1]!, digit: 3, explanation: 'A third step that will never be reached.' },
    ];

    const outcome = await runSequence(steps, { scheduler: fakeClock() });

    expect(outcome).toMatchObject({ stepsCompleted: 1, stoppedBecause: 'step-failed' });
    expect(outcome.failure).toMatchObject({ step: 1 });
    expect(outcome.failure!.message).toContain('cell-is-clue');

    // The first step stands; the third never ran.
    expect(store.getState().cells[toIndex(coords[0]!)]!.value).toBe(1);
    expect(store.getState().cells[toIndex(coords[1]!)]!.value).toBeNull();
  });
});

describe('reduced motion (FR-061)', () => {
  it('drops the animation time, not the reading time', async () => {
    agentStore.dispatch(setReducedMotion({ value: true }));
    const clock = fakeClock();

    await runSequence(fillSteps(3), { scheduler: clock });

    expect(clock.waits).toEqual([PACE_REDUCED_MS, PACE_REDUCED_MS]);
    // Still paced: a walkthrough the learner cannot follow is not a walkthrough.
    expect(PACE_REDUCED_MS).toBeGreaterThan(500);
  });
});

describe('structural validation, before step zero', () => {
  it('accepts a well-formed sequence', () => {
    expect(validateSteps(fillSteps(2))).toEqual([]);
  });

  it('names the offending step for each malformed action', () => {
    const problems = validateSteps([
      { action: 'fill', row: 1, explanation: 'x'.repeat(30) } as PlaybackStep,
      { action: 'beam', explanation: 'x'.repeat(30) } as PlaybackStep,
      { action: 'highlight', cells: [], explanation: 'x'.repeat(30) } as PlaybackStep,
      { action: 'pencil', row: 1, col: 1, explanation: 'x'.repeat(30) } as PlaybackStep,
    ]);

    expect(problems.map((p) => p.step)).toEqual(expect.arrayContaining([0, 1, 2, 3]));
  });

  it('rejects an off-grid coordinate in a highlight step', () => {
    const problems = validateSteps([
      { action: 'highlight', cells: [{ row: 0, col: 1 }], explanation: 'x'.repeat(30) } as PlaybackStep,
    ]);
    expect(problems).toHaveLength(1);
  });
});
