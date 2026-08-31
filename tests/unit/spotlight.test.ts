import { describe, it, expect } from 'vitest';
import {
  makeSpotlight,
  spotlitIndices,
  spotlightFocusIndex,
  SPOTLIGHT_MAX_CELLS,
  SPOTLIGHT_TTL_MS,
} from '@/state/spotlight';

/**
 * The agent spotlight: where the agent last changed something (FR-018).
 *
 * It has TWO SHAPES, chosen by how many cells changed, and the third case --
 * raising nothing at all -- is the one most likely to be mistaken for a bug:
 *
 *   1 cell     focus form: the cell plus its row, column, and box (21 cells)
 *   2-9 cells  region form: exactly the changed cells, no crosshair
 *   >9 cells   NOTHING
 *
 * `auto_fill_all_pencil_marks` writes into every empty cell. Spotlighting sixty
 * cells conveys nothing, obscures the board, and is the opposite of "so the
 * learner can see where the change happened without searching for it". FR-026
 * asks the spotlight to convey EXTENT; for a whole-board write the honest
 * conveyance is the explanation text, which 002/FR-041 already requires to say
 * what it replaced.
 *
 * Expiry is a pure selector over `expiresAt`, never a timer -- the pattern 002
 * established, which is what makes it deterministic here with no clock.
 */

const NOW = 1_000_000;
const live = NOW + 1000;
const dead = NOW + SPOTLIGHT_TTL_MS + 1;

describe('spotlight shapes', () => {
  it('runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it('gives a single changed cell its row, column, and box (FR-018)', () => {
    const spotlight = makeSpotlight([{ row: 1, col: 1 }], NOW);
    const indices = spotlitIndices(spotlight, live);

    // A cell's row + column + box union is exactly itself plus its 20 peers.
    expect(indices.size).toBe(21);
    expect(indices.has(0)).toBe(true);       // r1c1 itself
    expect(indices.has(8)).toBe(true);       // r1c9, same row
    expect(indices.has(72)).toBe(true);      // r9c1, same column
    expect(indices.has(10)).toBe(true);      // r2c2, same box
    expect(indices.has(40)).toBe(false);     // r5c5, unrelated
  });

  it('reports the focus cell for a single-cell change', () => {
    const spotlight = makeSpotlight([{ row: 4, col: 7 }], NOW);
    expect(spotlightFocusIndex(spotlight, live)).toBe((4 - 1) * 9 + (7 - 1));
  });

  it('marks only the changed cells when several changed (FR-026)', () => {
    const cells = [
      { row: 2, col: 2 }, { row: 5, col: 5 }, { row: 8, col: 8 },
    ];
    const indices = spotlitIndices(makeSpotlight(cells, NOW), live);

    expect(indices.size).toBe(3);
    expect([...indices].sort((a, b) => a - b)).toEqual([10, 40, 70]);
  });

  it('has no focus cell in the region form', () => {
    const spotlight = makeSpotlight([{ row: 1, col: 1 }, { row: 2, col: 2 }], NOW);
    expect(spotlightFocusIndex(spotlight, live)).toBeNull();
  });

  it('raises nothing at all above the threshold', () => {
    const many = Array.from({ length: SPOTLIGHT_MAX_CELLS + 1 }, (_, i) => ({
      row: Math.floor(i / 9) + 1,
      col: (i % 9) + 1,
    }));
    expect(makeSpotlight(many, NOW)).toBeNull();
  });

  it('raises a spotlight at exactly the threshold', () => {
    const nine = Array.from({ length: SPOTLIGHT_MAX_CELLS }, (_, i) => ({
      row: 1, col: i + 1,
    }));
    expect(makeSpotlight(nine, NOW)).not.toBeNull();
    expect(spotlitIndices(makeSpotlight(nine, NOW), live).size).toBe(9);
  });

  it('raises nothing for an empty change', () => {
    expect(makeSpotlight([], NOW)).toBeNull();
  });

  it('ignores coordinates off the grid rather than rendering them', () => {
    const spotlight = makeSpotlight([{ row: 99, col: 0 }], NOW);
    expect(spotlitIndices(spotlight, live).size).toBe(0);
  });
});

describe('spotlight expiry', () => {
  it('is a pure selector over expiresAt, with no timer (FR-023)', () => {
    const spotlight = makeSpotlight([{ row: 3, col: 3 }], NOW);

    expect(spotlitIndices(spotlight, live).size).toBe(21);
    expect(spotlitIndices(spotlight, dead).size).toBe(0);
    expect(spotlightFocusIndex(spotlight, dead)).toBeNull();
  });

  it('expires on the same sixty-second vocabulary as annotations', () => {
    expect(SPOTLIGHT_TTL_MS).toBe(60_000);
  });

  it('treats a null spotlight as nothing on screen', () => {
    expect(spotlitIndices(null, live).size).toBe(0);
    expect(spotlightFocusIndex(null, live)).toBeNull();
  });
});
