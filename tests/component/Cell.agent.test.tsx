import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Cell } from '@/ui/Cell';
import type { Cell as CellData } from '@/state/types';
import type { Digit } from '@/engine/grid';

/**
 * FR-044 and SC-004: agent-placed digits must be distinguishable from the
 * learner's own entries and from starting clues, **at a glance and without
 * interaction**.
 *
 * The distinction is carried by TWO non-colour cues -- italic, and a sage corner
 * glyph -- and not by ink. That is deliberate and inherited: 001's palette
 * research found a third ink could not clear 4.5:1 on every wash tier, so agent
 * digits share the player ink and are marked by form instead. Which means this
 * test is the one that has to hold.
 */

const cell = (overrides: Partial<CellData> = {}): CellData => ({
  value: 7 as Digit,
  candidates: new Set<Digit>(),
  origin: 'player',
  ...overrides,
});

function renderCell(data: CellData) {
  return render(
    <Cell
      index={40}
      colIndex={5}
      cell={data}
      tier="none"
      conflict={false}
      selected={false}
      tabbable={false}
      onSelect={() => {}}
    />,
  );
}

afterEach(cleanup);

describe('an agent-placed digit is visibly the agent"s', () => {
  it('carries a corner glyph that a clue and a player entry do not', () => {
    const { container: agent } = renderCell(cell({ origin: 'agent' }));
    expect(agent.querySelector('[data-agent-placed]')).not.toBeNull();
    cleanup();

    const { container: player } = renderCell(cell({ origin: 'player' }));
    expect(player.querySelector('[data-agent-placed]')).toBeNull();
    cleanup();

    const { container: clue } = renderCell(cell({ origin: 'clue' }));
    expect(clue.querySelector('[data-agent-placed]')).toBeNull();
  });

  it('is italic, so the difference survives with the glyph cropped or missed', () => {
    const { container } = renderCell(cell({ origin: 'agent' }));
    expect(container.querySelector('button')!.className).toContain('italic');
  });

  it('is NOT distinguished by ink alone', () => {
    // Agent and player share --color-ink-player by design (001 palette research).
    // If someone "fixes" that by introducing a third ink, the contrast suite is
    // where that decision has to be argued -- not here.
    const { container: agent } = renderCell(cell({ origin: 'agent' }));
    const agentClasses = agent.querySelector('button')!.className;
    cleanup();
    const { container: player } = renderCell(cell({ origin: 'player' }));
    const playerClasses = player.querySelector('button')!.className;

    expect(agentClasses).toContain('text-ink-player');
    expect(playerClasses).toContain('text-ink-player');
  });

  it('marks agent-written candidates too', () => {
    const { container } = renderCell(
      cell({ value: null, origin: 'agent', candidates: new Set<Digit>([1, 4]) }),
    );
    expect(container.querySelector('[data-agent-candidates]')).not.toBeNull();
  });

  it('does not mark an EMPTY cell that merely has agent origin', () => {
    // Origin on an empty cell is bookkeeping, not authorship: there is nothing
    // there to attribute, and a mark would be a lie.
    const { container } = renderCell(cell({ value: null, origin: 'agent' }));
    expect(container.querySelector('[data-agent-placed]')).toBeNull();
    expect(container.querySelector('[data-agent-candidates]')).toBeNull();
  });
});

describe('authorship is spoken as well as shown (FR-060)', () => {
  it('says the digit was placed by the agent', () => {
    renderCell(cell({ origin: 'agent' }));
    expect(screen.getByRole('gridcell').getAttribute('aria-label')).toContain('placed by agent');
  });

  it('says "given" for a clue and nothing extra for the learner"s own digit', () => {
    renderCell(cell({ origin: 'clue' }));
    expect(screen.getByRole('gridcell').getAttribute('aria-label')).toContain('given');
    cleanup();

    renderCell(cell({ origin: 'player' }));
    const label = screen.getByRole('gridcell').getAttribute('aria-label')!;
    expect(label).not.toContain('given');
    expect(label).not.toContain('agent');
  });

  it('names an agent annotation role in the label', () => {
    render(
      <Cell
        index={40}
        colIndex={5}
        cell={cell({ value: null, origin: 'player' })}
        tier="none"
        conflict={false}
        selected={false}
        tabbable={false}
        annotation="target"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole('gridcell').getAttribute('aria-label')).toContain('agent target');
  });
});
