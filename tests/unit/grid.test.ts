import { describe, it, expect } from 'vitest';
import { toIndex, toCoord, boxOf, peersOf, ALL_INDICES } from '@/engine/grid';

describe('grid addressing', () => {
  it('round-trips every coordinate through its index', () => {
    for (let row = 1; row <= 9; row++) {
      for (let col = 1; col <= 9; col++) {
        expect(toCoord(toIndex({ row, col }))).toEqual({ row, col });
      }
    }
  });

  it('places the corners where the convention says (rows top-down, cols left-right)', () => {
    expect(toIndex({ row: 1, col: 1 })).toBe(0);
    expect(toIndex({ row: 1, col: 9 })).toBe(8);
    expect(toIndex({ row: 9, col: 1 })).toBe(72);
    expect(toIndex({ row: 9, col: 9 })).toBe(80);
  });

  it('computes boxes in reading order', () => {
    expect(boxOf(toIndex({ row: 1, col: 1 }))).toBe(1);
    expect(boxOf(toIndex({ row: 1, col: 9 }))).toBe(3);
    expect(boxOf(toIndex({ row: 5, col: 5 }))).toBe(5);
    expect(boxOf(toIndex({ row: 9, col: 9 }))).toBe(9);
  });

  it('gives every cell exactly 20 peers', () => {
    for (const index of ALL_INDICES) {
      expect(peersOf(index).size, `index ${index}`).toBe(20);
    }
  });

  it('never lists a cell as its own peer', () => {
    for (const index of ALL_INDICES) {
      expect(peersOf(index).has(index)).toBe(false);
    }
  });

  it('makes peership symmetric', () => {
    for (const a of ALL_INDICES) {
      for (const b of peersOf(a)) {
        expect(peersOf(b).has(a), `${a} <-> ${b}`).toBe(true);
      }
    }
  });

  it('returns a stable memoised set rather than rebuilding it', () => {
    expect(peersOf(40)).toBe(peersOf(40));
  });
});
