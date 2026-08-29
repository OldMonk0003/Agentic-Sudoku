import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Controls } from '@/ui/Controls';
import { store } from '@/state/store';
import { newPuzzle, selectCell, enterDigit } from '@/state/actions';
import { toCoord } from '@/engine/grid';

/** FR-032: Undo MUST be visibly unavailable when there is nothing to undo. */

function firstEmptyCoord() {
  return toCoord(store.getState().cells.findIndex((c) => c.value === null));
}

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 909));
});
afterEach(cleanup);

describe('Controls', () => {
  it('offers Erase and Undo', () => {
    render(<Controls />);
    expect(screen.getByRole('button', { name: /erase/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /undo/i })).toBeDefined();
  });

  it('renders Undo DISABLED on an untouched board (FR-032)', () => {
    render(<Controls />);
    expect(screen.getByRole('button', { name: /undo/i })).toHaveProperty('disabled', true);
  });

  it('enables Undo once there is something to undo', () => {
    store.dispatch(selectCell(firstEmptyCoord()));
    store.dispatch(enterDigit(5, 'player'));

    render(<Controls />);
    expect(screen.getByRole('button', { name: /undo/i })).toHaveProperty('disabled', false);
  });

  it('reverts the last change when Undo is pressed', async () => {
    const user = userEvent.setup();
    const coord = firstEmptyCoord();
    store.dispatch(selectCell(coord));
    store.dispatch(enterDigit(5, 'player'));

    render(<Controls />);
    await user.click(screen.getByRole('button', { name: /undo/i }));

    expect(store.getState().history).toHaveLength(0);
  });

  it('clears the active cell when Erase is pressed (FR-030)', async () => {
    const user = userEvent.setup();
    const coord = firstEmptyCoord();
    store.dispatch(selectCell(coord));
    store.dispatch(enterDigit(7, 'player'));

    render(<Controls />);
    await user.click(screen.getByRole('button', { name: /erase/i }));

    const { toIndex } = await import('@/engine/grid');
    expect(store.getState().cells[toIndex(coord)]!.value).toBeNull();
  });

  it('does not convey disabled state by colour alone', () => {
    render(<Controls />);
    // A real `disabled` attribute is what assistive technology reads; styling is
    // reinforcement, never the sole carrier (FR-048).
    expect(screen.getByRole('button', { name: /undo/i }).hasAttribute('disabled')).toBe(true);
  });

  it('labels every control with text, not an icon alone (FR-046)', () => {
    render(<Controls />);
    expect(screen.getByText(/erase/i)).toBeDefined();
    expect(screen.getByText(/undo/i)).toBeDefined();
  });
});
