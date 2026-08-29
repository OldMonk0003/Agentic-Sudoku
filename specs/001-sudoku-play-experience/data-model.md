# Data Model: Core Sudoku Play Experience

**Feature**: `001-sudoku-play-experience` | **Date**: 2026-08-29

Types are described in TypeScript shape. Everything here lives in the Engine or State layer; the View
layer owns no data of its own (Principle III).

---

## Addressing convention

One convention, used everywhere, matching feature 002's `FR-007` so the agent and the human speak the
same coordinates.

- **Rows** 1–9, top to bottom. **Columns** 1–9, left to right. **Boxes** 1–9, reading order.
- Internally cells are stored in a flat 81-element array; `index = (row - 1) * 9 + (col - 1)`.
- `box = floor((row - 1) / 3) * 3 + floor((col - 1) / 3) + 1`.
- Flat indices are an implementation detail. Every public boundary — Engine API, store actions, future
  agent tools — uses 1-indexed `{ row, col }`.

---

## Engine types (pure, no DOM, no React)

### `Digit`, `CellIndex`

```ts
type Digit = 1|2|3|4|5|6|7|8|9;
type CellIndex = number;          // 0..80
type Coord = { row: number; col: number };   // both 1..9
```

### `Puzzle`

Immutable once generated. Produced only by the Engine.

| Field | Type | Notes |
|---|---|---|
| `clues` | `ReadonlyArray<Digit \| null>` | 81 entries; `null` = empty at start |
| `difficulty` | `Difficulty` | **Our** technique-derived rating, never the library's label |
| `puzzleString` | `string` | 81 chars, `-` for empty. The reproducibility record (constitution, Principle IV) |
| `techniquesRequired` | `ReadonlyArray<TechniqueId>` | What the rating was derived from |

```ts
type Difficulty = 'easy' | 'medium' | 'hard';
```

**Invariants**, all test-enforced:
- `clues.length === 81`
- exactly one solution, proven by the counting solver
- `difficulty` derived from `techniquesRequired`, never from clue count
- `puzzleString` round-trips: parsing it reproduces `clues` exactly

### `Solution` — quarantined

```ts
type Solution = ReadonlyArray<Digit>;   // 81 entries, never null
```

**This type must not appear in any State, View, persistence, or agent-tool type.** It is held inside
the Engine module that generated it and is used only to verify uniqueness. A test asserts the solution
string does not appear anywhere in serialised session state. See constitution § Solution quarantine.

---

## State types (framework-agnostic store)

### `Cell`

The live contents of one position.

| Field | Type | Notes |
|---|---|---|
| `value` | `Digit \| null` | Current digit, whoever placed it |
| `candidates` | `ReadonlySet<Digit>` | Pencil marks; empty when `value` is set |
| `origin` | `CellOrigin` | Who put the value there |

```ts
type CellOrigin = 'clue' | 'player' | 'agent';   // 'agent' reserved for feature 002
```

**Invariants**: a cell never holds both a `value` and candidates (FR-017). `origin === 'clue'` implies
the cell is immutable through every path (FR-005, FR-018, FR-021, FR-030).

### `GameSession`

The single source of truth. This is the unit that is saved and restored.

| Field | Type | Notes |
|---|---|---|
| `puzzle` | `Puzzle` | The board being solved |
| `cells` | `ReadonlyArray<Cell>` | 81 entries |
| `selection` | `Coord \| null` | Exactly one cell or none (FR-006) |
| `inputMode` | `'normal' \| 'notes'` | FR-013 |
| `elapsedMs` | `number` | Accumulated play time |
| `status` | `SessionStatus` | Drives what input is accepted |
| `history` | `ReadonlyArray<ChangeRecord>` | Undo stack, oldest first |

```ts
type SessionStatus = 'generating' | 'playing' | 'paused' | 'complete';
```

**State transitions**:

```
generating ──puzzle ready──> playing
playing    ──pause────────> paused
paused     ──resume───────> playing
playing    ──all filled, no conflicts──> complete
complete   ──new puzzle───> generating
paused     ──new puzzle───> generating
```

Rules on transitions:
- Cell mutations are accepted **only** in `playing` (FR-035, FR-039; and feature 002's FR-045).
- Entering `paused` stops timer accumulation and obscures the board (FR-035).
- Entering `complete` stops the timer permanently (FR-036) and freezes the board (FR-039).
- Entering `generating` clears `history` entirely — undo never crosses a puzzle boundary (FR-033).

### `ChangeRecord`

One undoable step. **The critical design point**: a record captures *everything* one player action
altered, including candidates stripped automatically as a consequence, so a single undo restores the
exact prior state (FR-024, FR-031).

| Field | Type | Notes |
|---|---|---|
| `action` | `ActionId` | Which action produced it |
| `before` | `ReadonlyArray<{ index: CellIndex; cell: Cell }>` | Prior contents of every cell touched |
| `after` | `ReadonlyArray<{ index: CellIndex; cell: Cell }>` | New contents of the same cells |

**Invariant**: `before` and `after` cover the same cell indices. Undo replays `before`; the record is
then popped. A placement that auto-cleared six peer candidates is **one** record listing seven cells —
not seven records.

---

## Derived state (computed, never stored)

Selectors compute these on read. None is persisted; all are pure functions of `GameSession`.

| Derived value | Computed from | Serves |
|---|---|---|
| `conflictSet: Set<CellIndex>` | Duplicate digits within any row, column, or box | FR-025, FR-028 |
| `crosshairSet: Set<CellIndex>` | Row, column, and box of `selection` | FR-007 |
| `matchingSet: Set<CellIndex>` | Cells whose `value` equals the selected cell's `value` | FR-008, FR-011 |
| `isComplete: boolean` | All 81 cells filled **and** `conflictSet` empty | FR-037 |
| `canUndo: boolean` | `history.length > 0` | FR-032 |

**Why derived, not stored**: storing conflict state invites it drifting out of sync with the board.
Recomputation is trivially inside the 16 ms budget for 81 cells, and it makes FR-028 ("re-evaluated
after every change") true by construction rather than by discipline.

**Highlight tier precedence** when a cell qualifies for several — highest wins for the *fill*, and the
selection ring composes on top of whatever fill applies:

```
conflict wash  >  matching wash  >  crosshair wash  >  ground
+ selection ring (2px), drawn over any of the above
```

---

## Persistence types

### `PersistedSession` (schema v1)

Written to `localStorage` under a single key. Deliberately **not** the same shape as `GameSession`.

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` | Constitution requires a version and a migration path |
| `puzzleString` | `string` | Reproduces the puzzle; the solution is **not** stored |
| `difficulty` | `Difficulty` | |
| `values` | `string` | 81 chars, `-` for empty |
| `origins` | `string` | 81 chars, one of `c`/`p`/`a` |
| `candidates` | `string[]` | 81 entries, digits as a string, e.g. `"1479"` |
| `elapsedMs` | `number` | |
| `status` | `'playing' \| 'paused' \| 'complete'` | `generating` is never persisted |

**Deliberately not persisted**: `history` (undo does not survive a reload — a documented consequence
of restoring the board rather than the whole session), `selection`, `inputMode`, and every derived set.

**Read rules** (FR-042, FR-044):
- Unknown or future `schemaVersion` → discard, start fresh, no error shown.
- Any parse or validation failure → discard, start fresh, no error shown.
- Storage throwing on read or write → continue in memory, inform unobtrusively once.

---

## Traceability

| Entity | Spec entity | Requirements |
|---|---|---|
| `Puzzle` | Puzzle | FR-002–005, 044 |
| `Cell` | Cell | FR-005, 016–018, 022 |
| `GameSession` | Game Session | FR-006, 013, 034–041 |
| `ChangeRecord` | Change Record | FR-024, 031–033 |
| Derived sets | (implicit) | FR-007–011, 025–028, 037 |
| `PersistedSession` | (implicit) | FR-040–044 |
