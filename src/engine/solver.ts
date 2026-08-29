import { ALL_INDICES, peersOf, type CellIndex, type Digit } from './grid';

/**
 * Constraint-propagating backtracking solver.
 *
 * `countSolutions` is the heart of Principle IV: it answers "none, exactly one,
 * or more than one" and STOPS at the cap rather than enumerating a solution
 * space. Every puzzle presented to a player passes through it, whatever the
 * generator claims.
 */

const ALL_CANDIDATES = 0b111111111; // bit i set => digit i+1 available

function bitOf(digit: Digit): number {
  return 1 << (digit - 1);
}

/** Candidate masks for every cell, or null if the board is already contradictory. */
function buildMasks(clues: readonly (Digit | null)[]): Int16Array | null {
  const masks = new Int16Array(81).fill(ALL_CANDIDATES);

  for (const index of ALL_INDICES) {
    const digit = clues[index];
    if (digit == null) continue;
    if ((masks[index]! & bitOf(digit)) === 0) return null; // clue contradicts a peer
    masks[index] = bitOf(digit);
    for (const peer of peersOf(index)) {
      if (clues[peer] == null) masks[peer]! &= ~bitOf(digit);
      else if (clues[peer] === digit) return null;
    }
  }

  // A cell with no candidates left means the board cannot be completed.
  for (const index of ALL_INDICES) {
    if (masks[index] === 0) return null;
  }
  return masks;
}

function popcount(n: number): number {
  let count = 0;
  while (n) {
    n &= n - 1;
    count++;
  }
  return count;
}

/** Minimum-remaining-values heuristic: solve the most constrained cell first. */
function mostConstrained(masks: Int16Array, values: Int8Array): CellIndex | -1 {
  let best: CellIndex | -1 = -1;
  let bestCount = 10;
  for (const index of ALL_INDICES) {
    if (values[index] !== 0) continue;
    const count = popcount(masks[index]!);
    if (count < bestCount) {
      bestCount = count;
      best = index;
      if (count === 1) break;
    }
  }
  return best;
}

function search(
  masks: Int16Array,
  values: Int8Array,
  cap: number,
  found: { count: number; first: Int8Array | null },
): void {
  if (found.count >= cap) return;

  const index = mostConstrained(masks, values);
  if (index === -1) {
    found.count++;
    if (found.first === null) found.first = values.slice();
    return;
  }

  const mask = masks[index]!;
  if (mask === 0) return;

  for (let digit = 1 as Digit; digit <= 9; digit = (digit + 1) as Digit) {
    if ((mask & bitOf(digit)) === 0) continue;

    const savedMasks = masks.slice();
    const savedValues = values.slice();

    values[index] = digit;
    masks[index] = bitOf(digit);
    let viable = true;
    for (const peer of peersOf(index)) {
      if (values[peer] !== 0) continue;
      masks[peer]! &= ~bitOf(digit);
      if (masks[peer] === 0) {
        viable = false;
        break;
      }
    }

    if (viable) search(masks, values, cap, found);

    masks.set(savedMasks);
    values.set(savedValues);

    if (found.count >= cap) return;
  }
}

/**
 * How many solutions this board has, counting no further than `cap`.
 * Returns 0, 1, or `cap` (meaning "at least cap").
 */
export function countSolutions(clues: readonly (Digit | null)[], cap = 2): number {
  const masks = buildMasks(clues);
  if (masks === null) return 0;

  const values = new Int8Array(81);
  for (const index of ALL_INDICES) {
    const digit = clues[index];
    if (digit != null) values[index] = digit;
  }

  const found = { count: 0, first: null as Int8Array | null };
  search(masks, values, cap, found);
  return found.count;
}

/**
 * The completed grid, or null if unsolvable.
 *
 * Engine-internal. Its result must never cross into State -- see the solution
 * quarantine rule in the constitution.
 */
export function solve(clues: readonly (Digit | null)[]): readonly Digit[] | null {
  const masks = buildMasks(clues);
  if (masks === null) return null;

  const values = new Int8Array(81);
  for (const index of ALL_INDICES) {
    const digit = clues[index];
    if (digit != null) values[index] = digit;
  }

  const found = { count: 0, first: null as Int8Array | null };
  search(masks, values, 1, found);

  return found.first === null ? null : (Array.from(found.first) as Digit[]);
}
