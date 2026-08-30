import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle } from '@/state/actions';
import { agentStore, clearAnnotations, visibleBeams, ANNOTATION_TTL_MS } from '@/state/agentSession';
import { drawConstraintBeams } from '@/tools/tools/drawConstraintBeams';

/**
 * Contract test for `draw_constraint_beams` (FR-029, FR-032, FR-033).
 */

const EXPLANATION = 'Row 3 and column 7 already contain a six, so their intersection cannot take one.';

const call = (input: unknown) => drawConstraintBeams.execute(input);

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 314159));
  agentStore.dispatch(clearAnnotations());
});

describe('draw_constraint_beams — descriptor', () => {
  it('is named, mutating, and requires narration', () => {
    expect(drawConstraintBeams.name).toBe('draw_constraint_beams');
    expect(drawConstraintBeams.readOnly).toBe(false);
    expect(drawConstraintBeams.inputSchema.required).toEqual(
      expect.arrayContaining(['beams', 'explanation']),
    );
  });

  it('tells an agent that beams stay readable where they cross', () => {
    expect(drawConstraintBeams.description).toMatch(/cross|readable/i);
  });
});

describe('draw_constraint_beams — success', () => {
  it('records one beam per unit named, with a bounded life', async () => {
    const result = await call({
      beams: [
        { unit_type: 'row', unit_number: 3, digit: 6 },
        { unit_type: 'col', unit_number: 7, digit: 6 },
      ],
      explanation: EXPLANATION,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ beams_drawn: 2, expires_in_ms: ANNOTATION_TTL_MS });

    const beams = visibleBeams(agentStore.getState(), Date.now());
    expect(beams).toHaveLength(2);
    expect(beams[0]).toMatchObject({ unit: { type: 'row', n: 3 }, digit: 6 });
    expect(beams[1]).toMatchObject({ unit: { type: 'col', n: 7 }, digit: 6 });
  });

  it('accepts a beam with no digit, for a purely positional constraint', async () => {
    const result = await call({
      beams: [{ unit_type: 'box', unit_number: 5 }],
      explanation: EXPLANATION,
    });

    expect(result.ok).toBe(true);
    expect(visibleBeams(agentStore.getState(), Date.now())[0]!.digit).toBeNull();
  });

  it('changes nothing on the board', async () => {
    const before = JSON.stringify(store.getState().cells.map((c) => c.value));
    await call({ beams: [{ unit_type: 'row', unit_number: 3 }], explanation: EXPLANATION });
    expect(JSON.stringify(store.getState().cells.map((c) => c.value))).toBe(before);
  });
});

describe('draw_constraint_beams — failure', () => {
  it('rejects an empty beam list', async () => {
    const result = await call({ beams: [], explanation: EXPLANATION });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-input');
  });

  it('rejects an unknown unit type', async () => {
    const result = await call({
      beams: [{ unit_type: 'diagonal', unit_number: 1 }],
      explanation: EXPLANATION,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/row, col, box/);
  });

  it('rejects a unit number outside 1-9', async () => {
    for (const n of [0, 10, -1, 2.5]) {
      const result = await call({
        beams: [{ unit_type: 'row', unit_number: n }],
        explanation: EXPLANATION,
      });
      expect(result.ok, String(n)).toBe(false);
    }
  });

  it('rejects narration failures before drawing anything', async () => {
    const result = await call({ beams: [{ unit_type: 'row', unit_number: 3 }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-required');
    expect(visibleBeams(agentStore.getState(), Date.now())).toHaveLength(0);
  });

  it('never rejects its promise', async () => {
    for (const hostile of [null, undefined, 'x', 42, [], { beams: 'row' }]) {
      await expect(call(hostile)).resolves.toMatchObject({ ok: false });
    }
  });
});
