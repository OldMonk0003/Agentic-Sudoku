import { defineWriteTool } from '../narration';
import { ADDRESSING, COORD_SCHEMA } from '../coordinates';
import { runSequence, validateSteps, type PlaybackStep, type Scheduler } from '../playback';
import type { ToolDescriptor } from '../types';

/**
 * `playback_deduction_sequence` -- a narrated chain of reasoning.
 *
 * The most powerful teaching form in the surface and the only tool that takes
 * seconds by design. It is EXEMPT from Principle IV's 100 ms tool-call budget by
 * recorded deviation (plan.md § Complexity Tracking): its duration is the
 * feature, and FR-049 requires it to report how many steps completed and why it
 * stopped -- which an early acknowledgement could not carry.
 *
 * What it does NOT do is lock anything. The board stays live throughout, and the
 * learner touching it ends the sequence immediately (FR-048, FR-051).
 */

const NAME = 'playback_deduction_sequence';

/** Injectable so tests drive a fake clock. Production leaves it undefined. */
export interface PlaybackToolOptions {
  readonly scheduler?: Scheduler;
  readonly paceMs?: number;
}

export function createPlaybackTool(options: PlaybackToolOptions = {}): ToolDescriptor {
  return defineWriteTool({
    name: NAME,
    description: [
      'Play a short walkthrough on the Sudoku board: a list of steps performed one after another, each',
      'with its own explanation shown as that step happens. Use it to teach a chain of reasoning.',
      ADDRESSING,
      'Each step has an action: "fill" places a digit (needs row, col, digit); "pencil" sets a cell\'s',
      'candidates (needs row, col, digits); "highlight" marks cells (needs cells); "beam" casts a ray',
      '(needs unit_type and unit_number).',
      'The human can stop it at any moment simply by clicking or typing on the board -- playback halts',
      'immediately, completed steps stay done and are NOT rolled back, and this call tells you how many',
      'finished and why it stopped. Each step remains a separate undo step for the human.',
      'This call takes several seconds to return, by design.',
    ].join(' '),

    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        steps: {
          type: 'array',
          minItems: 2,
          maxItems: 8,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              action: { type: 'string', enum: ['fill', 'pencil', 'highlight', 'beam'] },
              row: { type: 'integer', minimum: 1, maximum: 9 },
              col: { type: 'integer', minimum: 1, maximum: 9 },
              digit: { type: 'integer', minimum: 1, maximum: 9 },
              digits: {
                type: 'array',
                maxItems: 9,
                uniqueItems: true,
                items: { type: 'integer', minimum: 1, maximum: 9 },
              },
              cells: { type: 'array', maxItems: 81, uniqueItems: true, items: COORD_SCHEMA },
              unit_type: { type: 'string', enum: ['row', 'col', 'box'] },
              unit_number: { type: 'integer', minimum: 1, maximum: 9 },
              explanation: { type: 'string', minLength: 20, maxLength: 240 },
            },
            required: ['action', 'explanation'],
          },
        },
      },
      required: ['steps'],
    },

    async run(input, execOptions) {
      const steps = input.steps as PlaybackStep[];

      // Structural validation for EVERY step before the first one runs. A
      // sequence that would fail at step four is refused at step zero rather
      // than abandoning the learner halfway through a lesson.
      const problems = validateSteps(steps);
      if (problems.length > 0) {
        return {
          ok: false,
          code: 'invalid-input',
          message: `Step ${problems[0]!.step + 1}: ${problems[0]!.message}. Nothing was played.`,
          details: { problems },
        };
      }

      const outcome = await runSequence(steps, {
        ...(options.scheduler ? { scheduler: options.scheduler } : {}),
        ...(options.paceMs === undefined ? {} : { paceMs: options.paceMs }),
        ...(execOptions?.signal ? { signal: execOptions.signal } : {}),
      });

      const data = {
        steps_requested: outcome.stepsRequested,
        steps_completed: outcome.stepsCompleted,
        stopped_because: outcome.stoppedBecause,
      };

      // An INTERRUPTION IS SUCCESS. The learner taking control is the system
      // working exactly as designed, not an error to report as one.
      if (outcome.stoppedBecause === 'step-failed') {
        return {
          ok: false,
          code: 'playback-step-failed',
          message: `Stopped at step ${outcome.stepsCompleted + 1}: ${outcome.failure!.message}. The ${outcome.stepsCompleted} step(s) before it stand.`,
          details: data,
        };
      }

      return { ok: true, data };
    },
  });
}

export const playbackDeductionSequence: ToolDescriptor = createPlaybackTool();
