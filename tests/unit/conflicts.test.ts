import { describe, it, expect } from 'vitest';
import { findConflicts } from '@/engine/conflicts';
import { parsePuzzleString } from '@/engine/puzzleString';
import { toIndex } from '@/engine/grid';

/** Build an 81-cell board from a sparse map of coordinate -> digit. */
function board(entries: Record<string, number>) {
  const values = parsePuzzleString('-'.repeat(81));
  for (const [coord, digit] of Object.entries(entries)) {
    const [row, col] = coord.split(',').map(Number);
    values[toIndex({ row: row!, col: col! })] = digit as never;
  }
  return values;
}

describe('findConflicts', () => {
  it('flags a duplicate within a row, returning BOTH participants', () => {
    const conflicts = findConflicts(board({ '1,1': 3, '1,5': 3 }));
    expect([...conflicts].sort((a, b) => a - b)).toEqual([
      toIndex({ row: 1, col: 1 }),
      toIndex({ row: 1, col: 5 }),
    ]);
  });

  it('flags a duplicate within a column', () => {
    const conflicts = findConflicts(board({ '2,4': 7, '8,4': 7 }));
    expect([...conflicts].sort((a, b) => a - b)).toEqual([
      toIndex({ row: 2, col: 4 }),
      toIndex({ row: 8, col: 4 }),
    ]);
  });

  it('flags a duplicate within a 3x3 box that shares neither row nor column', () => {
    const conflicts = findConflicts(board({ '4,4': 9, '6,6': 9 }));
    expect([...conflicts].sort((a, b) => a - b)).toEqual([
      toIndex({ row: 4, col: 4 }),
      toIndex({ row: 6, col: 6 }),
    ]);
  });

  it('returns EVERY participant when a digit appears three times', () => {
    const conflicts = findConflicts(board({ '1,1': 5, '1,4': 5, '1,9': 5 }));
    expect(conflicts.size).toBe(3);
  });

  it('includes a clue that participates in a conflict (spec edge case)', () => {
    // The clue is flagged as part of the pair even though it cannot be erased.
    const conflicts = findConflicts(board({ '3,3': 2, '3,7': 2 }));
    expect(conflicts.has(toIndex({ row: 3, col: 3 }))).toBe(true);
  });

  it('finds nothing on a legal board', () => {
    expect(findConflicts(board({ '1,1': 1, '1,2': 2, '2,1': 3, '9,9': 4 })).size).toBe(0);
  });

  it('finds nothing on an empty board', () => {
    expect(findConflicts(parsePuzzleString('-'.repeat(81))).size).toBe(0);
  });

  it('reports one cell once even when it conflicts in several units at the same time', () => {
    // (1,1) duplicates 6 along its row, its column, AND inside its box.
    const conflicts = findConflicts(board({ '1,1': 6, '1,5': 6, '5,1': 6, '2,2': 6 }));
    expect(conflicts.has(toIndex({ row: 1, col: 1 }))).toBe(true);
    expect(conflicts.size).toBe(4);
  });

  it('stays within the 16ms validation budget (Principle IV)', () => {
    const full = parsePuzzleString('5'.repeat(81));
    const start = performance.now();
    for (let i = 0; i < 100; i++) findConflicts(full);
    expect((performance.now() - start) / 100).toBeLessThan(16);
  });
});
