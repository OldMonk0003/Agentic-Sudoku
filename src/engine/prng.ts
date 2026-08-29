/**
 * The single source of randomness in first-party code.
 *
 * Constitution, Determinism: `Math.random()` is prohibited everywhere else in
 * this project. A dependency's internal randomness (sudoku-gen) is permitted
 * only because its output is independently verified and the resulting puzzle
 * string is recorded.
 *
 * mulberry32: small, fast, and deterministic given a seed.
 */
export function createPrng(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
