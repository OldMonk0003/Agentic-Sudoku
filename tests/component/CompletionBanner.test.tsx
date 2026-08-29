import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CompletionBanner } from '@/ui/CompletionBanner';

/**
 * FR-038: completion is communicated WITHOUT blocking, shows the final elapsed
 * time, and offers a new puzzle. Principle V forbids a modal here -- a dialog
 * that must be dismissed is exactly the blocking feedback the constitution bans.
 */

afterEach(cleanup);

describe('CompletionBanner', () => {
  it('renders nothing when the puzzle is not complete', () => {
    const { container } = render(<CompletionBanner complete={false} elapsedMs={0} onNewPuzzle={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the final elapsed time in MM:SS', () => {
    render(<CompletionBanner complete elapsedMs={252_000} onNewPuzzle={() => {}} />);
    expect(screen.getByText(/04:12/)).toBeDefined();
  });

  it('is NOT a modal dialog', () => {
    render(<CompletionBanner complete elapsedMs={1000} onNewPuzzle={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
  });

  it('announces politely rather than assertively, so it never interrupts', () => {
    render(<CompletionBanner complete elapsedMs={1000} onNewPuzzle={() => {}} />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('does not steal focus when it appears', () => {
    const before = document.activeElement;
    render(<CompletionBanner complete elapsedMs={1000} onNewPuzzle={() => {}} />);
    expect(document.activeElement).toBe(before);
  });

  it('offers a new puzzle', () => {
    render(<CompletionBanner complete elapsedMs={1000} onNewPuzzle={() => {}} />);
    expect(screen.getByRole('button', { name: /new puzzle/i })).toBeDefined();
  });

  it('formats sub-minute and long solves correctly', () => {
    render(<CompletionBanner complete elapsedMs={9_000} onNewPuzzle={() => {}} />);
    expect(screen.getByText(/00:09/)).toBeDefined();
    cleanup();
    render(<CompletionBanner complete elapsedMs={3_723_000} onNewPuzzle={() => {}} />);
    expect(screen.getByText(/62:03/)).toBeDefined();
  });
});
