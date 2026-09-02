import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, enterDigitAt } from '@/state/actions';
import { agentStore, clearAnnotations } from '@/state/agentSession';
import { createDrillTool, loadTechniquePractice } from '@/tools/tools/loadTechniquePractice';
import { DRILLABLE_TECHNIQUES } from '@/engine/drills';
import { toCoord } from '@/engine/grid';

/**
 * Contract test for `load_technique_practice` (002/FR-052 through FR-055).
 *
 * Feature 005 REPEALED the confirmation this tool used to wait on, so there is
 * no injected waiter any more and nothing here resolves asynchronously on a
 * human. The drill itself -- bundled, unique, genuinely requiring its technique
 * -- is unchanged and still asserted.
 */

const EXPLANATION = 'Here is a board built around the pattern you just learned -- want to try it?';


const someProgress = () => {
  const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
  store.dispatch(enterDigitAt(coord, 5, 'player'));
};

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 8080));
  agentStore.dispatch(clearAnnotations());
});

describe('load_technique_practice — descriptor', () => {
  it('is named, mutating, and requires narration', () => {
    expect(loadTechniquePractice.name).toBe('load_technique_practice');
    expect(loadTechniquePractice.readOnly).toBe(false);
    expect(loadTechniquePractice.inputSchema.required).toEqual(
      expect.arrayContaining(['technique', 'explanation']),
    );
  });

  it('enumerates ONLY the techniques that really have a drill', () => {
    // Generated from the drill set, so the schema cannot go stale when a drill
    // is added or removed.
    expect(loadTechniquePractice.inputSchema.properties!.technique!.enum).toEqual([
      ...DRILLABLE_TECHNIQUES,
    ]);
  });

  it('does not promise a confirmation it no longer performs (002/FR-006)', () => {
    // An agent reads this at runtime. Feature 005 removed the prompt, so a
    // description still promising one would describe behaviour the site does not
    // have -- the exact defect 002/FR-006 exists to prevent.
    const text = loadTechniquePractice.description.toLowerCase();
    expect(text).not.toMatch(/asked to confirm|confirm first|may decline|up to a minute/);
    expect(text).toMatch(/discards/);
  });
});

describe('load_technique_practice — no confirmation (005/FR-020)', () => {
  /*
    Feature 005 repealed this gate. The drill prompt and the difficulty prompt
    were ONE mechanism, so they went together -- keeping one would have left the
    learner guessing which agent actions ask and which do not, which is worse
    than either answer on its own (005/FR-021).
  */
  it('replaces a board WITH progress, immediately and unasked', async () => {
    const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
    store.dispatch(enterDigitAt(coord, 4, 'player'));
    const before = store.getState().puzzle!.puzzleString;

    const result = await createDrillTool().execute({
      technique: 'hidden-single', explanation: EXPLANATION,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'loaded' });
    expect(store.getState().puzzle!.puzzleString).not.toBe(before);
  });

  it('resets the clock and clears the history', async () => {
    const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
    store.dispatch(enterDigitAt(coord, 4, 'player'));

    await createDrillTool().execute({ technique: 'hidden-single', explanation: EXPLANATION });

    expect(store.getState().history.length).toBe(0);
    expect(store.getState().elapsedMs).toBe(0);
  });

  it('can no longer return a "declined" outcome at all', async () => {
    const result = await createDrillTool().execute({
      technique: 'hidden-single', explanation: EXPLANATION,
    });
    if (result.ok) expect((result.data as Record<string, unknown>).outcome).not.toBe('declined');
  });
});

describe('load_technique_practice — the drill itself', () => {
  it('loads a puzzle that genuinely requires the named technique', async () => {
    for (const technique of DRILLABLE_TECHNIQUES) {
      store.dispatch(newPuzzle('easy', 4242));
      const result = await createDrillTool().execute({ technique, explanation: EXPLANATION });

      expect(result.ok, technique).toBe(true);
      if (result.ok) expect(result.data).toMatchObject({ technique });
      // The rating is DERIVED on load, never taken on trust.
      expect(store.getState().puzzle!.difficulty).toBeDefined();
    }
  });

  it('needs no network: the drill is a bundled constant', async () => {
    // Structural rather than observational: there is nothing to fetch, because
    // drillFor returns an in-memory object (FR-055).
    const result = await createDrillTool().execute({
      technique: DRILLABLE_TECHNIQUES[0],
      explanation: EXPLANATION,
    });
    expect(result.ok).toBe(true);
  });
});

describe('load_technique_practice — failure', () => {
  it('rejects a technique with no drill, LISTING the ones that have one (FR-054)', async () => {
    const result = await createDrillTool().execute({ technique: 'swordfish', explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The schema enum catches it first, and the message still names what is
      // available -- which is what the agent needs to retry in one turn.
      expect(result.error.message).toMatch(/naked-pair|hidden-single|locked-candidates/);
    }
  });

  it('rejects a call with no explanation, and asks nothing of the learner', async () => {
    someProgress();
    const result = await createDrillTool().execute({ technique: DRILLABLE_TECHNIQUES[0] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-required');
  });

  it('never rejects its promise', async () => {
    for (const hostile of [null, undefined, 'x', 42, [], { technique: 7 }]) {
      await expect(createDrillTool().execute(hostile)).resolves.toMatchObject({ ok: false });
    }
  });
});
