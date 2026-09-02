import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, enterDigitAt, pause, tick } from '@/state/actions';
import { agentStore, clearAnnotations } from '@/state/agentSession';
import { createSwitchDifficultyTool, switchDifficulty } from '@/tools/tools/switchDifficulty';
import { hasUniqueSolution } from '@/engine/uniqueness';
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
 * FEATURE 005 REPEALED THE CONFIRMATION this file was largely written around.
 * The gate block below is inverted rather than removed: what mattered then was
 * that the learner was asked, and what matters now is that they are NOT, and
 * that the call returns without waiting on anyone. Everything else here --
 * schema, unknown levels, status, generation, derived difficulty -- is unchanged
 * and still asserted.
 */

const EXPLANATION = 'You have cleared three easy boards quickly, so a harder one would suit you now.';

/** Generation that succeeds by loading a real puzzle through the game store. */
const succeeds = {
  generate: async (difficulty: 'easy' | 'medium' | 'hard') => {
    store.dispatch(newPuzzle(difficulty, 4242));
    return { ok: true as const };
  },
};

const failingGenerator = { generate: async () => ({ ok: false as const }) };

const tool = () => createSwitchDifficultyTool({ generator: succeeds });

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 1010));
  agentStore.dispatch(clearAnnotations());
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

describe('switch_difficulty: no confirmation (005/FR-020)', () => {
  /*
    Feature 005 REPEALED the gate this block used to test. It previously raised a
    prompt whenever the board had progress on it and waited up to sixty seconds
    for a click (002/FR-053, 003/FR-030).

    The assertions are inverted rather than deleted: what mattered then was that
    the learner was asked, and what matters now is that they are NOT -- and that
    the call returns without waiting on anyone.
  */
  it('replaces a board WITH progress, immediately and unasked', async () => {
    const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
    store.dispatch(enterDigitAt(coord, 4, 'player'));

    const tool = createSwitchDifficultyTool({ generator: succeeds });
    const result = await tool.execute({ difficulty: 'hard', explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'loaded' });
  });

  it('replaces a board with NO progress, exactly the same way', async () => {
    // There is no longer a distinction between the two cases, which is the
    // simplification the repeal bought.
    const tool = createSwitchDifficultyTool({ generator: succeeds });
    const result = await tool.execute({ difficulty: 'hard', explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'loaded' });
  });

  it('can no longer return a "declined" outcome at all', async () => {
    const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
    store.dispatch(enterDigitAt(coord, 4, 'player'));

    const tool = createSwitchDifficultyTool({ generator: succeeds });
    const result = await tool.execute({ difficulty: 'medium', explanation: EXPLANATION });

    // An agent written against 1.1.0 that handled 'declined' simply never sees
    // it again -- which is why this stays a MINOR bump (002/FR-010).
    if (result.ok) expect((result.data as Record<string, unknown>).outcome).not.toBe('declined');
  });

  it('does not promise a confirmation in its description (002/FR-006)', () => {
    // An agent reads this at runtime. A description that still said "the human
    // is asked first" would describe behaviour the site no longer has.
    expect(switchDifficulty.description.toLowerCase()).not.toMatch(/asked to confirm|confirm first|may decline/);
  });

  it('returns without waiting on a human (005/FR-023)', async () => {
    const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
    store.dispatch(enterDigitAt(coord, 4, 'player'));

    const tool = createSwitchDifficultyTool({ generator: succeeds });
    const started = Date.now();
    await tool.execute({ difficulty: 'medium', explanation: EXPLANATION });

    expect(Date.now() - started).toBeLessThan(1_000);
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

    const result = await createSwitchDifficultyTool({ generator: failingGenerator }).execute({
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
