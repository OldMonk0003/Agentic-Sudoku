import { store } from '@/state/store';
import { enterDigitAt, setCandidatesAt } from '@/state/actions';
import {
  agentStore, addAnnotations, playbackAdvanced, playbackEnded, playbackStarted, pushExplanation,
  type AnnotationInput,
} from '@/state/agentSession';
import { isValidCoord, type Coord, type Digit } from '@/engine/grid';
import type { ErrorCode } from './types';

/**
 * The walkthrough sequencer (FR-047 through FR-051).
 *
 * Three constraints intersect here, and the design falls out of them:
 *
 * 1. **It must be interruptible by learner input on the board** (FR-048). The
 *    Board raises a monotonic `learnerActivity` counter on any key or click; this
 *    compares it against the value seen at the previous step. So `Board.tsx` does
 *    not know playback exists, and this file does not touch the DOM -- they meet
 *    only at the agent session store.
 *
 * 2. **It must be driveable headlessly**, so the SCHEDULER IS INJECTED. Tests
 *    pass a fake clock and the whole sequence runs instantly and deterministically;
 *    production passes `setTimeout`. Timers are permitted in the Tools layer --
 *    Principle III bars them from the Engine, not from here -- but a real one in a
 *    test is a flake waiting to happen.
 *
 * 3. **Completed steps are never rolled back** (FR-049). That is free: each step
 *    is an ordinary dispatch, already committed to history. Stopping is simply
 *    not dispatching the next one. FR-050 (each step individually undoable) is
 *    free for the same reason -- one step is one ordinary action with its own
 *    ChangeRecord. This is the payoff for 001 making agent and human writes the
 *    same code path.
 */

export type StepAction = 'fill' | 'pencil' | 'highlight' | 'beam';

export interface PlaybackStep {
  readonly action: StepAction;
  readonly row?: number;
  readonly col?: number;
  readonly digit?: number;
  readonly digits?: readonly number[];
  readonly cells?: readonly Coord[];
  readonly unit_type?: 'row' | 'col' | 'box';
  readonly unit_number?: number;
  readonly explanation: string;
}

export type StopReason = 'finished' | 'interrupted' | 'step-failed';

export interface PlaybackOutcome {
  readonly stepsRequested: number;
  readonly stepsCompleted: number;
  readonly stoppedBecause: StopReason;
  readonly failure?: { readonly step: number; readonly code: ErrorCode; readonly message: string };
}

export interface Scheduler {
  wait(ms: number, signal?: AbortSignal): Promise<void>;
}

/** Long enough to read a sentence and watch a digit land. */
export const PACE_MS = 1200;
/**
 * With reduced motion there is no sweep to wait out, so the pace drops by
 * exactly the animation it no longer plays -- the READING time is unchanged
 * (FR-061). Shortening the dwell itself would make a walkthrough harder to
 * follow for the learner who asked for less motion, which is backwards.
 */
export const PACE_REDUCED_MS = 1000;

export const realScheduler: Scheduler = {
  wait: (ms, signal) =>
    new Promise((resolve) => {
      const id = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(id);
        resolve();
      }, { once: true });
    }),
};

// --- structural validation, before step zero -------------------------------

export interface StepProblem {
  readonly step: number;
  readonly message: string;
}

const coordOk = (row: unknown, col: unknown) =>
  typeof row === 'number' && typeof col === 'number' && isValidCoord({ row, col });

/**
 * Check every step's shape BEFORE running any of them (FR-049's spirit).
 *
 * A sequence that would fail at step four is rejected at step zero, rather than
 * abandoning the learner halfway through a lesson. This checks STRUCTURE only --
 * board preconditions cannot be checked in advance, because step three's
 * legality depends on step two having run.
 */
export function validateSteps(steps: readonly PlaybackStep[]): readonly StepProblem[] {
  const problems: StepProblem[] = [];

  steps.forEach((step, index) => {
    switch (step.action) {
      case 'fill':
        if (!coordOk(step.row, step.col)) {
          problems.push({ step: index, message: 'a "fill" step needs row and col, each 1-9' });
        }
        if (typeof step.digit !== 'number' || step.digit < 1 || step.digit > 9) {
          problems.push({ step: index, message: 'a "fill" step needs digit, 1-9' });
        }
        break;

      case 'pencil':
        if (!coordOk(step.row, step.col)) {
          problems.push({ step: index, message: 'a "pencil" step needs row and col, each 1-9' });
        }
        if (!Array.isArray(step.digits)) {
          problems.push({ step: index, message: 'a "pencil" step needs digits, an array (possibly empty)' });
        }
        break;

      case 'highlight':
        if (!Array.isArray(step.cells) || step.cells.length === 0) {
          problems.push({ step: index, message: 'a "highlight" step needs a non-empty cells array' });
        } else if (!step.cells.every((cell) => coordOk(cell?.row, cell?.col))) {
          problems.push({ step: index, message: 'every cell in a "highlight" step needs row and col, each 1-9' });
        }
        break;

      case 'beam':
        if (!step.unit_type || typeof step.unit_number !== 'number') {
          problems.push({ step: index, message: 'a "beam" step needs unit_type and unit_number' });
        } else if (step.unit_number < 1 || step.unit_number > 9) {
          problems.push({ step: index, message: 'unit_number must be 1-9' });
        }
        break;
    }
  });

  return problems;
}

// --- running one step ------------------------------------------------------

type StepResult = { ok: true } | { ok: false; code: ErrorCode; message: string };

function runStep(step: PlaybackStep): StepResult {
  switch (step.action) {
    case 'fill': {
      const result = store.dispatch(
        enterDigitAt({ row: step.row!, col: step.col! }, step.digit! as Digit, 'agent'),
      );
      if (result.ok) return { ok: true };
      return {
        ok: false,
        code: 'playback-step-failed',
        message: `the board refused the fill at row ${step.row}, column ${step.col}: ${result.reason}`,
      };
    }

    case 'pencil': {
      const result = store.dispatch(
        setCandidatesAt(
          [{ coord: { row: step.row!, col: step.col! }, digits: (step.digits ?? []) as Digit[] }],
          'agent',
        ),
      );
      if (result.ok) return { ok: true };
      return {
        ok: false,
        code: 'playback-step-failed',
        message: `the board refused the pencil marks at row ${step.row}, column ${step.col}: ${result.reason}`,
      };
    }

    case 'highlight': {
      const annotations: AnnotationInput[] = [
        { kind: 'cell', role: 'target', cells: step.cells!.map(({ row, col }) => ({ row, col })) },
      ];
      agentStore.dispatch(addAnnotations({ annotations, now: Date.now() }));
      return { ok: true };
    }

    case 'beam': {
      const annotations: AnnotationInput[] = [
        {
          kind: 'beam',
          unit: { type: step.unit_type!, n: step.unit_number! },
          digit: (step.digit ?? null) as Digit | null,
        },
      ];
      agentStore.dispatch(addAnnotations({ annotations, now: Date.now() }));
      return { ok: true };
    }
  }
}

// --- the sequence ----------------------------------------------------------

export interface RunOptions {
  readonly scheduler?: Scheduler;
  readonly signal?: AbortSignal;
  readonly paceMs?: number;
}

/**
 * Play the steps in order, each narrating itself as it happens.
 *
 * Stops at the FIRST sign that the learner has taken over, and reports how far
 * it got. Never rolls anything back.
 */
export async function runSequence(
  steps: readonly PlaybackStep[],
  options: RunOptions = {},
): Promise<PlaybackOutcome> {
  const scheduler = options.scheduler ?? realScheduler;
  const reduced = agentStore.getState().reducedMotion;
  const pace = options.paceMs ?? (reduced ? PACE_REDUCED_MS : PACE_MS);

  // The baseline for interruption, captured once. Anything the learner does
  // after this moment raises the counter past it and stops the sequence at the
  // next check -- there is deliberately no way to "catch up" and resume, because
  // FR-048 says the learner taking over ends it.
  const baselineActivity = agentStore.getState().learnerActivity;
  const interrupted = () =>
    agentStore.getState().learnerActivity !== baselineActivity || options.signal?.aborted === true;

  agentStore.dispatch(playbackStarted({ totalSteps: steps.length }));

  let completed = 0;
  let stopped: StopReason = 'finished';
  let failure: PlaybackOutcome['failure'];

  for (const [index, step] of steps.entries()) {
    if (interrupted()) {
      stopped = 'interrupted';
      break;
    }

    const result = runStep(step);
    if (!result.ok) {
      stopped = 'step-failed';
      failure = { step: index, code: result.code, message: result.message };
      break;
    }

    // Narrated as it happens, never all at once at the end (FR-047).
    agentStore.dispatch(
      pushExplanation({
        text: step.explanation,
        tool: 'playback_deduction_sequence',
        now: Date.now(),
      }),
    );

    completed++;
    agentStore.dispatch(playbackAdvanced());

    const last = index === steps.length - 1;
    if (!last) {
      await scheduler.wait(pace, options.signal);
      if (interrupted()) {
        stopped = 'interrupted';
        break;
      }
    }
  }

  agentStore.dispatch(playbackEnded());

  return failure === undefined
    ? { stepsRequested: steps.length, stepsCompleted: completed, stoppedBecause: stopped }
    : { stepsRequested: steps.length, stepsCompleted: completed, stoppedBecause: stopped, failure };
}
