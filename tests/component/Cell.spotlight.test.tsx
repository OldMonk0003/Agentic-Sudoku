import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Cell } from '@/ui/Cell';
import type { Cell as CellData } from '@/state/types';

/**
 * FR-020 and FR-021 -- the spotlight is TELLABLE APART from the learner's own
 * crosshair, and stays so with no colour at all.
 *
 * The rule that decides the treatment is already written in app/globals.css:
 *
 *   "Agent annotations are distinguished from the learner's own highlighting by
 *    FORM first: outlines, hatching, and rays, where the learner's highlighting
 *    is entirely flat washes."
 *
 * So the spotlight is an EDGE RULE, never a wash. A second flat wash would be
 * precisely the confusion FR-020 forbids, and it would fail greyscale.
 *
 * And nothing new goes UNDERNEATH a digit. 002's third visual defect was the
 * `because` hatch running its stripes straight through a clue's 4; the fix was
 * moving it to the cell edge. That is not to be re-opened.
 */

const empty: CellData = { value: null, candidates: new Set(), origin: 'player' };
const clue: CellData = { value: 4, candidates: new Set(), origin: 'clue' };

const base = {
  index: 40 as const,
  colIndex: 5,
  tier: 'none' as const,
  conflict: false,
  selected: false,
  tabbable: false,
  onSelect: () => {},
};

afterEach(cleanup);

describe('Cell spotlight rendering', () => {
  it('renders no spotlight marking by default', () => {
    render(<Cell {...base} cell={empty} />);
    expect(screen.getByRole('gridcell').getAttribute('data-spotlit')).toBeNull();
  });

  it('marks a spotlit cell so it can be seen and tested', () => {
    render(<Cell {...base} cell={empty} spotlit />);
    expect(screen.getByRole('gridcell').getAttribute('data-spotlit')).toBe('true');
  });

  it('marks the focus cell distinctly from the rest of the band', () => {
    render(<Cell {...base} cell={empty} spotlit spotlightFocus />);
    const cell = screen.getByRole('gridcell');
    expect(cell.getAttribute('data-spotlit')).toBe('true');
    expect(cell.getAttribute('data-spotlight-focus')).toBe('true');
  });

  it('uses a dashed edge rule, never a wash (FR-020)', () => {
    render(<Cell {...base} cell={empty} spotlit />);
    const edge = screen.getByRole('gridcell').querySelector('[data-spotlight-edge]');

    // A FORM cue -- a dashed border at the cell edge -- not a background fill.
    expect(edge).not.toBeNull();
    expect(edge!.className).toMatch(/border-dashed/);
    // The learner's flat-wash vocabulary must not be borrowed.
    expect(edge!.className).not.toMatch(/bg-wash/);
  });

  it('draws the edge as an overlay, never underneath the digit (the 002 hatch lesson)', () => {
    render(<Cell {...base} cell={clue} spotlit spotlightFocus />);
    const cell = screen.getByRole('gridcell');

    expect(cell.className).not.toMatch(/agent-hatch/);
    // The digit is still the cell's own text; the edge is a sibling overlay
    // with no background of its own.
    expect(cell.textContent).toContain('4');
    const edge = cell.querySelector('[data-spotlight-edge]')!;
    expect(edge.className).toMatch(/pointer-events-none/);
    expect(edge.className).not.toMatch(/bg-/);
  });

  it('does not borrow the selection ring property, so both can coexist', () => {
    render(<Cell {...base} cell={empty} tier="selected" selected spotlit />);
    const cell = screen.getByRole('gridcell');

    // The learner's own selection is still an outline ring, unmistakably theirs.
    expect(cell.className).toMatch(/outline-ring-selected/);
    // The agent's mark is a separate dashed overlay, so neither erases the other.
    expect(cell.querySelector('[data-spotlight-edge]')).not.toBeNull();
    expect(cell.getAttribute('data-spotlit')).toBe('true');
  });

  it('tells assistive technology the agent acted here (FR-025)', () => {
    render(<Cell {...base} cell={empty} spotlit spotlightFocus />);
    expect(screen.getByRole('gridcell').getAttribute('aria-label')).toMatch(/agent/i);
  });
});
