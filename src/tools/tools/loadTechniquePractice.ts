import { store } from '@/state/store';
import { loadPuzzle } from '@/state/actions';
import {
  agentStore, askConfirmation, clearConfirmation, CONFIRMATION_TTL_MS,
} from '@/state/agentSession';
import { DRILLABLE_TECHNIQUES, drillFor } from '@/engine/drills';
import { hasUniqueSolution } from '@/engine/uniqueness';
import { parsePuzzleString, toPuzzleString } from '@/engine/puzzleString';
import { rateDifficulty } from '@/engine/rating';
import { defineWriteTool } from '../narration';
import { ADDRESSING } from '../coordinates';
import type { ToolDescriptor } from '../types';

/**
 * `load_technique_practice` -- the only agent action that discards the learner's
 * work, and therefore the only one behind a confirmation (FR-053).
 *
 * Two things make this different from every other tool:
 *
 *   - It WAITS FOR A HUMAN, so it is exempt from the 100 ms budget by recorded
 *     deviation. An unanswered prompt resolves as `declined` after a minute
 *     rather than hanging the agent's call forever.
 *   - A DECLINE IS `ok: true`. The learner keeping their board is an ordinary
 *     outcome, not an error, and reporting it as one would push an agent to
 *     retry something the learner just refused.
 *
 * The drill is re-verified for uniqueness on the way in (Principle IV applies to
 * a bundled puzzle exactly as to a generated one) and its difficulty is
 * re-derived rather than stored, exactly as 001 does on restore.
 */

const NAME = 'load_technique_practice';

/** How the tool learns the learner's answer without importing the UI. */
export interface ConfirmationWaiter {
  wait(id: string, timeoutMs: number): Promise<'accepted' | 'declined'>;
}

/**
 * Watch the agent store until the banner is answered or times out.
 *
 * The UI dispatches the answer; this observes it. Neither imports the other.
 */
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

export function createDrillTool(waiter: ConfirmationWaiter = storeWaiter): ToolDescriptor {
  return defineWriteTool({
    name: NAME,
    description: [
      'Replace the current Sudoku puzzle with a curated one that drills a specific technique.',
      ADDRESSING,
      "Because this discards the human's current board, they are asked to confirm first -- if they",
      'decline, or simply ignore the prompt, this returns normally with outcome "declined" and nothing',
      'changes. If the board has no progress on it, no confirmation is needed.',
      `Drills are available for: ${DRILLABLE_TECHNIQUES.join(', ')}.`,
      'Every drill has exactly one solution and genuinely requires its technique -- it cannot be finished',
      'without it. This call can take up to a minute, because it waits for the human to answer.',
    ].join(' '),

    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        technique: { type: 'string', enum: [...DRILLABLE_TECHNIQUES] },
      },
      required: ['technique'],
    },

    async run(input) {
      const technique = input.technique as string;
      const drill = drillFor(technique);

      if (!drill) {
        // FR-054: name what IS available, so the agent can correct itself in one
        // turn rather than guessing.
        return {
          ok: false,
          code: 'unknown-technique',
          message: `There is no practice drill for "${technique}". Available: ${DRILLABLE_TECHNIQUES.join(', ')}.`,
          details: { available: [...DRILLABLE_TECHNIQUES] },
        };
      }

      const clues = parsePuzzleString(drill.puzzleString);

      // A bundled puzzle earns no exemption from the uniqueness rule. Asked
      // through `hasUniqueSolution` rather than the solver, so this layer is
      // never in a position to hold a completed grid at all.
      if (!hasUniqueSolution(clues)) {
        return {
          ok: false,
          code: 'internal-error',
          message: 'That drill failed this site\'s own uniqueness check and was not loaded.',
        };
      }

      const session = store.getState();
      const hasProgress =
        session.history.length > 0 ||
        session.cells.some((cell) => cell.origin !== 'clue' && cell.value !== null) ||
        session.cells.some((cell) => cell.candidates.size > 0);

      if (hasProgress) {
        agentStore.dispatch(
          askConfirmation({
            technique,
            prompt: input.explanation,
            now: Date.now(),
          }),
        );
        const id = agentStore.getState().confirmation!.id;

        const answer = await waiter.wait(id, CONFIRMATION_TTL_MS);
        agentStore.dispatch(clearConfirmation());

        if (answer === 'declined') {
          // An ordinary outcome, not an error (FR-053).
          return { ok: true, data: { outcome: 'declined', technique } };
        }
      }

      // Difficulty is DERIVED, never taken on trust from a stored label.
      const rating = rateDifficulty(clues);
      store.dispatch(
        loadPuzzle({
          clues,
          difficulty: rating.difficulty,
          puzzleString: toPuzzleString(clues),
          techniquesRequired: rating.techniquesRequired,
        }),
      );

      return {
        ok: true,
        data: {
          outcome: hasProgress ? 'loaded' : 'not-needed',
          technique,
          difficulty: rating.difficulty,
        },
      };
    },
  });
}

export const loadTechniquePractice: ToolDescriptor = createDrillTool();
