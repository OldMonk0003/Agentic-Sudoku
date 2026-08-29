import { ALL_INDICES, DIGITS, peersOf, type CellIndex, type Digit } from './grid';

/** Digits not already present among a cell's 20 peers. */
export function legalCandidates(
  values: readonly (Digit | null)[],
  index: CellIndex,
): ReadonlySet<Digit> {
  if (values[index] != null) return new Set<Digit>();

  const taken = new Set<Digit>();
  for (const peer of peersOf(index)) {
    const digit = values[peer];
    if (digit != null) taken.add(digit);
  }
  return new Set(DIGITS.filter((d) => !taken.has(d)));
}

/** Candidate sets for the whole board, derived from the visible values only. */
export function allCandidates(
  values: readonly (Digit | null)[],
): readonly ReadonlySet<Digit>[] {
  return ALL_INDICES.map((index) => legalCandidates(values, index));
}
