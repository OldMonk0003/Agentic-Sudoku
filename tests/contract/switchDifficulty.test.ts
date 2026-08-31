import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, enterDigitAt, pause, tick } from '@/state/actions';
import { agentStore, clearConfirmation, answerConfirmation, askConfirmation } from '@/state/agentSession';
import { createSwitchDifficultyTool } from '@/tools/tools/switchDifficulty';
import { hasUniqueSolution } from '@/engine/uniqueness';
import { parsePuzzleString } from '@/engine/puzzleString';
import { toCoord } from '@/engine/grid';

/**
 * Contract tests for `switch_difficulty` (FR-028 to FR-037).
 *
 * The tool is built through a factory so the test can inject both collaborators
 * it waits on -- the learner's answer and the puzzle generation -- exactly as
 * `load_technique_practice` does. Without that, every test here would take a
 * real minute or need a real Worker.
 *
 * THE SHAPE WORTH READING TWICE: a DECLINE IS `ok: true`. The learner keeping
 * their board is an ordinary outcome, not a fault, and reporting it as an error
 * would push an agent to retry something the learner just refused.
 */

const EXPLANATION = 'You have cleared three easy boards quickly, so a harder one would suit you now.';

/** Accepts immediately, so the confirmation path is exercised without waiting. */
const accepting = { wait: async () => 'accepted' as const };
const declining = { wait: async () => 'declined' as const };

/** Generation that succeeds by loading a real puzzle through the game store. */
const generator = {
  generate: async (difficulty: 'easy' | 'medium' | 'hard') => {
    store.dispatch(newPuzzle(difficulty, 4242));
    return { ok: true as const };
  },
};

const failingGenerator = { generate: async () => ({ ok: false as const }) };

const tool = (opts: Partial<Parameters<typeof createSwitchDifficultyTool>[0]> = {}) =>
  createSwitchDifficultyTool({ waiter: accepting, generator, ...opts });

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 1010));
  agentStore.dispatch(clearConfirmation());
});

/** Put something on the board worth losing. */
function makeProgress() {
  const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
  store.dispatch(enterDigitAt(coord, 5, 'player'));
}

describe('switch_difficulty: shape', () => {
  it('is named, mutating, and requires narration', () => {
    const t = tool();
    expect(t.name).toBe('switch_difficulty');
    expect(t.readOnly).toBe(false);
    expect(t.inputSchema.required).toContain('explanation');
    expect(t.inputSchema.required).toContain('difficulty');
  });

  it('bounds difficulty to the three levels the game offers', () => {
    expect(tool().inputSchema.properties!.difficulty!.enum).toEqual(['easy', 'medium', 'hard']);
  });

  it('rejects an unrecognised argument', async () => {
    const result = await tool().execute({ difficulty: 'hard', explanation: EXPLANATION, seed: 9 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unexpected-argument');
  });

  it('rejects a missing explanation before anything changes', async () => {
    const before = store.getState().puzzle!.puzzleString;
    const result = await tool().execute({ difficulty: 'hard' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-required');
    expect(store.getState().puzzle!.puzzleString).toBe(before);
  });

  it('never throws, whatever it is handed', async () => {
    for (const hostile of [null, undefined, 42, 'text', [], { __proto__: { x: 1 } }]) {
      await expect(tool().execute(hostile)).resolves.toBeDefined();
    }
  });
});

describe('switch_difficulty: unknown levels', () => {
  it('rejects a level the game does not offer, and lists the ones it does (FR-029)', async () => {
    const before = store.getState().puzzle!.puzzleString;
    const result = await tool().execute({ difficulty: 'expert', explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The schema catches this first, and that is correct -- but the agent must
      // still be able to see what IS available.
      expect(result.error.message.toLowerCase()).toMatch(/easy|medium|hard/);
    }
    expect(store.getState().puzzle!.puzzleString).toBe(before);
  });
});

describe('switch_difficulty: the confirmation gate', () => {
  it('loads without asking when the board has no progress (FR-031)', async () => {
    const result = await tool().execute({ difficulty: 'hard', explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'loaded' });
    // Nothing was ever put on screen.
    expect(agentStore.getState().confirmation).toBeNull();
  });

  it('asks first when there is progress to lose (FR-030)', async () => {
    makeProgress();
    const result = await tool().execute({ difficulty: 'hard', explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'loaded' });
  });

  it('reports a decline as an ORDINARY outcome, not an error (FR-030)', async () => {
    makeProgress();
    const before = store.getState().puzzle!.puzzleString;

    const result = await tool({ waiter: declining }).execute({
      difficulty: 'hard', explanation: EXPLANATION,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'declined', difficulty: 'hard' });
    // Bit-for-bit unchanged.
    expect(store.getState().puzzle!.puzzleString).toBe(before);
  });

  it('refuses when another confirmation is already waiting', async () => {
    makeProgress();
    agentStore.dispatch(askConfirmation({
      kind: 'drill', subject: 'naked-pair',
      prompt: 'A drill on naked pairs would cement what you just worked out on your own.',
      now: Date.now(),
    }));

    const result = await tool().execute({ difficulty: 'hard', explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('confirmation-pending');
  });
});

describe('switch_difficulty: board status', () => {
  it('is rejected while the board is paused (FR-035)', async () => {
    store.dispatch(pause());
    const before = store.getState().puzzle!.puzzleString;

    const result = await tool().execute({ difficulty: 'hard', explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('wrong-status');
    expect(store.getState().puzzle!.puzzleString).toBe(before);
  });
});

describe('switch_difficulty: generation', () => {
  it('reports a failed generation and leaves the board alone (FR-036)', async () => {
    const before = store.getState().puzzle!.puzzleString;

    const result = await tool({ generator: failingGenerator }).execute({
      difficulty: 'hard', explanation: EXPLANATION,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('generation-failed');
    expect(store.getState().puzzle!.puzzleString).toBe(before);
  });

  it('resets the clock and clears undo history (FR-033)', async () => {
    makeProgress();
    store.dispatch(tick(30_000));

    await tool().execute({ difficulty: 'hard', explanation: EXPLANATION });

    expect(store.getState().elapsedMs).toBe(0);
    expect(store.getState().history).toHaveLength(0);
  });

  it('reports the new board without revealing its solution (FR-045)', async () => {
    const result = await tool().execute({ difficulty: 'hard', explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const serialised = JSON.stringify(result.data);
      expect(serialised).not.toMatch(/\d{40,}/);
      expect(serialised).not.toMatch(/solution/i);
      expect(result.data).toHaveProperty('clue_count');
    }
  });

  it('loads a puzzle with exactly one solution (FR-032)', async () => {
    await tool().execute({ difficulty: 'hard', explanation: EXPLANATION });
    expect(hasUniqueSolution(store.getState().puzzle!.clues)).toBe(true);
  });

  it('reports a DERIVED difficulty, never the one it was asked for on trust', async () => {
    const result = await tool().execute({ difficulty: 'hard', explanation: EXPLANATION });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Whatever the generator produced, the reported rating comes from the
      // techniques the puzzle actually requires (Principle IV).
      expect((result.data as { difficulty: string }).difficulty).toBe(
        store.getState().puzzle!.difficulty,
      );
    }
  });
});
