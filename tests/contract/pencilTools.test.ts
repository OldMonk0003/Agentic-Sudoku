import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import {
  newPuzzle, selectCell, setInputMode, toggleCandidate, enterDigitAt, undo, pause,
} from '@/state/actions';
import { updatePencilMarks } from '@/tools/tools/updatePencilMarks';
import { autoFillAllPencilMarks } from '@/tools/tools/autoFillAllPencilMarks';
import { legalCandidates } from '@/engine/candidates';
import { toCoord, toIndex } from '@/engine/grid';

/**
 * Contract tests for the bookkeeping tools (FR-039 through FR-043).
 *
 * The interesting one is the ACKNOWLEDGEMENT flag: FR-041 says the explanation
 * must admit to replacing hand-written marks, and text cannot be checked for
 * meaning -- so consent is checked for presence instead.
 */

const EXPLANATION = 'Pencilling in every legal candidate so the naked pairs become visible to you.';

const emptyCoords = (n: number) =>
  store.getState().cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell.value === null)
    .slice(0, n)
    .map(({ index }) => toCoord(index));

const candidatesAt = (coord: { row: number; col: number }) =>
  [...store.getState().cells[toIndex(coord)]!.candidates].sort();

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 161803));
});

describe('update_pencil_marks', () => {
  it('is named, mutating, and requires narration', () => {
    expect(updatePencilMarks.name).toBe('update_pencil_marks');
    expect(updatePencilMarks.readOnly).toBe(false);
    expect(updatePencilMarks.inputSchema.required).toEqual(
      expect.arrayContaining(['cells', 'explanation']),
    );
  });

  it('sets exactly the digits listed, in exactly the cells listed', async () => {
    const [a, b] = emptyCoords(2);
    const result = await updatePencilMarks.execute({
      cells: [
        { ...a!, digits: [1, 4] },
        { ...b!, digits: [7] },
      ],
      explanation: EXPLANATION,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ cells_updated: 2 });
    expect(candidatesAt(a!)).toEqual([1, 4]);
    expect(candidatesAt(b!)).toEqual([7]);
  });

  it('erases marks when given an empty digit list', async () => {
    const [a] = emptyCoords(1);
    await updatePencilMarks.execute({ cells: [{ ...a!, digits: [1, 2] }], explanation: EXPLANATION });
    await updatePencilMarks.execute({ cells: [{ ...a!, digits: [] }], explanation: EXPLANATION });
    expect(candidatesAt(a!)).toEqual([]);
  });

  it('is one undo step for the whole call (FR-043)', async () => {
    const coords = emptyCoords(3);
    const depth = store.getState().history.length;

    await updatePencilMarks.execute({
      cells: coords.map((c) => ({ ...c, digits: [5] })),
      explanation: EXPLANATION,
    });
    expect(store.getState().history).toHaveLength(depth + 1);

    store.dispatch(undo());
    for (const coord of coords) expect(candidatesAt(coord)).toEqual([]);
  });

  it('changes NOTHING when one listed cell is invalid', async () => {
    const [a] = emptyCoords(1);
    const clue = toCoord(store.getState().cells.findIndex((c) => c.origin === 'clue'));

    const result = await updatePencilMarks.execute({
      cells: [{ ...a!, digits: [1] }, { ...clue, digits: [2] }],
      explanation: EXPLANATION,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('cell-is-clue');
    expect(candidatesAt(a!)).toEqual([]);
  });

  it('rejects a cell that already holds a digit', async () => {
    const [a] = emptyCoords(1);
    store.dispatch(enterDigitAt(a!, 5, 'player'));

    const result = await updatePencilMarks.execute({
      cells: [{ ...a!, digits: [1] }],
      explanation: EXPLANATION,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('cell-not-empty');
  });

  it('rejects duplicate digits and out-of-range coordinates at the schema', async () => {
    const [a] = emptyCoords(1);
    for (const cells of [
      [{ ...a!, digits: [1, 1] }],
      [{ row: 0, col: 1, digits: [1] }],
      [{ ...a!, digits: [10] }],
    ]) {
      const result = await updatePencilMarks.execute({ cells, explanation: EXPLANATION });
      expect(result.ok, JSON.stringify(cells)).toBe(false);
    }
  });

  it('never rejects its promise', async () => {
    for (const hostile of [null, undefined, 'x', 42, [], { cells: {} }]) {
      await expect(updatePencilMarks.execute(hostile)).resolves.toMatchObject({ ok: false });
    }
  });
});

describe('auto_fill_all_pencil_marks', () => {
  it('is named, mutating, and needs no cells', () => {
    expect(autoFillAllPencilMarks.name).toBe('auto_fill_all_pencil_marks');
    expect(autoFillAllPencilMarks.readOnly).toBe(false);
    expect(Object.keys(autoFillAllPencilMarks.inputSchema.properties!).sort()).toEqual([
      'acknowledges_replacing_marks',
      'explanation',
    ]);
  });

  it('writes exactly the legal digits into every empty cell (FR-040)', async () => {
    const values = store.getState().cells.map((c) => c.value);
    const result = await autoFillAllPencilMarks.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    for (let index = 0; index < 81; index++) {
      if (values[index] !== null) continue;
      expect(candidatesAt(toCoord(index))).toEqual([...legalCandidates(values, index)].sort());
    }
  });

  it('does not touch a filled cell', async () => {
    const [a] = emptyCoords(1);
    store.dispatch(enterDigitAt(a!, 5, 'player'));
    await autoFillAllPencilMarks.execute({ explanation: EXPLANATION });

    expect(store.getState().cells[toIndex(a!)]!.value).toBe(5);
    expect(candidatesAt(a!)).toEqual([]);
  });

  it('REFUSES to replace hand-written marks without an acknowledgement (FR-041)', async () => {
    const [a] = emptyCoords(1);
    store.dispatch(setInputMode('notes'));
    store.dispatch(selectCell(a!));
    store.dispatch(toggleCandidate(3, 'player'));

    const result = await autoFillAllPencilMarks.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('acknowledgement-required');
      expect(result.error.message).toContain('acknowledges_replacing_marks');
      expect(result.error.details).toMatchObject({ hand_written_cells: 1 });
    }
    // Their mark is untouched.
    expect(candidatesAt(a!)).toEqual([3]);
  });

  it('proceeds once acknowledged, and reports how many it replaced', async () => {
    const [a] = emptyCoords(1);
    store.dispatch(setInputMode('notes'));
    store.dispatch(selectCell(a!));
    store.dispatch(toggleCandidate(3, 'player'));

    const result = await autoFillAllPencilMarks.execute({
      acknowledges_replacing_marks: true,
      explanation: 'Replacing the marks you wrote by hand with the full set of legal candidates.',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ hand_written_marks_replaced: 1 });
  });

  it('needs no acknowledgement when the learner has written nothing', async () => {
    const result = await autoFillAllPencilMarks.execute({ explanation: EXPLANATION });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ hand_written_marks_replaced: 0 });
  });

  it('restores hand-written marks exactly on one undo (US4 scenario 4)', async () => {
    const [a, b] = emptyCoords(2);
    store.dispatch(setInputMode('notes'));
    store.dispatch(selectCell(a!));
    store.dispatch(toggleCandidate(2, 'player'));
    store.dispatch(selectCell(b!));
    store.dispatch(toggleCandidate(8, 'player'));

    const before = JSON.stringify(store.getState().cells.map((c) => [...c.candidates].sort()));

    await autoFillAllPencilMarks.execute({
      acknowledges_replacing_marks: true,
      explanation: 'Replacing the marks you wrote by hand with the full set of legal candidates.',
    });
    store.dispatch(undo());

    expect(JSON.stringify(store.getState().cells.map((c) => [...c.candidates].sort()))).toBe(before);
  });

  it('is rejected while the board is paused', async () => {
    store.dispatch(selectCell(emptyCoords(1)[0]!));
    store.dispatch(pause());

    const result = await autoFillAllPencilMarks.execute({ explanation: EXPLANATION });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('wrong-status');
  });

  it('rejects an unrecognised argument', async () => {
    const result = await autoFillAllPencilMarks.execute({ force: true, explanation: EXPLANATION });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unexpected-argument');
  });
});
