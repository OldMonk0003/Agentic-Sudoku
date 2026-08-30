import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, selectCell, enterDigit, toggleCandidate, setInputMode, pause } from '@/state/actions';
import { getBoardState } from '@/tools/tools/getBoardState';
import { TOOL_SURFACE_VERSION } from '@/tools/registry';

/**
 * Contract test for `get_board_state` (FR-024, FR-026, FR-027).
 *
 * Principle V requires one of these per tool, asserting the registered name, the
 * input schema including rejection of invalid input, the success result shape,
 * and the error result shape.
 */

const call = (input: unknown = {}) => getBoardState.execute(input);

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 4242));
});

describe('get_board_state — descriptor', () => {
  it('is named and declared read-only', () => {
    expect(getBoardState.name).toBe('get_board_state');
    expect(getBoardState.readOnly).toBe(true);
  });

  it('takes no arguments and rejects any', () => {
    expect(getBoardState.inputSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {},
    });
  });

  it('tells an agent the solution is unavailable, so it does not go looking', () => {
    expect(getBoardState.description.toLowerCase()).toContain('solution');
  });
});

describe('get_board_state — success', () => {
  it('returns all 81 cells with coordinates, value, origin, and candidates', async () => {
    const result = await call();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const data = result.data as { cells: Record<string, unknown>[] };
    expect(data.cells).toHaveLength(81);

    for (const cell of data.cells) {
      expect(cell).toHaveProperty('row');
      expect(cell).toHaveProperty('col');
      expect(cell).toHaveProperty('value');
      expect(cell).toHaveProperty('origin');
      expect(Array.isArray(cell.candidates)).toBe(true);
    }

    // Rows 1-9 top to bottom, columns 1-9 left to right (FR-007).
    expect(data.cells[0]).toMatchObject({ row: 1, col: 1 });
    expect(data.cells[80]).toMatchObject({ row: 9, col: 9 });
  });

  it('distinguishes clue, player, and agent digits (FR-024)', async () => {
    const empty = store.getState().cells.findIndex((c) => c.value === null);
    store.dispatch(selectCell({ row: Math.floor(empty / 9) + 1, col: (empty % 9) + 1 }));
    store.dispatch(enterDigit(5, 'player'));

    const result = await call();
    if (!result.ok) throw new Error('expected success');
    const cells = (result.data as { cells: { origin: string }[] }).cells;

    expect(cells.filter((c) => c.origin === 'clue').length).toBeGreaterThan(0);
    expect(cells.filter((c) => c.origin === 'player')).toHaveLength(1);
  });

  it('reports pencil candidates', async () => {
    const empty = store.getState().cells.findIndex((c) => c.value === null);
    store.dispatch(selectCell({ row: Math.floor(empty / 9) + 1, col: (empty % 9) + 1 }));
    store.dispatch(setInputMode('notes'));
    store.dispatch(toggleCandidate(3, 'player'));
    store.dispatch(toggleCandidate(7, 'player'));

    const result = await call();
    if (!result.ok) throw new Error('expected success');
    const cells = (result.data as { cells: { candidates: number[] }[] }).cells;

    expect(cells.find((c) => c.candidates.length > 0)!.candidates).toEqual([3, 7]);
  });

  it('reports difficulty, status, elapsed time, and emptiness', async () => {
    const result = await call();
    if (!result.ok) throw new Error('expected success');

    expect(result.data).toMatchObject({
      difficulty: 'easy',
      status: 'playing',
      is_complete: false,
    });
    expect(typeof (result.data as { elapsed_ms: number }).elapsed_ms).toBe('number');
    expect((result.data as { empty_count: number }).empty_count).toBeGreaterThan(0);
  });

  it('carries the surface version in the result (FR-010)', async () => {
    const result = await call();
    expect(result.surface_version).toBe(TOOL_SURFACE_VERSION);
    expect(result.tool).toBe('get_board_state');
  });

  it('still succeeds while the board is paused (FR-045)', async () => {
    store.dispatch(pause());
    const result = await call();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ status: 'paused' });
  });
});

describe('get_board_state — failure', () => {
  it('rejects an unrecognised argument rather than ignoring it', async () => {
    const result = await call({ verbose: true });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unexpected-argument');
    expect(result.error.message).toContain('verbose');
    expect(result.surface_version).toBe(TOOL_SURFACE_VERSION);
  });

  it('rejects hostile shapes without throwing', async () => {
    // Called directly rather than through `call`, whose default parameter would
    // turn `undefined` into `{}` -- which is what a conformant host does before
    // it ever reaches us, and so would test nothing.
    for (const hostile of [null, undefined, 'string', 42, [], true]) {
      const result = await getBoardState.execute(hostile);
      expect(result.ok, `${String(hostile)}`).toBe(false);
    }
  });

  it('never rejects its promise, whatever it is given', async () => {
    // FR-008: a thrown error reaches the agent as an opaque UnknownError, which
    // destroys the reason FR-009 requires. So handlers resolve. Always.
    await expect(call(Object.create(null))).resolves.toBeDefined();
    await expect(call({ nested: { deeply: { bad: [1, 2, 3] } } })).resolves.toBeDefined();
  });
});
