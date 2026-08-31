import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulerToggle } from '@/ui/RulerToggle';
import { preferencesStore, hideRuler } from '@/state/preferences';

/**
 * FR-013: "The learner MUST have their own always-available control to show and
 * hide the ruler, present and working whether or not an agent is connected."
 *
 * This is what makes the ruler an ordinary readability aid rather than an agent
 * affordance -- and it is why the no-host parity test had to be amended rather
 * than left alone: this is the ONE thing feature 003 adds that a host-less page
 * still gets.
 */

beforeEach(() => {
  preferencesStore.dispatch(hideRuler());
});
afterEach(cleanup);

describe('RulerToggle', () => {
  it('has an accessible name that says what it does', () => {
    render(<RulerToggle />);
    expect(screen.getByRole('switch', { name: /row and column|coordinate|guides|numbers/i })).toBeTruthy();
  });

  it('reports its state rather than only its action', () => {
    render(<RulerToggle />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });

  it('shows the ruler when clicked', async () => {
    const user = userEvent.setup();
    render(<RulerToggle />);

    await user.click(screen.getByRole('switch'));
    expect(preferencesStore.getState().rulerVisible).toBe(true);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('hides it again when clicked a second time', async () => {
    const user = userEvent.setup();
    render(<RulerToggle />);

    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('switch'));
    expect(preferencesStore.getState().rulerVisible).toBe(false);
  });

  it('is operable by keyboard alone (001/FR-046)', async () => {
    const user = userEvent.setup();
    render(<RulerToggle />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('switch'));

    await user.keyboard('{Enter}');
    expect(preferencesStore.getState().rulerVisible).toBe(true);
  });

  it('reflects a change made by the agent rather than only its own clicks', () => {
    render(<RulerToggle />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');

    // The agent's tool dispatches the same action against the same store.
    // Wrapped in act() because the dispatch originates OUTSIDE React -- which is
    // exactly the point: this component learns about it through
    // useSyncExternalStore, without knowing an agent exists.
    act(() => { preferencesStore.dispatch({ type: 'showRuler' }); });
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });
});
