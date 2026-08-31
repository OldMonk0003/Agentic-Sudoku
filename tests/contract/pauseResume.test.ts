import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, pause, tick, enterDigitAt } from '@/state/actions';
import { agentStore, clearAnnotations } from '@/state/agentSession';
import { pauseTimer } from '@/tools/tools/pauseTimer';
import { resumeTimer } from '@/tools/tools/resumeTimer';
import { descriptors } from '@/tools/registry';
import { toCoord } from '@/engine/grid';

/**
 * Contract tests for `pause_timer` and `resume_timer` (FR-038 to FR-044).
 *
 * THE CARVE-OUT IS THE POINT OF THIS FILE.
 *
 * 002/FR-045 rejects every agent change while the board is paused. `resume_timer`
 * is the single exemption (003/FR-040), and it has to be: a tool whose only
 * purpose is to LEAVE the paused state cannot be barred by the paused state, or
 * `pause_timer` becomes a one-way door the agent can walk through and not back.
 *
 * It needs no special code -- the store's `resumeSession` already requires
 * `status === 'paused'`, and nothing in `defineWriteTool` gates on status. The
 * exemption exists by construction, and these tests pin it so it cannot be
 * closed by accident later.
 */

const EXPLANATION = 'You have been at this for twenty minutes, so a short break would do you good.';

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 60606));
  agentStore.dispatch(clearAnnotations());
});

describe('pause_timer', () => {
  it('is named, mutating, and requires narration', () => {
    expect(pauseTimer.name).toBe('pause_timer');
    expect(pauseTimer.readOnly).toBe(false);
    expect(pauseTimer.inputSchema.required).toContain('explanation');
  });

  it('takes no argument other than the explanation', () => {
    expect(Object.keys(pauseTimer.inputSchema.properties ?? {})).toEqual(['explanation']);
    expect(pauseTimer.inputSchema.additionalProperties).toBe(false);
  });

  it('stops the clock', async () => {
    store.dispatch(tick(5000));
    const result = await pauseTimer.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'paused', elapsed_ms: 5000 });
    expect(store.getState().status).toBe('paused');

    // The clock really stops: tick is refused while paused.
    store.dispatch(tick(9999));
    expect(store.getState().elapsedMs).toBe(5000);
  });

  it('is rejected on a board that is not running, naming the actual state (FR-041)', async () => {
    store.dispatch(pause());
    const result = await pauseTimer.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('wrong-status');
      expect(result.error.message).toMatch(/paused/i);
    }
  });

  it('rejects a missing explanation before the clock stops', async () => {
    const result = await pauseTimer.execute({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-required');
    expect(store.getState().status).toBe('playing');
  });

  it('adds no undo entry (FR-044)', async () => {
    const depth = store.getState().history.length;
    await pauseTimer.execute({ explanation: EXPLANATION });
    expect(store.getState().history.length).toBe(depth);
  });

  it('changes no cell (FR-044)', async () => {
    const before = JSON.stringify(store.getState().cells.map((c) => c.value));
    await pauseTimer.execute({ explanation: EXPLANATION });
    expect(JSON.stringify(store.getState().cells.map((c) => c.value))).toBe(before);
  });

  it('never throws, whatever it is handed', async () => {
    for (const hostile of [null, undefined, 42, 'text', [], { __proto__: { x: 1 } }]) {
      await expect(pauseTimer.execute(hostile)).resolves.toBeDefined();
    }
  });
});

describe('resume_timer', () => {
  it('is named, mutating, and requires narration', () => {
    expect(resumeTimer.name).toBe('resume_timer');
    expect(resumeTimer.readOnly).toBe(false);
    expect(resumeTimer.inputSchema.required).toContain('explanation');
  });

  /* THE CARVE-OUT (FR-040). If this ever fails, pause_timer has become a
     one-way door for the agent. */
  it('SUCCEEDS while the board is paused -- the one exemption from 002/FR-045', async () => {
    store.dispatch(tick(4000));
    store.dispatch(pause());
    expect(store.getState().status).toBe('paused');

    const result = await resumeTimer.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'resumed', elapsed_ms: 4000 });
    expect(store.getState().status).toBe('playing');
  });

  it('restarts the clock from where it stopped', async () => {
    store.dispatch(tick(7000));
    store.dispatch(pause());
    await resumeTimer.execute({ explanation: EXPLANATION });

    store.dispatch(tick(1000));
    expect(store.getState().elapsedMs).toBe(8000);
  });

  it('is rejected on a board that is not paused (FR-041)', async () => {
    const result = await resumeTimer.execute({ explanation: EXPLANATION });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('wrong-status');
      expect(result.error.message).toMatch(/not paused|already running|playing/i);
    }
  });

  it('adds no undo entry (FR-044)', async () => {
    store.dispatch(pause());
    const depth = store.getState().history.length;
    await resumeTimer.execute({ explanation: EXPLANATION });
    expect(store.getState().history.length).toBe(depth);
  });
});

/**
 * 002/FR-045 still holds for everything else. This is the other half of the
 * carve-out: exactly ONE tool is exempt, and it is asserted across the whole
 * surface rather than the tools we happened to think about.
 */
describe('a paused board still refuses every other write', () => {
  /*
    Tools that change GAME DATA -- a digit, a candidate, or the puzzle itself.
    These are what 002/FR-045 is about, and every one must be refused.
  */
  const GAME_WRITES: Record<string, Record<string, unknown>> = {
    fill_cell: { row: 1, col: 1, digit: 5, explanation: EXPLANATION },
    update_pencil_marks: {
      cells: [{ row: 5, col: 5, digits: [1, 2] }], explanation: EXPLANATION,
    },
    auto_fill_all_pencil_marks: { acknowledges_replacing_marks: true, explanation: EXPLANATION },
    switch_difficulty: { difficulty: 'hard', explanation: EXPLANATION },
  };

  /*
    Valid arguments for the REST of the write surface, so the sweep below
    measures what the paused board refuses rather than what the schema refuses.
    A tool rejected for a missing argument would look identical to one refused
    for status, which is the opposite of what is being asserted.
  */
  const OTHER_WRITES: Record<string, Record<string, unknown>> = {
    highlight_pattern_cells: {
      target_cells: [{ row: 4, col: 5 }], because_cells: [{ row: 4, col: 1 }],
      explanation: EXPLANATION,
    },
    draw_constraint_beams: {
      beams: [{ unit_type: 'row', unit_number: 3, digit: 6 }], explanation: EXPLANATION,
    },
    playback_deduction_sequence: {
      steps: [{ action: 'highlight', target_cells: [{ row: 1, col: 1 }], explanation: EXPLANATION }],
      explanation: EXPLANATION,
    },
  };

  const INPUTS = { ...GAME_WRITES, ...OTHER_WRITES };

  beforeEach(() => {
    // Something to lose, so switch_difficulty would otherwise reach generation.
    const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
    store.dispatch(enterDigitAt(coord, 4, 'player'));
    store.dispatch(pause());
  });

  for (const [name, input] of Object.entries(GAME_WRITES)) {
    it(`${name} is refused while paused (002/FR-045)`, async () => {
      const descriptor = descriptors.find((d) => d.name === name)!;
      const result = await descriptor.execute(input);

      expect(result.ok, `${name} must not change a paused board`).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('wrong-status');
    });
  }

  it('every READ still succeeds while paused', async () => {
    for (const descriptor of descriptors.filter((d) => d.readOnly)) {
      const result = await descriptor.execute({});
      expect(result.ok, `${descriptor.name} must still read a paused board`).toBe(true);
    }
  });

  it('resume_timer is the ONLY write that succeeds while paused', async () => {
    const succeeded: string[] = [];

    for (const descriptor of descriptors.filter((d) => !d.readOnly)) {
      const input = INPUTS[descriptor.name] ?? { explanation: EXPLANATION };
      const result = await descriptor.execute(input);
      if (result.ok) succeeded.push(descriptor.name);
      // Put the board back, in case one of them resumed it.
      if (store.getState().status === 'playing') store.dispatch(pause());
    }

    /*
      Only ANNOTATIONS and the ruler join resume_timer, and both belong there:
      an annotation marks the board without altering it, and the ruler is a view
      preference that changes no game data at all. Everything that touches a
      digit, a candidate, or the puzzle itself is refused.

      Annotations succeeding on a paused board is FEATURE 002'S EXISTING
      BEHAVIOUR, unchanged here. It is harmless -- the overlay hides them anyway
      -- and altering it would be a change to 002 smuggled into 003.

      `playback_deduction_sequence` is absent from this list, and that is
      correct: it is refused on a paused board, which is exactly what FR-042
      wants. Steps must never execute behind the overlay.
    */
    expect(succeeded.sort()).toEqual([
      'clear_visual_annotations',
      'draw_constraint_beams',
      'hide_coordinate_ruler',
      'highlight_pattern_cells',
      'resume_timer',
      'show_coordinate_ruler',
      'show_pattern_hint_toast',
    ]);
  });
});
