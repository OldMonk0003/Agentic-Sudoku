import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Keypad } from '@/ui/Keypad';
import { store } from '@/state/store';
import { newPuzzle, selectCell } from '@/state/actions';
import { toIndex } from '@/engine/grid';

/** FR-020: the keypad and the physical keyboard must produce identical results. */

function firstEmptyCoord() {
  const cells = store.getState().cells;
  const index = cells.findIndex((c) => c.value === null);
  return { row: Math.floor(index / 9) + 1, col: (index % 9) + 1 };
}

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 55));
});
afterEach(cleanup);

describe('Keypad', () => {
  it('renders all nine digits', () => {
    render(<Keypad />);
    for (let d = 1; d <= 9; d++) {
      expect(screen.getByRole('button', { name: String(d) })).toBeDefined();
    }
  });

  it('places a digit into the selected cell when clicked', async () => {
    const user = userEvent.setup();
    const coord = firstEmptyCoord();
    store.dispatch(selectCell(coord));

    render(<Keypad />);
    await user.click(screen.getByRole('button', { name: '5' }));

    expect(store.getState().cells[toIndex(coord)]!.value).toBe(5);
  });

  it('produces the same result as the equivalent keyboard action (FR-020)', async () => {
    const user = userEvent.setup();

    // Path A: the keypad.
    const coordA = firstEmptyCoord();
    store.dispatch(selectCell(coordA));
    render(<Keypad />);
    await user.click(screen.getByRole('button', { name: '6' }));
    const viaKeypad = store.getState().cells[toIndex(coordA)];

    // Path B: the same action dispatched directly, as the key handler does.
    store.dispatch(newPuzzle('easy', 55));
    const coordB = firstEmptyCoord();
    store.dispatch(selectCell(coordB));
    const { enterDigit } = await import('@/state/actions');
    store.dispatch(enterDigit(6, 'player'));
    const viaKeyboard = store.getState().cells[toIndex(coordB)];

    expect(viaKeypad!.value).toBe(viaKeyboard!.value);
    expect(viaKeypad!.origin).toBe(viaKeyboard!.origin);
  });

  it('gives every key a touch target of at least 44px (FR-050)', () => {
    render(<Keypad />);
    const button = screen.getByRole('button', { name: '1' });
    expect(button.className).toMatch(/min-h-11|min-h-\[44px\]|h-11|h-12|h-14/);
  });
});
