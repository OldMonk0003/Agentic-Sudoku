import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle } from '@/state/actions';
import {
  agentStore,
  clearAnnotations,
  visibleAnnotations,
  visibleToast,
  ANNOTATION_TTL_MS,
  TOAST_TTL_MS,
} from '@/state/agentSession';
import { highlightPatternCells } from '@/tools/tools/highlightPatternCells';
import { showPatternHintToast } from '@/tools/tools/showPatternHintToast';
import { clearVisualAnnotations } from '@/tools/tools/clearVisualAnnotations';

/**
 * Contract tests for the three annotation tools (FR-028, FR-030, FR-031).
 *
 * Principle V requires name, schema rejection, success shape, and error shape
 * for every tool. The shared property they all carry, and the one this file
 * leans on hardest: **an annotation call changes nothing about the game.**
 */

const EXPLANATION = 'Only one cell in this box can still take a seven, and here is why that is so.';

const boardSnapshot = () => {
  const game = store.getState();
  return JSON.stringify({
    cells: game.cells.map((c) => ({ v: c.value, o: c.origin, c: [...c.candidates] })),
    elapsedMs: game.elapsedMs,
    history: game.history.length,
    selection: game.selection,
  });
};

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 5150));
  agentStore.dispatch(clearAnnotations());
});

describe('highlight_pattern_cells', () => {
  it('is named, mutating, and requires narration', () => {
    expect(highlightPatternCells.name).toBe('highlight_pattern_cells');
    expect(highlightPatternCells.readOnly).toBe(false);
    expect(highlightPatternCells.inputSchema.required).toContain('explanation');
  });

  it('marks target and because cells in distinguishable roles (FR-028)', async () => {
    const result = await highlightPatternCells.execute({
      target_cells: [{ row: 4, col: 5 }],
      because_cells: [{ row: 4, col: 1 }, { row: 4, col: 3 }],
      explanation: EXPLANATION,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ annotated_cells: 3, expires_in_ms: ANNOTATION_TTL_MS });

    const roles = visibleAnnotations(agentStore.getState(), Date.now()).map((a) =>
      a.kind === 'cell' ? a.role : 'beam',
    );
    expect(roles).toEqual(['target', 'because']);
  });

  it('CHANGES NOTHING on the board', async () => {
    const before = boardSnapshot();
    await highlightPatternCells.execute({
      target_cells: [{ row: 4, col: 5 }],
      explanation: EXPLANATION,
    });
    expect(boardSnapshot()).toBe(before);
  });

  it('rejects an off-grid coordinate before anything is drawn', async () => {
    const result = await highlightPatternCells.execute({
      target_cells: [{ row: 0, col: 5 }],
      explanation: EXPLANATION,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-input');
    expect(visibleAnnotations(agentStore.getState(), Date.now())).toHaveLength(0);
  });

  it('rejects an empty highlight, naming what was missing', async () => {
    const result = await highlightPatternCells.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('no-annotation-target');
      expect(result.error.message).toMatch(/target_cells|because_cells/);
    }
  });

  it('rejects an unrecognised argument', async () => {
    const result = await highlightPatternCells.execute({
      target_cells: [{ row: 1, col: 1 }],
      colour: 'red',
      explanation: EXPLANATION,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unexpected-argument');
  });

  it('rejects duplicate cells rather than double-marking', async () => {
    const result = await highlightPatternCells.execute({
      target_cells: [{ row: 1, col: 1 }, { row: 1, col: 1 }],
      explanation: EXPLANATION,
    });
    expect(result.ok).toBe(false);
  });
});

describe('show_pattern_hint_toast', () => {
  it('is named, mutating, and takes only its message', () => {
    expect(showPatternHintToast.name).toBe('show_pattern_hint_toast');
    expect(showPatternHintToast.readOnly).toBe(false);
    expect(Object.keys(showPatternHintToast.inputSchema.properties!)).toEqual(['explanation']);
  });

  it('shows the message and reports its five-second life (FR-030)', async () => {
    const result = await showPatternHintToast.execute({ explanation: EXPLANATION });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ expires_in_ms: TOAST_TTL_MS });
    expect(visibleToast(agentStore.getState(), Date.now())!.text).toBe(EXPLANATION);
  });

  it('does not ALSO queue a popup saying the same thing twice', async () => {
    const before = agentStore.getState().explanations.length;
    await showPatternHintToast.execute({ explanation: EXPLANATION });
    expect(agentStore.getState().explanations).toHaveLength(before);
  });

  it('rejects a message outside the one-to-two-line bounds', async () => {
    for (const text of ['too short', 'x'.repeat(241)]) {
      const result = await showPatternHintToast.execute({ explanation: text });
      expect(result.ok, text.slice(0, 12)).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('explanation-length');
    }
  });
});

describe('clear_visual_annotations', () => {
  it('removes highlights and the toast, and reports what it removed', async () => {
    await highlightPatternCells.execute({
      target_cells: [{ row: 4, col: 5 }],
      because_cells: [{ row: 4, col: 1 }],
      explanation: EXPLANATION,
    });
    await showPatternHintToast.execute({ explanation: EXPLANATION });

    const result = await clearVisualAnnotations.execute({
      explanation: 'Clearing my marks so we can look at the next pattern with fresh eyes.',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ cleared_annotations: 2, cleared_toast: true });
    expect(visibleAnnotations(agentStore.getState(), Date.now())).toHaveLength(0);
    expect(visibleToast(agentStore.getState(), Date.now())).toBeNull();
  });

  it('leaves every cell, candidate, the timer, and history untouched (FR-031)', async () => {
    await highlightPatternCells.execute({ target_cells: [{ row: 4, col: 5 }], explanation: EXPLANATION });
    const before = boardSnapshot();

    await clearVisualAnnotations.execute({
      explanation: 'Clearing my marks so we can look at the next pattern with fresh eyes.',
    });

    expect(boardSnapshot()).toBe(before);
  });

  it('does NOT erase its own narration', async () => {
    // The trap: clearing "everything the agent drew" would take the explanation
    // of the clearing with it, and the learner would see the board change for no
    // stated reason -- the exact thing the narration contract exists to prevent.
    const text = 'Clearing my marks so we can look at the next pattern with fresh eyes now.';
    await clearVisualAnnotations.execute({ explanation: text });

    const explanations = agentStore.getState().explanations;
    expect(explanations.at(-1)!.text).toBe(text);
  });

  it('requires narration like any other change', async () => {
    const result = await clearVisualAnnotations.execute({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('explanation-required');
  });
});
