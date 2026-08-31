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

  it('uses an edge rule, never a wash (FR-020)', () => {
    render(<Cell {...base} cell={empty} spotlit />);
    const classes = screen.getByRole('gridcell').className;

    // A form cue -- an outline -- not a background fill.
    expect(classes).toMatch(/outline/);
    // The learner's wash vocabulary must not be borrowed.
    expect(classes).not.toMatch(/bg-wash-crosshair/);
  });

  it('does not put anything underneath the digit (the 002 hatch lesson)', () => {
    render(<Cell {...base} cell={clue} spotlit spotlightFocus />);
    const classes = screen.getByRole('gridcell').className;
    expect(classes).not.toMatch(/agent-hatch/);
  });

  it('leaves the learner ring in charge when both mark the same cell', () => {
    render(<Cell {...base} cell={empty} tier="selected" selected spotlit />);
    const cell = screen.getByRole('gridcell');

    // The learner's own selection is still unmistakably theirs...
    expect(cell.className).toMatch(/ring/);
    // ...and the agent's attribution is still discernible.
    expect(cell.getAttribute('data-spotlit')).toBe('true');
  });

  it('tells assistive technology the agent acted here (FR-025)', () => {
    render(<Cell {...base} cell={empty} spotlit spotlightFocus />);
    expect(screen.getByRole('gridcell').getAttribute('aria-label')).toMatch(/agent/i);
  });
});
