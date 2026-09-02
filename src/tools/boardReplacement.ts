import { store } from '@/state/store';
import { agentStore, requestPuzzle } from '@/state/agentSession';
import type { Difficulty } from '@/state/types';

/**
 * Replacing the board, for every tool that does it.
 *
 * THREE TOOLS REPLACE THE BOARD -- `switch_difficulty`, `restart_puzzle`, and
 * `load_technique_practice` (which loads a bundled drill rather than generating,
 * so it needs only the guard below). With feature 005's confirmation repealed,
 * the first two differ ONLY in where the difficulty comes from, so the waiting
 * half lives here once rather than twice (005/research.md R6).
 *
 * THE ARCHITECTURAL POINT, unchanged from 003. Generation is orchestrated by
 * `requestPuzzle()` in `src/ui/puzzleLoader.ts`, which lives in the UI layer
 * because `Worker` is a browser API. `src/tools -> src/ui` is a LINT ERROR, not
 * a convention:
 *
 *     Tools must not import UI. Tool handlers must not touch the DOM.
 *
 * So nothing here calls the generator. It RAISES A REQUEST on the agent session
 * store and watches the game store for the outcome. The UI is subscribed and
 * does the work. Neither layer imports the other.
 */

/** How long to wait for a puzzle before calling it a failure. */
const GENERATION_TIMEOUT_MS = 15_000;

export type ReplacementRefusal = 'paused' | 'generating';

/**
 * Whether the board may be replaced at all.
 *
 * Permitted on a COMPLETE board -- there is no progress left to lose -- but not
 * on a PAUSED one, where the learner has deliberately stepped away from a board
 * they intend to come back to (003/FR-035, 005/FR-009).
 */
export function refuseReplacement(): ReplacementRefusal | null {
  const status = store.getState().status;
  if (status === 'paused') return 'paused';
  if (status === 'generating') return 'generating';
  return null;
}

export const REFUSAL_MESSAGES: Record<ReplacementRefusal, string> = {
  paused:
    'The board is paused, so it cannot be replaced right now. Resume it first, or read the board instead.',
  generating: 'A puzzle is still being generated. Wait for the board to settle, then try again.',
};

export interface PuzzleGenerator {
  generate(difficulty: Difficulty): Promise<{ ok: boolean }>;
}

/**
 * Raise the request, then watch the GAME store for the outcome.
 *
 * Success is OBSERVED rather than returned: the board leaves `generating` with a
 * puzzle whose identity differs from the one that was there before. Failure
 * arrives as `puzzleFailures` ticking up, which `puzzleLoader` raises when it
 * exhausts its retry budget (003/FR-036) -- without it, this could only ever
 * fail by timing out, and the learner's board would look untouched for the wrong
 * reason.
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
