import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, enterDigitAt } from '@/state/actions';
import { agentStore, clearConfirmation, answerConfirmation, visibleConfirmation } from '@/state/agentSession';
import { createDrillTool, loadTechniquePractice } from '@/tools/tools/loadTechniquePractice';
import { DRILLABLE_TECHNIQUES } from '@/engine/drills';
import { toCoord } from '@/engine/grid';
import type { ConfirmationWaiter } from '@/tools/tools/loadTechniquePractice';

/**
 * Contract test for `load_technique_practice` (FR-052 through FR-055).
 *
 * The human wait is injected, so these resolve instantly. The REGISTERED tool
 * waits on the real banner -- which is the point of the recorded budget
 * exemption, and why the factory exists.
 */

const answering = (answer: 'accepted' | 'declined'): ConfirmationWaiter => ({
  async wait() {
    return answer;
  },
});

const EXPLANATION = 'Here is a board built around the pattern you just learned -- want to try it?';

const accepting = createDrillTool(answering('accepted'));
const declining = createDrillTool(answering('declined'));

const someProgress = () => {
  const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
  store.dispatch(enterDigitAt(coord, 5, 'player'));
};

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 8080));
  agentStore.dispatch(clearConfirmation());
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

  it('warns an agent that the human is asked first, and that it may take a minute', () => {
    const description = loadTechniquePractice.description.toLowerCase();
    expect(description).toContain('confirm');
    expect(description).toContain('minute');
  });
});

describe('load_technique_practice — the confirmation (FR-053)', () => {
  it('asks before replacing a board with progress on it', async () => {
    someProgress();
    const seen: string[] = [];

    const asking = createDrillTool({
      async wait(id) {
        const confirmation = visibleConfirmation(agentStore.getState(), Date.now());
        seen.push(confirmation?.prompt ?? 'none');
        expect(confirmation?.id).toBe(id);
        return 'declined';
      },
    });

    await asking.execute({ technique: DRILLABLE_TECHNIQUES[0], explanation: EXPLANATION });

    // The agent's own words are what the learner is asked.
    expect(seen).toEqual([EXPLANATION]);
  });

  it('DECLINING is an ordinary success, and the board is untouched', async () => {
    someProgress();
    const before = JSON.stringify(store.getState().cells.map((c) => c.value));

    const result = await declining.execute({
      technique: DRILLABLE_TECHNIQUES[0],
      explanation: EXPLANATION,
    });

    // ok: true. The learner keeping their board is the system working.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'declined' });
    expect(JSON.stringify(store.getState().cells.map((c) => c.value))).toBe(before);
  });

  it('loads the drill when the learner accepts, resetting timer and history', async () => {
    someProgress();

    const result = await accepting.execute({
      technique: DRILLABLE_TECHNIQUES[0],
      explanation: EXPLANATION,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'loaded' });

    expect(store.getState().history).toHaveLength(0);
    expect(store.getState().elapsedMs).toBe(0);
    expect(store.getState().status).toBe('playing');
  });

  it('does not ask at all when the board has no progress', async () => {
    let asked = false;
    const watching = createDrillTool({
      async wait() {
        asked = true;
        return 'declined';
      },
    });

    const result = await watching.execute({
      technique: DRILLABLE_TECHNIQUES[0],
      explanation: EXPLANATION,
    });

    expect(asked).toBe(false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'not-needed' });
  });

  it('clears the prompt from the screen once answered', async () => {
    someProgress();
    await accepting.execute({ technique: DRILLABLE_TECHNIQUES[0], explanation: EXPLANATION });
    expect(visibleConfirmation(agentStore.getState(), Date.now())).toBeNull();
  });
});

describe('load_technique_practice — the drill itself', () => {
  it('loads a puzzle that genuinely requires the named technique', async () => {
    for (const technique of DRILLABLE_TECHNIQUES) {
      store.dispatch(newPuzzle('easy', 4242));
      const result = await accepting.execute({ technique, explanation: EXPLANATION });

      expect(result.ok, technique).toBe(true);
      if (result.ok) expect(result.data).toMatchObject({ technique });
      // The rating is DERIVED on load, never taken on trust.
      expect(store.getState().puzzle!.difficulty).toBeDefined();
    }
  });

  it('needs no network: the drill is a bundled constant', async () => {
    // Structural rather than observational: there is nothing to fetch, because
    // drillFor returns an in-memory object (FR-055).
    const result = await accepting.execute({
      technique: DRILLABLE_TECHNIQUES[0],
      explanation: EXPLANATION,
    });
    expect(result.ok).toBe(true);
  });
});

describe('load_technique_practice — failure', () => {
  it('rejects a technique with no drill, LISTING the ones that have one (FR-054)', async () => {
    const result = await accepting.execute({ technique: 'swordfish', explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The schema enum catches it first, and the message still names what is
      // available -- which is what the agent needs to retry in one turn.
      expect(result.error.message).toMatch(/naked-pair|hidden-single|locked-candidates/);
    }
  });

  it('rejects a call with no explanation, and asks nothing of the learner', async () => {
    someProgress();
    const result = await accepting.execute({ technique: DRILLABLE_TECHNIQUES[0] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-required');
    expect(visibleConfirmation(agentStore.getState(), Date.now())).toBeNull();
  });

  it('never rejects its promise', async () => {
    for (const hostile of [null, undefined, 'x', 42, [], { technique: 7 }]) {
      await expect(accepting.execute(hostile)).resolves.toMatchObject({ ok: false });
    }
  });
});

describe('the real waiter observes the banner without importing the UI', () => {
  it('resolves when the learner answers', async () => {
    someProgress();

    const pending = loadTechniquePractice.execute({
      technique: DRILLABLE_TECHNIQUES[0],
      explanation: EXPLANATION,
    });

    // Let the tool put the prompt up, then answer it the way the banner does.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const confirmation = visibleConfirmation(agentStore.getState(), Date.now());
    expect(confirmation).not.toBeNull();
    agentStore.dispatch(answerConfirmation({ id: confirmation!.id, accepted: false }));

    const result = await pending;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'declined' });
  });
});
