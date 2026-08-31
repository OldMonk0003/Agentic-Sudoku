import { store } from '@/state/store';
import {
  agentStore, askConfirmation, clearConfirmation, requestPuzzle,
  CONFIRMATION_TTL_MS,
} from '@/state/agentSession';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import type { Difficulty } from '@/state/types';
import type { ToolDescriptor } from '../types';

/**
 * `switch_difficulty` -- a fresh puzzle at a chosen level.
 *
 * THE ARCHITECTURAL POINT OF THIS FILE (research.md R1).
 *
 * This is the first tool that needs a GENERATED puzzle. Generation is
 * orchestrated by `requestPuzzle()` in `src/ui/puzzleLoader.ts`, which lives in
 * the UI layer because `Worker` is a browser API and the state layer must stay
 * DOM-free. `src/tools -> src/ui` is a LINT ERROR, not a convention:
 *
 *     Tools must not import UI. Tool handlers must not touch the DOM.
 *
 * So this tool does not call the generator. It RAISES A REQUEST on the agent
 * session store and waits for the game store to report the result. The UI is
 * subscribed and does the work. Neither layer imports the other, and the seam
 * already existed -- `requestDisconnect` runs in exactly this shape with the
 * arrow reversed.
 *
 * `load_technique_practice` never hit this wall because a drill is a bundled
 * constant it can dispatch straight into the store.
 *
 * TWO OTHER PROPERTIES, both shared with the drill tool:
 *
 *   - It WAITS FOR A HUMAN whenever there is progress to lose, so it is exempt
 *     from the 100 ms budget by recorded deviation. That exemption covers how
 *     long the AGENT waits; it is not a licence to freeze the board, which is
 *     why generation stays on the worker.
 *   - A DECLINE IS `ok: true`. The learner keeping their board is an ordinary
 *     outcome, and reporting it as an error would push an agent to retry the
 *     very thing they just refused.
 */

const NAME = 'switch_difficulty';

const LEVELS: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** How the tool learns the learner's answer without importing the UI. */
export interface ConfirmationWaiter {
  wait(id: string, timeoutMs: number): Promise<'accepted' | 'declined'>;
}

/** How the tool gets a puzzle generated without importing the UI. */
export interface PuzzleGenerator {
  generate(difficulty: Difficulty): Promise<{ ok: boolean }>;
}

export const storeWaiter: ConfirmationWaiter = {
  wait(id, timeoutMs) {
    return new Promise((resolve) => {
      const settle = (answer: 'accepted' | 'declined') => {
        clearTimeout(timer);
        unsubscribe();
        resolve(answer);
      };
      const timer = setTimeout(() => settle('declined'), timeoutMs);
      const unsubscribe = agentStore.subscribe(() => {
        const confirmation = agentStore.getState().confirmation;
        if (confirmation?.id !== id) return;
        if (confirmation.answer !== null) settle(confirmation.answer);
      });
    });
  },
};

/** How long to wait for a puzzle before calling it a failure. */
const GENERATION_TIMEOUT_MS = 15_000;

/**
 * Raise the request, then watch the GAME store for the outcome.
 *
 * Success is observed rather than returned: the board leaves `generating` with a
 * puzzle whose identity differs from the one that was there before. Failure
 * arrives as `puzzleFailures` ticking up, which `puzzleLoader` now raises when
 * it exhausts its retry budget (003/FR-036) -- without it, this could only ever
 * fail by timing out.
 */
export const storeGenerator: PuzzleGenerator = {
  generate(difficulty) {
    return new Promise((resolve) => {
      const before = store.getState().puzzle?.puzzleString ?? null;
      const failuresBefore = agentStore.getState().puzzleFailures;

      const settle = (ok: boolean) => {
        clearTimeout(timer);
        unsubscribeGame();
        unsubscribeAgent();
        resolve({ ok });
      };

      const timer = setTimeout(() => settle(false), GENERATION_TIMEOUT_MS);

      const unsubscribeGame = store.subscribe(() => {
        const session = store.getState();
        if (session.status === 'generating' || session.puzzle === null) return;
        if (session.puzzle.puzzleString === before) return;
        settle(true);
      });

      const unsubscribeAgent = agentStore.subscribe(() => {
        if (agentStore.getState().puzzleFailures > failuresBefore) settle(false);
      });

      agentStore.dispatch(requestPuzzle({ difficulty }));
    });
  },
};

export function createSwitchDifficultyTool(
  options: { waiter?: ConfirmationWaiter; generator?: PuzzleGenerator } = {},
): ToolDescriptor {
  const waiter = options.waiter ?? storeWaiter;
  const generator = options.generator ?? storeGenerator;

  return defineWriteTool({
    name: NAME,
    description: [
      'Load a brand-new Sudoku puzzle at a chosen difficulty, replacing the one on screen.',
      ADDRESSING,
      'If the human has made any progress on the current board, they are asked to confirm first and may',
      'decline -- a decline is a normal outcome, not an error, and nothing changes. If the board has no',
      'progress on it, no confirmation is needed.',
      'A new puzzle resets the clock to zero and clears the undo history, and every puzzle has exactly one',
      'solution. The board cannot be switched while it is paused.',
      'This call can take up to a minute, because it waits for the human to answer.',
      'Requires explanation: one or two sentences saying why you are changing the difficulty, which the',
      'human sees.',
    ].join(' '),

    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        difficulty: { type: 'string', enum: [...LEVELS] },
      },
      required: ['difficulty'],
    },

    async run(input) {
      const difficulty = input.difficulty as Difficulty;
      const session = store.getState();

      // FR-035. Permitted on a complete board -- there is no progress left to
      // lose -- but not on a paused one, where the learner has deliberately
      // stepped away from a board they intend to come back to.
      if (session.status === 'paused') {
        return {
          ok: false,
          code: 'wrong-status',
          message:
            'The board is paused, so it cannot be replaced right now. Resume it first, or read the board instead.',
        };
      }
      if (session.status === 'generating') {
        return {
          ok: false,
          code: 'wrong-status',
          message: 'A puzzle is still being generated. Wait for the board to settle, then try again.',
        };
      }

      const hasProgress =
        session.history.length > 0 ||
        session.cells.some((cell) => cell.origin !== 'clue' && cell.value !== null) ||
        session.cells.some((cell) => cell.candidates.size > 0);

      if (hasProgress) {
        agentStore.dispatch(
          askConfirmation({
            kind: 'difficulty',
            subject: difficulty,
            prompt: input.explanation,
            now: Date.now(),
          }),
        );

        // One slot: if a prompt was already waiting, ours was refused rather
        // than stacked, and the learner must never see two at once.
        const raised = agentStore.getState().confirmation;
        if (!raised || raised.kind !== 'difficulty' || raised.subject !== difficulty || raised.answer !== null) {
          return {
            ok: false,
            code: 'confirmation-pending',
            message:
              'The human is already being asked to confirm something else. Wait for that to be answered, then try again.',
          };
        }

        const answer = await waiter.wait(raised.id, CONFIRMATION_TTL_MS);
        agentStore.dispatch(clearConfirmation());

        if (answer === 'declined') {
          // An ordinary outcome, not an error (FR-030).
          return { ok: true, data: { outcome: 'declined', difficulty } };
        }
      }

      const generated = await generator.generate(difficulty);
      if (!generated.ok) {
        // FR-036: the learner's board is exactly as it was.
        return {
          ok: false,
          code: 'generation-failed',
          message:
            'No puzzle passing this site\'s own uniqueness check could be produced, so the board is unchanged. You can try again.',
          details: { difficulty },
        };
      }

      const next = store.getState();
      const puzzle = next.puzzle;
      if (!puzzle) {
        return {
          ok: false,
          code: 'generation-failed',
          message: 'The board did not settle on a new puzzle, so nothing was changed.',
        };
      }

      return {
        ok: true,
        data: {
          outcome: 'loaded',
          // The DERIVED rating, from the techniques the puzzle actually
          // requires -- never the label it was asked for, echoed back on trust.
          difficulty: puzzle.difficulty,
          requested_difficulty: difficulty,
          clue_count: puzzle.clues.filter((clue) => clue !== null).length,
          techniques_required: [...puzzle.techniquesRequired],
          elapsed_ms: next.elapsedMs,
          undo_depth: next.history.length,
        },
      };
    },
  });
}

export const switchDifficulty: ToolDescriptor = createSwitchDifficultyTool();
