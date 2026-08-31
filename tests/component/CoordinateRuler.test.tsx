import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CoordinateRuler } from '@/ui/CoordinateRuler';
import { preferencesStore, showRuler, hideRuler } from '@/state/preferences';

/**
 * FR-006, FR-007, FR-017 -- the numbered gutters.
 *
 * The accessibility assertion is the one worth reading twice. The gutters are
 * `aria-hidden`, and that is not an oversight to be fixed later: every cell
 * ALREADY announces its own coordinates (001/FR-047), so exposing the ruler
 * would append a second coordinate to every cell announcement, making the board
 * WORSE for a screen-reader learner in the name of an aid that exists to stop
 * sighted learners counting squares.
 */

beforeEach(() => {
  preferencesStore.dispatch(hideRuler());
});
afterEach(cleanup);

describe('CoordinateRuler', () => {
  it('renders nothing at all when the ruler is hidden', () => {
    const { container } = render(<CoordinateRuler axis="columns" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('numbers the columns 1 to 9 left to right (FR-007)', () => {
    preferencesStore.dispatch(showRuler());
    render(<CoordinateRuler axis="columns" />);

    const labels = screen.getByTestId('ruler-columns');
    const numbers = [...labels.querySelectorAll('[data-ruler-index]')].map((n) => n.textContent);
    expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('numbers the rows 1 to 9 top to bottom (FR-007)', () => {
    preferencesStore.dispatch(showRuler());
    render(<CoordinateRuler axis="rows" />);

    const labels = screen.getByTestId('ruler-rows');
    const numbers = [...labels.querySelectorAll('[data-ruler-index]')].map((n) => n.textContent);
    expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('captions each axis so the numbering is self-explaining', () => {
    preferencesStore.dispatch(showRuler());
    const { rerender } = render(<CoordinateRuler axis="columns" />);
    expect(screen.getByTestId('ruler-columns').textContent).toMatch(/column/i);

    rerender(<CoordinateRuler axis="rows" />);
    expect(screen.getByTestId('ruler-rows').textContent).toMatch(/row/i);
  });

  it('is hidden from assistive technology (FR-017)', () => {
    preferencesStore.dispatch(showRuler());
    const { rerender } = render(<CoordinateRuler axis="columns" />);
    expect(screen.getByTestId('ruler-columns').getAttribute('aria-hidden')).toBe('true');

    rerender(<CoordinateRuler axis="rows" />);
    expect(screen.getByTestId('ruler-rows').getAttribute('aria-hidden')).toBe('true');
  });

  it('follows the store, so either actor can drive it', () => {
    const { rerender } = render(<CoordinateRuler axis="columns" />);
    expect(screen.queryByTestId('ruler-columns')).toBeNull();

    preferencesStore.dispatch(showRuler());
    rerender(<CoordinateRuler axis="columns" />);
    expect(screen.getByTestId('ruler-columns')).toBeTruthy();

    preferencesStore.dispatch(hideRuler());
    rerender(<CoordinateRuler axis="columns" />);
    expect(screen.queryByTestId('ruler-columns')).toBeNull();
  });

  /* The palette lives only in app/globals.css, and the ruler must be
     SUBORDINATE to the grid (FR-008). Not the screenshot's red -- see R6. */
  it('uses the quiet note ink, not a conflict or alert colour', () => {
    preferencesStore.dispatch(showRuler());
    render(<CoordinateRuler axis="columns" />);
    const classes = screen.getByTestId('ruler-columns').className;
    expect(classes).toMatch(/text-ink-note/);
    expect(classes).not.toMatch(/conflict/);
  });
});
