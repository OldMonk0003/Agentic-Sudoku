# Contract: Store Actions

**Layer**: `src/state/` | **Consumers**: `src/ui/`, tests, and — at feature 002 — `src/tools/`

This is the complete set of mutations. **Every** change to the game passes through one of these named
actions; there is no other write path (Principle III). The store imports no React and can be driven to
completion with no DOM mounted — that property is what makes feature 002's headless tool registration
possible, and it is asserted by test.

---

## Store shape

```ts
export interface Store {
  getState(): GameSession;
  subscribe(listener: () => void): () => void;   // returns unsubscribe
  dispatch(action: Action): DispatchResult;
}

type DispatchResult =
  | { ok: true;  changed: boolean }
  | { ok: false; reason: RejectionReason };

type RejectionReason =
  | 'cell-is-clue' | 'cell-not-empty' | 'out-of-range'
  | 'wrong-status' | 'nothing-to-undo' | 'no-selection';
```

**Every rejection is a returned value, never a thrown error** — the same discipline feature 002's tool
handlers require, established here so both actors get identical treatment.

---

## Actions

| Action | Payload | Rejects when | Undoable | Requirements |
|---|---|---|---|---|
| `newPuzzle` | `{ difficulty }` | — | no (clears history) | FR-004, 033 |
| `selectCell` | `{ row, col }` | out of range | no | FR-006 |
| `moveSelection` | `{ direction }` | no selection | no | FR-019 |
| `setInputMode` | `{ mode }` | — | no | FR-013 |
| `toggleInputMode` | — | — | no | FR-014 |
| `enterDigit` | `{ digit, origin }` | clue, no selection, not `playing` | **yes** | FR-015, 021, 045 |
| `toggleCandidate` | `{ digit, origin }` | clue, cell has value, not `playing` | **yes** | FR-016 |
| `eraseCell` | `{ origin }` | clue, no selection, not `playing` | **yes** | FR-018, 030 |
| `undo` | — | history empty | — | FR-031, 032 |
| `pause` / `resume` | — | not `playing` / not `paused` | no | FR-035 |
| `tick` | `{ deltaMs }` | not `playing` | no | FR-034, 036 |

`origin` is `'player'` here and `'agent'` at feature 002. It is a parameter rather than an assumption
precisely so the agent path reuses these actions unchanged (002/FR-042).

---

## Behavioural contracts

### `enterDigit` — the compound action

One dispatch, one history record, covering all of:

1. Write `digit` into the selected cell, setting `origin`.
2. Clear that cell's candidates (FR-017).
3. **Strip `digit` from the candidates of all 20 peers** (FR-023).
4. Recompute derived state; conflicts and completion follow automatically.

Steps 1–3 are recorded in **one** `ChangeRecord` listing every cell touched. A single `undo` restores
all of them (FR-024). This is the action most likely to be got wrong, and it carries a dedicated test
asserting that placing a digit which clears six peer candidates produces exactly one history entry
covering seven cells.

### `newPuzzle`

Sets `status: 'generating'`, requests generation from the worker, clears history entirely, resets
`elapsedMs`. Discards the current board **without confirmation** — the spec's documented assumption. On
worker failure, remains in `generating` and retries; it never falls back to an unverified puzzle.

### `undo`

Pops the newest `ChangeRecord` and replays its `before`. Makes no distinction between player and agent
origin — feature 002 depends on this being true rather than added later.

### `tick`

Accumulates elapsed time. The **View** owns the interval; the store owns the number. This keeps the
State layer free of timers (Principle III) and makes elapsed time deterministic in tests.

---

## Persistence

Not an action. `persistence.ts` subscribes to the store and writes debounced (~250 ms). It reads once at
startup. A write failure is caught, surfaced once unobtrusively, and never propagated into a dispatch
(FR-042).

---

## Invariants asserted by contract tests

1. Every dispatch either changes state and returns `ok: true`, or changes nothing and returns
   `ok: false` with a reason. There is no partial application.
2. No dispatch ever throws.
3. A clue cell is unchanged after every action, through every path.
4. `history.length` increases by exactly one per undoable action, and by zero for all others.
5. The store is drivable to a completed puzzle with **no DOM mounted** — a full game played through
   `dispatch` alone in a plain Node test.
6. Serialised persisted state never contains a complete 81-digit solution grid.
