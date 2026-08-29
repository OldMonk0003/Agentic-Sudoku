import type { Digit } from './grid';

/**
 * The 81-character puzzle representation, '-' for empty.
 *
 * This is the reproducibility record. sudoku-gen exposes no seed, so under the
 * constitution's widened Principle IV the puzzle definition itself is what the
 * session stores to reconstruct a board exactly.
 */

export function parsePuzzleString(text: string): (Digit | null)[] {
  if (text.length !== 81) {
    throw new RangeError(`puzzle string must be 81 characters, got ${text.length}`);
  }
  return Array.from(text, (ch) => {
    if (ch === '-' || ch === '.' || ch === '0') return null;
    const digit = Number(ch);
    if (!Number.isInteger(digit) || digit < 1 || digit > 9) {
      throw new RangeError(`invalid puzzle character: ${ch}`);
    }
    return digit as Digit;
  });
}

export function toPuzzleString(clues: readonly (Digit | null)[]): string {
  return clues.map((d) => (d === null ? '-' : String(d))).join('');
}
