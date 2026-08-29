# Contract: Engine Public API

**Layer**: `src/engine/` | **Consumers**: `src/state/`, `src/workers/`, tests

The Engine is pure and deterministic. It imports no DOM, no React, no storage, no timers, and runs in a
bare Node process (Principle III). Everything below is the complete public surface; anything not listed
is private to the module and must not be imported across the boundary.

---

## `generate.ts`

```ts
export function generatePuzzle(request: GenerateRequest): GenerateResult;

type GenerateRequest = {
  difficulty: Difficulty;
  seed: number;              // seeds retry ordering; the puzzleString is the reproducibility record
  maxAttempts?: number;      // default 25
};

type GenerateResult =
  | { ok: true;  puzzle: Puzzle; attempts: number }
  | { ok: false; reason: 'exhausted-attempts'; attempts: number };
```

**Contract**:
1. Draws a candidate from `sudoku-gen`, mapping our three difficulties onto its bands.
2. **Verifies uniqueness with `countSolutions`.** A candidate with any count other than 1 is discarded
   and redrawn. A puzzle is never returned unverified, whatever the library claims.
3. **Rates by technique** via `rateDifficulty`. A puzzle whose rating misses the requested band is
   discarded and redrawn.
4. Never returns the solution. `GenerateResult` has no field that could carry it.
5. Deterministic given `seed` for retry ordering; the returned `puzzleString` reproduces the board
   exactly regardless.

**Tests**: property test over ≥10,000 generated puzzles asserting exactly one solution (SC-003); a test
asserting no returned object graph contains an 81-digit complete grid.

---

## `solver.ts`

```ts
export function countSolutions(clues: ReadonlyArray<Digit | null>, cap?: number): number;
export function solve(clues: ReadonlyArray<Digit | null>): ReadonlyArray<Digit> | null;
```

**Contract**:
- `countSolutions` **stops counting at `cap`** (default 2). It answers "none, exactly one, or more than
  one" — it never enumerates a full solution space.
- Both are pure and terminate on every 81-cell input, valid or not.
- `solve` is Engine-internal in practice; exported for tests only, and its result must never cross into
  State (solution quarantine).

**Budget**: `countSolutions` on a typical puzzle completes well inside the 500 ms generation budget; it
is the dominant cost of `generatePuzzle` and is why generation runs in a worker.

---

## `rating.ts`

```ts
export function rateDifficulty(clues: ReadonlyArray<Digit | null>): RatingResult;

type RatingResult = {
  difficulty: Difficulty;
  techniquesRequired: ReadonlyArray<TechniqueId>;
};
```

**Contract**: solves the puzzle using only the technique modules, in increasing order of difficulty,
recording which were needed. The rating is the band of the hardest technique required. **Clue count is
not an input** — Principle IV forbids it as the basis of a rating.

Band mapping: `easy` = naked and hidden singles only. `medium` = adds locked candidates and naked
pairs. `hard` = anything beyond. A puzzle the technique set cannot finish is rejected as unrateable.

---

## `techniques/`

Every technique is its own module with one uniform interface (Principle III).

```ts
export type TechniqueId = 'naked-single' | 'hidden-single' | /* extended by later slices */ string;

export interface Technique {
  readonly id: TechniqueId;
  readonly band: Difficulty;
  find(board: BoardView): TechniqueFinding | null;
}

type TechniqueFinding = {
  technique: TechniqueId;
  target: Coord;              // the cell the deduction resolves
  digit: Digit;
  because: ReadonlyArray<Coord>;  // the cells that justify it
};
```

**Contract**: `find` is pure, returns the first finding or `null`, and **never consults the solution**.
`because` must actually justify `digit` at `target` from the visible board alone — this is what makes
hints logically sound under Principle IV, and it is what feature 002's highlighting will render.

Adding a technique means adding a module and registering it in `techniques/index.ts`. No switch
statement anywhere grows.

---

## `conflicts.ts`

```ts
export function findConflicts(values: ReadonlyArray<Digit | null>): ReadonlySet<CellIndex>;
```

**Contract**: returns every index participating in a duplicate within any row, column, or box. Reports
**duplicate-constraint violations only** — it never compares against a solution (FR-029). Pure, and
inside the 16 ms budget for 81 cells.

---

## `candidates.ts`

```ts
export function legalCandidates(values: ReadonlyArray<Digit | null>, index: CellIndex): ReadonlySet<Digit>;
export function peersOf(index: CellIndex): ReadonlySet<CellIndex>;
```

**Contract**: `peersOf` returns the 20 cells sharing a row, column, or box (excluding itself), computed
once and cached. `legalCandidates` returns digits not present among peers — used by feature 002's
`auto_fill_all_pencil_marks` and by the auto-removal of FR-023.

---

## `prng.ts`

```ts
export function createPrng(seed: number): () => number;
```

**Contract**: the single source of randomness in first-party code. `Math.random()` is banned everywhere
else (constitution § Determinism). `sudoku-gen`'s internal randomness is permitted because its output is
independently verified and the resulting `puzzleString` is recorded.

---

## Forbidden across this boundary

- Returning, logging, or embedding a complete solution grid in anything reaching State or View.
- Importing anything from `src/state/`, `src/ui/`, or `app/` — enforced by import-direction lint.
- Reading `Date.now()`, `window`, `document`, or storage. Time is the State layer's concern.
