import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, enterDigitAt, pause, tick } from '@/state/actions';
import { preferencesStore, hideRuler } from '@/state/preferences';
import { showCoordinateRuler } from '@/tools/tools/showCoordinateRuler';
import { hideCoordinateRuler } from '@/tools/tools/hideCoordinateRuler';
import { toCoord } from '@/engine/grid';
// Read the version rather than hard-coding it: a literal here has to be chased
// down on every MINOR bump, which is exactly what feature 005 tripped over.
import { TOOL_SURFACE_VERSION } from '@/tools/registry';

/**
 * Contract tests for the two ruler tools (FR-006 to FR-016).
 *
 * The property this file leans hardest on: the ruler changes what the board
 * LOOKS like and nothing about what it IS. It works while paused, works while
 * complete, and is idempotent in both directions -- because the learner has
 * their own toggle (FR-013), so neither actor's view of the ruler is
 * authoritative over the other's.
 */

const EXPLANATION = 'Numbering the grid so you can name a cell to me without counting squares first.';

const boardSnapshot = () => {
  const game = store.getState();
  return JSON.stringify({
    cells: game.cells.map((c) => ({ v: c.value, o: c.origin, c: [...c.candidates] })),
    elapsedMs: game.elapsedMs,
    history: game.history.length,
    selection: game.selection,
    status: game.status,
  });
};

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 90210));
  preferencesStore.dispatch(hideRuler());
});

describe('show_coordinate_ruler', () => {
  it('is named, mutating, and requires narration', () => {
    expect(showCoordinateRuler.name).toBe('show_coordinate_ruler');
    expect(showCoordinateRuler.readOnly).toBe(false);
    expect(showCoordinateRuler.inputSchema.required).toContain('explanation');
  });

  it('takes no argument other than the explanation', () => {
    expect(Object.keys(showCoordinateRuler.inputSchema.properties ?? {})).toEqual(['explanation']);
    expect(showCoordinateRuler.inputSchema.additionalProperties).toBe(false);
  });

  it('shows the ruler and reports it was not already visible', async () => {
    const result = await showCoordinateRuler.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ outcome: 'shown', already_visible: false });
      expect(result.surface_version).toBe(TOOL_SURFACE_VERSION);
    }
    expect(preferencesStore.getState().rulerVisible).toBe(true);
  });

  it('succeeds as a no-op when already showing (FR-011)', async () => {
    await showCoordinateRuler.execute({ explanation: EXPLANATION });
    const result = await showCoordinateRuler.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'shown', already_visible: true });
  });

  it('changes nothing about the game (FR-014)', async () => {
    const coord = toCoord(store.getState().cells.findIndex((c) => c.value === null));
    store.dispatch(enterDigitAt(coord, 3, 'player'));
    store.dispatch(tick(4000));

    const before = boardSnapshot();
    await showCoordinateRuler.execute({ explanation: EXPLANATION });
    expect(boardSnapshot()).toBe(before);
  });

  /* It changes no game data, so board status cannot bar it. A learner who
     pauses to study the board is exactly who wants coordinates. */
  it('works while the board is paused', async () => {
    store.dispatch(pause());
    const result = await showCoordinateRuler.execute({ explanation: EXPLANATION });
    expect(result.ok).toBe(true);
    expect(preferencesStore.getState().rulerVisible).toBe(true);
  });

  it('rejects a missing explanation before changing anything', async () => {
    const result = await showCoordinateRuler.execute({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-required');
    expect(preferencesStore.getState().rulerVisible).toBe(false);
  });

  it('rejects an explanation outside the permitted length', async () => {
    for (const explanation of ['too short', 'x'.repeat(500)]) {
      const result = await showCoordinateRuler.execute({ explanation });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('explanation-length');
    }
    expect(preferencesStore.getState().rulerVisible).toBe(false);
  });

  it('rejects an unrecognised argument rather than ignoring it', async () => {
    const result = await showCoordinateRuler.execute({ explanation: EXPLANATION, row: 4 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unexpected-argument');
    expect(preferencesStore.getState().rulerVisible).toBe(false);
  });

  it('never throws, whatever it is handed', async () => {
    for (const hostile of [null, undefined, 42, 'text', [], { __proto__: { x: 1 } }]) {
      await expect(showCoordinateRuler.execute(hostile)).resolves.toBeDefined();
    }
  });
});

describe('hide_coordinate_ruler', () => {
  it('is named, mutating, and requires narration', () => {
    expect(hideCoordinateRuler.name).toBe('hide_coordinate_ruler');
    expect(hideCoordinateRuler.readOnly).toBe(false);
    expect(hideCoordinateRuler.inputSchema.required).toContain('explanation');
  });

  it('hides a showing ruler', async () => {
    await showCoordinateRuler.execute({ explanation: EXPLANATION });
    const result = await hideCoordinateRuler.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'hidden', already_hidden: false });
    expect(preferencesStore.getState().rulerVisible).toBe(false);
  });

  it('succeeds as a no-op when not showing (FR-011)', async () => {
    const result = await hideCoordinateRuler.execute({ explanation: EXPLANATION });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ outcome: 'hidden', already_hidden: true });
  });

  it('changes nothing about the game (FR-014)', async () => {
    await showCoordinateRuler.execute({ explanation: EXPLANATION });
    const before = boardSnapshot();
    await hideCoordinateRuler.execute({ explanation: EXPLANATION });
    expect(boardSnapshot()).toBe(before);
  });

  it('rejects a missing explanation', async () => {
    await showCoordinateRuler.execute({ explanation: EXPLANATION });
    const result = await hideCoordinateRuler.execute({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-required');
    // Rejected before anything changed: the ruler is still showing.
    expect(preferencesStore.getState().rulerVisible).toBe(true);
  });
});

describe('the two tools together', () => {
  it('round-trip cleanly however many times they are called', async () => {
    for (let i = 0; i < 3; i++) {
      await showCoordinateRuler.execute({ explanation: EXPLANATION });
      expect(preferencesStore.getState().rulerVisible).toBe(true);
      await hideCoordinateRuler.execute({ explanation: EXPLANATION });
      expect(preferencesStore.getState().rulerVisible).toBe(false);
    }
  });

  it('state the addressing convention in their descriptions (002/FR-007)', () => {
    for (const tool of [showCoordinateRuler, hideCoordinateRuler]) {
      expect(tool.description.toLowerCase()).toMatch(/row|column/);
      expect(tool.description.length).toBeGreaterThan(80);
    }
  });
});
