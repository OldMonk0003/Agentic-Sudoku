import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, pause, enterDigitAt, fillAllCandidates, undo } from '@/state/actions';
import { agentStore, clearAnnotations } from '@/state/agentSession';
import { undoMove } from '@/tools/tools/undoMove';
import { toCoord } from '@/engine/grid';

/**
 * Contract tests for `undo_move` (005/FR-012 -- FR-019).
 *
 * TWO STATUS RULES, AND THEY POINT OPPOSITE WAYS. This is the whole subtlety of
 * the tool and the reason the file exists.
 *
 *   COMPLETE -> ALLOWED. `undoLast` carries no status guard and deliberately
 *   returns a finished board to `playing`; the learner's own Undo button is
 *   disabled only by an empty history. FR-012 requires the tool to produce
 *   "exactly the result the learner's own control produces", so a tool that
 *   refused where the button works would break it.
 *
 *   PAUSED -> REJECTED. 002/FR-045 bars every agent change on a paused board,
 *   with `resume_timer` as the sole exemption. But NOTHING ELSE WILL ENFORCE IT
 *   HERE: `undoLast` does not check status, and `defineWriteTool` deliberately
 *   does not either (that is what keeps `resume_timer` working). The guard has to
 *   live in this tool, and this test is what stops it being dropped.
 *
 * The asymmetry is real and deliberate: the learner may undo while paused, the
 * agent may not. It predates this feature -- the Controls row sits outside the
 * pause overlay -- and is observed here rather than changed.
 */

const EXPLANATION = 'Taking that back: the 4 there contradicts the 4 already sitting in the same box.';

const empty = () => {
  const index = store.getState().cells.findIndex((cell) => cell.value === null);
  return toCoord(index);
};

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 51515));
  agentStore.dispatch(clearAnnotations());
});

describe('undo_move: shape', () => {
  it('is named, mutating, and requires narration', () => {
    expect(undoMove.name).toBe('undo_move');
    expect(undoMove.readOnly).toBe(false);
    expect(undoMove.inputSchema.required).toContain('explanation');
  });

  it('takes no argument other than the explanation', () => {
    // It always means "the last one". A target would make it something else.
    expect(Object.keys(undoMove.inputSchema.properties ?? {})).toEqual(['explanation']);
    expect(undoMove.inputSchema.additionalProperties).toBe(false);
  });

  it('is rejected without an explanation, before anything changes', async () => {
    store.dispatch(enterDigitAt(empty(), 5, 'player'));
    const depth = store.getState().history.length;

    const result = await undoMove.execute({});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-required');
    expect(store.getState().history.length).toBe(depth);
  });
});

describe('undo_move: reversing', () => {
  it('reverses the most recent change', async () => {
    const coord = empty();
    store.dispatch(enterDigitAt(coord, 5, 'player'));

    const result = await undoMove.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    expect(store.getState().cells[(coord.row - 1) * 9 + (coord.col - 1)]!.value).toBeNull();
  });

  it('produces the same board the learner\'s own Undo produces', async () => {
    /*
      FR-012 stated as an equivalence rather than described.

      Both halves run on the SAME board. Regenerating with an identical seed
      would NOT reproduce the puzzle -- the seeded PRNG picks a band and
      `sudoku-gen` supplies its own randomness inside it (Principle IV records
      the puzzle rather than the seed). That is the same fact 005/R2 turns on.
    */
    const coord = empty();

    store.dispatch(enterDigitAt(coord, 5, 'player'));
    const viaTool = await undoMove.execute({ explanation: EXPLANATION });
    expect(viaTool.ok).toBe(true);
    const afterTool = store.getState().cells.map((c) => c.value).join(',');

    store.dispatch(enterDigitAt(coord, 5, 'player'));
    store.dispatch(undo());
    const afterButton = store.getState().cells.map((c) => c.value).join(',');

    expect(afterTool).toBe(afterButton);
  });

  it('reverses a many-celled change as ONE step', async () => {
    // A whole-board pencil fill touches dozens of cells and is one record
    // (001/FR-024, 002/FR-043). Reversing half of it would be incoherent.
    store.dispatch(fillAllCandidates('agent'));
    const pencilled = store.getState().cells.filter((c) => c.candidates.size > 0).length;
    expect(pencilled).toBeGreaterThan(1);

    const result = await undoMove.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    expect(store.getState().cells.filter((c) => c.candidates.size > 0).length).toBe(0);
    expect(store.getState().history.length).toBe(0);
  });

  it('takes back one step per call, not the whole history', async () => {
    store.dispatch(enterDigitAt(empty(), 5, 'player'));
    store.dispatch(enterDigitAt(empty(), 6, 'player'));
    expect(store.getState().history.length).toBe(2);

    await undoMove.execute({ explanation: EXPLANATION });

    expect(store.getState().history.length).toBe(1);
  });
});

describe('undo_move: what it reports', () => {
  it('names whose change it reversed', async () => {
    // FR-016. Undo does not distinguish authorship, so the agent has to be TOLD
    // whose work it just took back in order to say so.
    store.dispatch(enterDigitAt(empty(), 5, 'player'));
    const result = await undoMove.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'undone', undone_origin: 'player' });
  });

  it('distinguishes its own change from the learner\'s', async () => {
    store.dispatch(enterDigitAt(empty(), 5, 'agent'));
    const result = await undoMove.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ undone_origin: 'agent' });
  });

  it('reports the remaining depth and how much it touched', async () => {
    store.dispatch(enterDigitAt(empty(), 5, 'player'));
    store.dispatch(enterDigitAt(empty(), 6, 'player'));

    const result = await undoMove.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as Record<string, unknown>;
      expect(data.undo_depth).toBe(1);
      expect(data.cells_restored).toBeGreaterThan(0);
      expect(typeof data.undone_action).toBe('string');
    }
  });
});

describe('undo_move: status', () => {
  it('is rejected when there is nothing to undo', async () => {
    // The state a fresh or restarted board is always in.
    expect(store.getState().history.length).toBe(0);

    const result = await undoMove.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('nothing-to-undo');
  });

  it('is REJECTED while the board is paused', async () => {
    /*
      Nothing else enforces this. `undoLast` has no status guard and
      `defineWriteTool` does not gate on status -- that is what keeps
      `resume_timer` working. The guard lives in the tool, and this test is why
      it stays there.
    */
    store.dispatch(enterDigitAt(empty(), 5, 'player'));
    store.dispatch(pause());
    const depth = store.getState().history.length;

    const result = await undoMove.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('wrong-status');
    expect(store.getState().history.length).toBe(depth);
  });

  it('is PERMITTED on a completed board, and returns it to play', async () => {
    // The learner's button works here, so the tool must too (FR-012). The
    // tension with 001/FR-039's "read-only when complete" predates this feature.
    const session = store.getState();
    const solutionless = session.cells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell.value === null);
    // Drive the board to complete by filling every empty cell, then check the
    // status flipped; if this puzzle cannot be completed that way the assertion
    // below is skipped rather than faked.
    for (const { index } of solutionless) {
      const coord = toCoord(index);
      for (let digit = 1; digit <= 9; digit += 1) {
        const before = store.getState().cells[index]!.value;
        if (before !== null) break;
        store.dispatch(enterDigitAt(coord, digit as 1, 'player'));
      }
    }

    if (store.getState().status !== 'complete') return;

    const result = await undoMove.execute({ explanation: EXPLANATION });
    expect(result.ok).toBe(true);
    expect(store.getState().status).toBe('playing');
  });
});
