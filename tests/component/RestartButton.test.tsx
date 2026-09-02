import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RestartButton } from '@/ui/RestartButton';
import { store } from '@/state/store';
import { loadPuzzle, enterDigitAt } from '@/state/actions';
import { parsePuzzleString, toPuzzleString } from '@/engine/puzzleString';
import { rateDifficulty } from '@/engine/rating';
import type { Puzzle } from '@/engine/types';

/**
 * The learner's Restart control (005/FR-001 -- FR-007).
 *
 * "Restart" here means A DIFFERENT PUZZLE AT THE SAME LEVEL, not the same grid
 * with the learner's entries wiped. The word usually means the opposite -- most
 * games restart *the level you are on* -- so the distinction is asserted rather
 * than assumed.
 *
 * It takes no confirmation (FR-006). Pressing a button labelled Restart is an
 * intentional act, and the existing difficulty control already discards a board
 * without asking; a prompt here would be inconsistent and, given the hands-free
 * goal, actively unhelpful.
 */

const EASY = '973--258--4-------5----46-7------2---54276-1-28-----7---5----6-7---1-3----6-89--5';

function puzzleFrom(puzzleString: string): Puzzle {
  const clues = parsePuzzleString(puzzleString);
  const rating = rateDifficulty(clues);
  return {
    clues,
    difficulty: rating.difficulty,
    puzzleString: toPuzzleString(clues),
    techniquesRequired: rating.techniquesRequired,
  };
}

beforeEach(() => {
  store.dispatch(loadPuzzle(puzzleFrom(EASY)));
});
afterEach(cleanup);

describe('RestartButton', () => {
  it('has an accessible name that says what it does', () => {
    render(<RestartButton />);
    expect(screen.getByRole('button', { name: /restart/i })).toBeTruthy();
  });

  it('carries a text label, not an icon alone', () => {
    // 001/FR-046 and FR-048: nothing is conveyed by glyph or colour alone.
    render(<RestartButton />);
    expect(screen.getByRole('button', { name: /restart/i }).textContent).toMatch(/restart/i);
  });

  it('replaces the board when pressed', async () => {
    const user = userEvent.setup();
    const before = store.getState().puzzle!.puzzleString;

    render(<RestartButton />);
    await user.click(screen.getByRole('button', { name: /restart/i }));

    // Either a new puzzle has landed, or generation is in flight -- both mean the
    // press was acted on. What must NOT happen is the same grid staying put with
    // nothing else having changed.
    const after = store.getState();
    expect(after.status === 'generating' || after.puzzle!.puzzleString !== before).toBe(true);
  });

  it('keeps the difficulty it was already on', async () => {
    const user = userEvent.setup();
    const level = store.getState().puzzle!.difficulty;

    render(<RestartButton />);
    await user.click(screen.getByRole('button', { name: /restart/i }));

    // FR-003. This is what makes it a RESTART rather than a difficulty change:
    // the level after equals the level before.
    const next = store.getState().puzzle;
    if (next) expect(next.difficulty).toBe(level);
  });

  it('asks for no confirmation', async () => {
    const user = userEvent.setup();
    store.dispatch(enterDigitAt({ row: 1, col: 3 }, 4, 'player'));

    render(<RestartButton />);
    await user.click(screen.getByRole('button', { name: /restart/i }));

    // FR-006: even with progress on the board, pressing it is the decision. No
    // dialog, no second step, nothing to dismiss.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('is operable by keyboard alone', async () => {
    const user = userEvent.setup();
    const before = store.getState().puzzle!.puzzleString;

    render(<RestartButton />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /restart/i }));

    await user.keyboard('{Enter}');
    const after = store.getState();
    expect(after.status === 'generating' || after.puzzle!.puzzleString !== before).toBe(true);
  });
});
