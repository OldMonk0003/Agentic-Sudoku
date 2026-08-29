import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModeToggle } from '@/ui/ModeToggle';
import { store } from '@/state/store';
import { newPuzzle, setInputMode } from '@/state/actions';

/** FR-013: the currently active mode MUST be visible on screen at all times. */

beforeEach(() => {
  store.dispatch(newPuzzle('easy', 1234));
  store.dispatch(setInputMode('normal'));
});
afterEach(cleanup);

describe('ModeToggle', () => {
  it('shows which mode is active, not just which is available', () => {
    render(<ModeToggle />);
    const toggle = screen.getByRole('switch', { name: /pencil|notes/i });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('reflects notes mode once active', () => {
    store.dispatch(setInputMode('notes'));
    render(<ModeToggle />);
    expect(screen.getByRole('switch', { name: /pencil|notes/i }).getAttribute('aria-checked')).toBe('true');
  });

  it('switches mode when clicked', async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);
    await user.click(screen.getByRole('switch', { name: /pencil|notes/i }));
    expect(store.getState().inputMode).toBe('notes');
  });

  it('switches back on a second click', async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);
    const toggle = screen.getByRole('switch', { name: /pencil|notes/i });
    await user.click(toggle);
    await user.click(toggle);
    expect(store.getState().inputMode).toBe('normal');
  });

  it('carries a visible text label, not an icon alone', () => {
    render(<ModeToggle />);
    expect(screen.getByText(/pencil|notes/i)).toBeDefined();
  });

  it('returns focus to the selected cell, so the next keystroke reaches the board', async () => {
    const user = userEvent.setup();
    // Stand in for the board's selected cell.
    const cell = document.createElement('button');
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('data-selected', 'true');
    document.body.appendChild(cell);

    render(<ModeToggle />);
    await user.click(screen.getByRole('switch', { name: /pencil|notes/i }));

    // Synchronous by design -- a deferred focus let a fast keystroke land first.
    expect(document.activeElement).toBe(cell);
    cell.remove();
  });

  it('is reachable and operable by keyboard (FR-046)', async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('switch', { name: /pencil|notes/i }));
    await user.keyboard('{Enter}');
    expect(store.getState().inputMode).toBe('notes');
  });
});
