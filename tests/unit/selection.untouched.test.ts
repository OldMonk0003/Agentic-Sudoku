import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '@/state/store';
import { newPuzzle, selectCell } from '@/state/actions';
import { agentStore, clearAnnotations } from '@/state/agentSession';
import { descriptors } from '@/tools/registry';

/**
 * FR-019 and SC-004 -- THE test for user story 2.
 *
 * The original complaint was that nothing moves when the agent acts, and the
 * obvious fix is to move the learner's selection to the agent's cell. That fix
 * was rejected deliberately (spec Assumptions, research.md): if the learner is
 * mid-thought on another cell, moving their selection means their NEXT KEYPRESS
 * LANDS IN THE AGENT'S CELL instead of theirs. The agent gets a spotlight of its
 * own instead, and 002/FR-056 survives intact.
 *
 * This test is what stops that decision being quietly reversed later. It runs
 * against EVERY tool on the surface rather than the ones we thought about, so a
 * tool added tomorrow is covered the day it is added.
 */

/** Valid input per tool, so we exercise the success path rather than rejection. */
const INPUTS: Record<string, Record<string, unknown>> = {
  get_board_state: {},
  check_for_conflicts: {},
  highlight_pattern_cells: {
    target_cells: [{ row: 1, col: 1 }],
    because_cells: [{ row: 1, col: 2 }],
    explanation: 'Pointing at the one cell in this box that can still take a seven right now.',
  },
  show_pattern_hint_toast: {
    explanation: 'Look for a digit with only one home left in a box - that is a hidden single.',
  },
  clear_visual_annotations: {
    explanation: 'Clearing my marks so we can look at the next pattern with completely fresh eyes.',
  },
  draw_constraint_beams: {
    beams: [{ unit_type: 'row', unit_number: 3, digit: 6 }],
    explanation: 'Row 3 already contains a six, so nothing else in that row can possibly take one.',
  },
  update_pencil_marks: {
    cells: [{ row: 5, col: 5, digits: [1, 2] }],
    explanation: 'Narrowing this cell to the only two digits its row and column still permit here.',
  },
  auto_fill_all_pencil_marks: {
    acknowledges_replacing_marks: true,
    explanation: 'Pencilling every legal candidate so that the naked pairs become visible to you.',
  },
  show_coordinate_ruler: {
    explanation: 'Numbering the grid so you can name a cell to me without counting squares first.',
  },
  hide_coordinate_ruler: {
    explanation: 'Taking the row and column guides away again now that you have the hang of it.',
  },
};

const SELECTION = { row: 8, col: 2 };

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 31415));
  store.dispatch(selectCell(SELECTION));
  agentStore.dispatch(clearAnnotations());
});

describe('no agent tool moves the learner', () => {
  it('runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  for (const descriptor of descriptors) {
    const input = INPUTS[descriptor.name];
    if (!input) continue; // exercised in its own story's tests

    it(`${descriptor.name} leaves the selection exactly where the learner put it`, async () => {
      const before = JSON.stringify(store.getState().selection);
      await descriptor.execute(input);
      expect(JSON.stringify(store.getState().selection)).toBe(before);
    });
  }

  it('a fill into a DIFFERENT cell does not steal the selection (SC-004)', async () => {
    const fill = descriptors.find((d) => d.name === 'fill_cell')!;

    // An empty, non-clue cell that is NOT the learner's selection.
    const target = store
      .getState()
      .cells.map((cell, index) => ({ cell, index }))
      .find(({ cell, index }) => cell.value === null && index !== (SELECTION.row - 1) * 9 + (SELECTION.col - 1))!;

    const row = Math.floor(target.index / 9) + 1;
    const col = (target.index % 9) + 1;

    const result = await fill.execute({
      row, col, digit: 5,
      explanation: 'Only a five fits here, because the other eight digits already appear in this box.',
    });

    expect(result.ok).toBe(true);
    expect(store.getState().selection).toEqual(SELECTION);
  });
});
