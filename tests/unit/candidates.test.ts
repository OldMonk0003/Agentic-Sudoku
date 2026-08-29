import { describe, it, expect } from 'vitest';
import { legalCandidates, allCandidates } from '@/engine/candidates';
import { parsePuzzleString } from '@/engine/puzzleString';
import { peersOf, toIndex, type Digit } from '@/engine/grid';
import { generatePuzzle } from '@/engine/generate';

function board(entries: Record<string, number>) {
  const values = parsePuzzleString('-'.repeat(81));
  for (const [coord, digit] of Object.entries(entries)) {
    const [row, col] = coord.split(',').map(Number);
    values[toIndex({ row: row!, col: col! })] = digit as Digit;
  }
  return values;
}

describe('legalCandidates', () => {
  it('offers all nine digits on an empty board', () => {
    const set = legalCandidates(parsePuzzleString('-'.repeat(81)), 0);
    expect([...set].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('excludes a digit already present in the same row', () => {
    expect(legalCandidates(board({ '1,9': 4 }), toIndex({ row: 1, col: 1 })).has(4)).toBe(false);
  });

  it('excludes a digit already present in the same column', () => {
    expect(legalCandidates(board({ '9,1': 4 }), toIndex({ row: 1, col: 1 })).has(4)).toBe(false);
  });

  it('excludes a digit already present in the same box', () => {
    expect(legalCandidates(board({ '2,2': 4 }), toIndex({ row: 1, col: 1 })).has(4)).toBe(false);
  });

  it('excludes EVERY digit present among the 20 peers', () => {
    const generated = generatePuzzle({ difficulty: 'easy', seed: 606 });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;

    const clues = generated.puzzle.clues;
    for (let index = 0; index < 81; index++) {
      if (clues[index] !== null) continue;

      const candidates = legalCandidates(clues, index);
      const taken = new Set<Digit>();
      for (const peer of peersOf(index)) {
        const v = clues[peer];
        if (v != null) taken.add(v);
      }

      for (const digit of taken) {
        expect(candidates.has(digit), `index ${index} should exclude ${digit}`).toBe(false);
      }
      expect(candidates.size).toBe(9 - taken.size);
    }
  });

  it('returns an empty set for a cell that already holds a value', () => {
    expect(legalCandidates(board({ '1,1': 5 }), toIndex({ row: 1, col: 1 })).size).toBe(0);
  });

  it('never consults a solution — the visible board is the only input', () => {
    expect(legalCandidates.length).toBe(2);
  });
});

describe('allCandidates', () => {
  it('returns one set per cell', () => {
    expect(allCandidates(parsePuzzleString('-'.repeat(81)))).toHaveLength(81);
  });

  it('agrees with legalCandidates cell by cell', () => {
    const values = board({ '1,1': 5, '3,3': 7, '5,5': 2 });
    const all = allCandidates(values);
    for (let index = 0; index < 81; index++) {
      expect([...all[index]!].sort()).toEqual([...legalCandidates(values, index)].sort());
    }
  });
});
