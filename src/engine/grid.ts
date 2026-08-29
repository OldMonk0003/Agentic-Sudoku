/**
 * Grid addressing primitives.
 *
 * One convention everywhere, matching feature 002's FR-007 so the agent and the
 * human speak identical coordinates: rows 1-9 top to bottom, columns 1-9 left to
 * right, boxes 1-9 in reading order.
 *
 * Flat indices are an implementation detail. Every public boundary -- engine API,
 * store actions, future agent tools -- uses 1-indexed { row, col }.
 */

export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type CellIndex = number; // 0..80
export interface Coord {
  readonly row: number; // 1..9
  readonly col: number; // 1..9
}

export const DIGITS: readonly Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const ALL_INDICES: readonly CellIndex[] = Array.from({ length: 81 }, (_, i) => i);

export function toIndex({ row, col }: Coord): CellIndex {
  return (row - 1) * 9 + (col - 1);
}

export function toCoord(index: CellIndex): Coord {
  return { row: Math.floor(index / 9) + 1, col: (index % 9) + 1 };
}

export function rowOf(index: CellIndex): number {
  return Math.floor(index / 9) + 1;
}

export function colOf(index: CellIndex): number {
  return (index % 9) + 1;
}

export function boxOf(index: CellIndex): number {
  const { row, col } = toCoord(index);
  return Math.floor((row - 1) / 3) * 3 + Math.floor((col - 1) / 3) + 1;
}

export function isValidCoord(coord: Coord): boolean {
  const { row, col } = coord;
  return Number.isInteger(row) && Number.isInteger(col) && row >= 1 && row <= 9 && col >= 1 && col <= 9;
}

export function isValidIndex(index: number): index is CellIndex {
  return Number.isInteger(index) && index >= 0 && index <= 80;
}

/** Built once at module load: 81 sets of exactly 20 peers each. */
const PEERS: readonly ReadonlySet<CellIndex>[] = ALL_INDICES.map((index) => {
  const peers = new Set<CellIndex>();
  for (const other of ALL_INDICES) {
    if (other === index) continue;
    if (rowOf(other) === rowOf(index) || colOf(other) === colOf(index) || boxOf(other) === boxOf(index)) {
      peers.add(other);
    }
  }
  return peers;
});

/** The 20 cells sharing a row, column, or box. Memoised, never rebuilt. */
export function peersOf(index: CellIndex): ReadonlySet<CellIndex> {
  return PEERS[index]!;
}

/** The nine indices of a given unit, for constraint checks. */
export function unitIndices(kind: 'row' | 'col' | 'box', n: number): readonly CellIndex[] {
  return ALL_INDICES.filter((i) =>
    kind === 'row' ? rowOf(i) === n : kind === 'col' ? colOf(i) === n : boxOf(i) === n,
  );
}
