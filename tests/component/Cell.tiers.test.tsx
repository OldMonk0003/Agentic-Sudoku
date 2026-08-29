import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Cell } from '@/ui/Cell';
import type { Cell as CellData } from '@/state/types';
import type { HighlightTier } from '@/state/selectors';

/**
 * Tier precedence per data-model.md:
 *
 *   conflict wash > matching wash > crosshair wash > ground
 *   + selection ring, composed OVER whichever fill applies
 *
 * The ring is not a fill. That is the design decision that keeps text legible on
 * every tier (research.md R3), so it is asserted separately from the wash.
 */

afterEach(cleanup);

const emptyCell: CellData = { value: null, candidates: new Set(), origin: 'player' };
const clueCell: CellData = { value: 5, candidates: new Set(), origin: 'clue' };

function renderCell(tier: HighlightTier, cell: CellData = emptyCell, selected = false, conflict = false) {
  render(
    <Cell
      index={0}
      colIndex={1}
      cell={cell}
      tier={tier}
      conflict={conflict}
      selected={selected}
      onSelect={() => {}}
    />,
  );
  return screen.getByRole('gridcell');
}

describe('Cell highlight tiers', () => {
  it('renders no wash for an unhighlighted cell', () => {
    const el = renderCell('none');
    expect(el.className).not.toMatch(/bg-wash-/);
    expect(el.getAttribute('data-tier')).toBe('none');
  });

  it('renders the crosshair wash', () => {
    const el = renderCell('crosshair');
    expect(el.className).toContain('bg-wash-crosshair');
    expect(el.getAttribute('data-tier')).toBe('crosshair');
  });

  it('renders the matching wash, which outranks crosshair', () => {
    const el = renderCell('matching', clueCell);
    expect(el.className).toContain('bg-wash-matching');
    expect(el.className).not.toContain('bg-wash-crosshair');
  });

  it('gives matching cells medium type weight as a NON-COLOUR cue (FR-009)', () => {
    const el = renderCell('matching', clueCell);
    expect(el.className).toMatch(/font-(medium|semibold|bold)/);
  });

  it('draws the selection as a RING, not a fill', () => {
    const el = renderCell('selected', emptyCell, true);
    expect(el.className).toMatch(/outline-2/);
    expect(el.className).toContain('outline-ring-selected');
  });

  it('composes the ring OVER whichever wash applies', () => {
    const el = renderCell('crosshair', emptyCell, true);
    expect(el.className).toContain('bg-wash-crosshair');
    expect(el.className).toMatch(/outline-2/);
  });

  it('uses only palette tokens — never a raw colour', () => {
    const el = renderCell('matching', clueCell, true);
    expect(el.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(el.className).not.toMatch(/\[(rgb|hsl|#)/);
  });

  it('renders the conflict wash, ink, and a NON-COLOUR corner marker (FR-026)', () => {
    const el = renderCell('conflict', clueCell, false, true);
    expect(el.className).toContain('bg-wash-conflict');
    expect(el.className).toContain('text-ink-conflict');
    expect(el.querySelector('[data-conflict-marker]')).not.toBeNull();
  });

  it('keeps the conflict wash even when the conflicting cell is selected', () => {
    // Losing it would hide the more important signal behind the less important one.
    const el = renderCell('selected', clueCell, true, true);
    expect(el.className).toContain('bg-wash-conflict');
    expect(el.className).toMatch(/outline-2/);
  });

  it('names the conflict in the accessible label so it is heard in place', () => {
    const el = renderCell('conflict', clueCell, false, true);
    expect(el.getAttribute('aria-label')).toMatch(/conflict/i);
  });

  it('exposes the tier to tests and assistive tooling via data-tier', () => {
    for (const tier of ['none', 'crosshair', 'matching', 'selected'] as const) {
      cleanup();
      expect(renderCell(tier, emptyCell, tier === 'selected').getAttribute('data-tier')).toBe(tier);
    }
  });
});
