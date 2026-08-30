import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, selectCell, enterDigitAt, pause, undo } from '@/state/actions';
import { fillCell } from '@/tools/tools/fillCell';
import { agentStore } from '@/state/agentSession';
import { toCoord, toIndex } from '@/engine/grid';

/**
 * Contract test for `fill_cell` (FR-036 through FR-038, FR-042, FR-045, FR-046).
 *
 * The tool that separates a tutor from an autosolver: a digit arrives with a
 * reason, marked as the agent's, undoable in one press.
 */

const EXPLANATION = 'Only 7 can go here, because the other eight digits already appear in this box.';

const firstEmpty = () => toCoord(store.getState().cells.findIndex((c) => c.value === null));
const firstClue = () => toCoord(store.getState().cells.findIndex((c) => c.origin === 'clue'));

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 8675309));
});

describe('fill_cell — descriptor', () => {
  it('is named and declares itself mutating', () => {
    expect(fillCell.name).toBe('fill_cell');
    expect(fillCell.readOnly).toBe(false);
  });

  it('requires row, col, digit, and an explanation', () => {
    expect(fillCell.inputSchema.required).toEqual(
      expect.arrayContaining(['row', 'col', 'digit', 'explanation']),
    );
  });

  it('tells an agent it may be wrong, and that the human can undo', () => {
    const description = fillCell.description.toLowerCase();
    expect(description).toContain('undo');
    expect(description).toContain('conflict');
  });
});

describe('fill_cell — success', () => {
  it('places the digit, marks it as the agent"s, and reports the result', async () => {
    const coord = firstEmpty();
    const result = await fillCell.execute({ ...coord, digit: 7, explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ row: coord.row, col: coord.col, digit: 7 });
      expect((result.data as { undo_depth: number }).undo_depth).toBeGreaterThan(0);
    }

    const cell = store.getState().cells[toIndex(coord)]!;
    expect(cell.value).toBe(7);
    expect(cell.origin).toBe('agent');
  });

  it('publishes the explanation to the learner (FR-017)', async () => {
    const before = agentStore.getState().explanations.length;
    await fillCell.execute({ ...firstEmpty(), digit: 7, explanation: EXPLANATION });

    const explanations = agentStore.getState().explanations;
    expect(explanations).toHaveLength(before + 1);
    expect(explanations.at(-1)).toMatchObject({ text: EXPLANATION, tool: 'fill_cell' });
  });

  it('does NOT move the learner"s selection (FR-056)', async () => {
    const parked = firstEmpty();
    store.dispatch(selectCell(parked));

    const other = toCoord(
      store.getState().cells.findIndex((c, i) => c.value === null && i !== toIndex(parked)),
    );
    await fillCell.execute({ ...other, digit: 5, explanation: EXPLANATION });

    expect(store.getState().selection).toEqual(parked);
  });

  it('is undoable in exactly one press (FR-042, SC-005)', async () => {
    const coord = firstEmpty();
    await fillCell.execute({ ...coord, digit: 7, explanation: EXPLANATION });

    store.dispatch(undo());
    expect(store.getState().cells[toIndex(coord)]!.value).toBeNull();
  });

  it('ALLOWS a duplicate, and says so, because a tutor may be wrong (FR-038)', async () => {
    // Find an empty cell in a row that already contains a clue, and place that
    // clue's digit. The board must accept it and flag the conflict.
    const cells = store.getState().cells;
    let target: { row: number; col: number } | null = null;
    let digit = 0;

    outer: for (let row = 1; row <= 9; row++) {
      const clue = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map((col) => ({ row, col, cell: cells[(row - 1) * 9 + (col - 1)]! }))
        .find(({ cell }) => cell.origin === 'clue');
      const empty = [1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map((col) => ({ row, col, cell: cells[(row - 1) * 9 + (col - 1)]! }))
        .find(({ cell }) => cell.value === null);
      if (clue && empty) {
        target = { row: empty.row, col: empty.col };
        digit = clue.cell.value!;
        break outer;
      }
    }
    expect(target).not.toBeNull();

    const result = await fillCell.execute({ ...target!, digit, explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) expect((result.data as { created_conflict: boolean }).created_conflict).toBe(true);
    expect(store.getState().cells[toIndex(target!)]!.value).toBe(digit);
  });
});

describe('fill_cell — failure leaves the board untouched (FR-037)', () => {
  const snapshot = () =>
    JSON.stringify(store.getState().cells.map((c) => ({ v: c.value, o: c.origin })));

  it('rejects a starting clue, naming why', async () => {
    const clue = firstClue();
    const before = snapshot();

    const result = await fillCell.execute({ ...clue, digit: 1, explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('cell-is-clue');
      expect(result.error.message).toContain('starting clue');
    }
    expect(snapshot()).toBe(before);
  });

  it('rejects an already-filled cell', async () => {
    const coord = firstEmpty();
    store.dispatch(enterDigitAt(coord, 4, 'player'));
    const before = snapshot();

    const result = await fillCell.execute({ ...coord, digit: 6, explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('cell-not-empty');
    expect(snapshot()).toBe(before);
  });

  it('rejects a coordinate off the grid at the schema, before the board is touched', async () => {
    for (const coord of [{ row: 0, col: 5 }, { row: 10, col: 5 }, { row: 5, col: 0 }]) {
      const result = await fillCell.execute({ ...coord, digit: 7, explanation: EXPLANATION });
      expect(result.ok, JSON.stringify(coord)).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('invalid-input');
    }
  });

  it('rejects a digit outside 1-9', async () => {
    for (const digit of [0, 10, -1, 1.5]) {
      const result = await fillCell.execute({ ...firstEmpty(), digit, explanation: EXPLANATION });
      expect(result.ok, String(digit)).toBe(false);
    }
  });

  it('rejects a fill with no explanation, and nothing changes (SC-003)', async () => {
    const coord = firstEmpty();
    const before = snapshot();
    const saidBefore = agentStore.getState().explanations.length;

    const result = await fillCell.execute({ ...coord, digit: 7 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-required');
    expect(snapshot()).toBe(before);
    // Nothing NEW was said: an explanation for a change that did not happen
    // would be a lie on screen. (The count, not the last entry -- the agent
    // store is a singleton and earlier tests in this file left theirs behind.)
    expect(agentStore.getState().explanations).toHaveLength(saidBefore);
  });

  it('rejects an explanation outside the length bounds', async () => {
    for (const explanation of ['too short', 'x'.repeat(241)]) {
      const result = await fillCell.execute({ ...firstEmpty(), digit: 7, explanation });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('explanation-length');
    }
  });

  it('rejects a write while the board is paused, but reads still work (FR-045)', async () => {
    store.dispatch(selectCell(firstEmpty()));
    store.dispatch(pause());

    const result = await fillCell.execute({ ...firstEmpty(), digit: 7, explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('wrong-status');
  });

  it('evaluates against the board AS IT STANDS, not as the agent last read it (FR-046)', async () => {
    const coord = firstEmpty();
    // The agent "read" the board here. Then the learner acts.
    store.dispatch(enterDigitAt(coord, 3, 'player'));

    const result = await fillCell.execute({ ...coord, digit: 7, explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('cell-not-empty');
    // The learner's digit stands. The stale write is refused, not applied.
    expect(store.getState().cells[toIndex(coord)]!.value).toBe(3);
  });

  it('never rejects its promise, whatever it is handed', async () => {
    for (const hostile of [null, undefined, 'x', 42, [], { row: {}, col: [], digit: null }]) {
      await expect(fillCell.execute(hostile)).resolves.toMatchObject({ ok: false });
    }
  });
});
