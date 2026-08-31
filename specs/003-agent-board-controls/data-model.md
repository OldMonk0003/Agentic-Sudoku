# Data Model: Agent Board Controls & Coordinate Ruler

**Feature**: `specs/003-agent-board-controls` | **Date**: 2026-08-31

What this feature adds and changes. Types are shown in the shape they will take; the reasoning behind
each lives in [research.md](./research.md).

Nothing in the **Engine layer changes at all** — this feature adds no game rules.

---

## 1. `Preferences` — the third store

**New module**: `src/state/preferences.ts`. A plain TypeScript module like the other two stores: no
React, no DOM, no timers, no randomness.

```ts
export interface Preferences {
  /** FR-006. Defaults to false for a learner who has never set it (FR-015). */
  readonly rulerVisible: boolean;
}
```

### Why it is its own store

Not `GameSession` (FR-014: not game data, not undoable). Not the agent session (never persisted, and
must work with no agent — FR-013). See [R2](./research.md#r2).

### Actions

| Action | Effect |
|---|---|
| `showRuler()` | Sets `rulerVisible: true`. Succeeds as a no-op when already true (FR-011) |
| `hideRuler()` | Sets `rulerVisible: false`. Succeeds as a no-op when already false (FR-011) |
| `loadPreferences(prefs)` | Adopts a validated restored payload; the only wholesale replacement |

Dispatch returns `{ ok: true, changed: boolean }` in the same shape the game store uses, so a no-op is
reported as `changed: false` rather than as a failure.

### Persistence

**Its own key and its own version. The session's key and `SCHEMA_VERSION = 1` are untouched**, so no
in-progress board is invalidated by this feature ([R2](./research.md#r2)).

```ts
const PREFERENCES_KEY = 'agentic-sudoku/preferences';
const PREFERENCES_SCHEMA_VERSION = 1;

interface PersistedPreferences {
  readonly schemaVersion: 1;
  readonly rulerVisible: boolean;
}
```

**Untrusted-input rules**, identical in spirit to `persistence.ts`:

| Stored value | Result |
|---|---|
| Absent | Default (`rulerVisible: false`) |
| Unparseable JSON | Default; payload discarded |
| Unrecognised `schemaVersion` | Default; payload discarded |
| `rulerVisible` not a boolean | Default; payload discarded — never coerced |
| Storage backend throws (private mode, quota) | Default; the ruler simply does not persist. **Not a player-facing error** |

Discard rather than partially apply, per the constitution's storage rule.

---

## 2. `Spotlight` — where the agent last acted

**New module**: `src/state/spotlight.ts`, holding the shape and the derived set. The **slot** lives on
the agent session store beside `toast` and `confirmation`.

```ts
export interface Spotlight {
  /** The cells that actually changed. */
  readonly cells: readonly Coord[];
  /** Set only when exactly one cell changed; drives the row/column/box form. */
  readonly focus: Coord | null;
  /** Absolute expiry. Expiry is a selector over this, never a timer (002 pattern). */
  readonly expiresAt: number;
}
```

On `AgentSession`:

```ts
readonly spotlight: Spotlight | null;   // a SLOT, so "at most one" is structural (FR-022)
```

### Shape by cardinality

| Cells changed | `focus` | Rendered set | Rationale |
|---|---|---|---|
| 1 | that cell | the cell + its row, column, box (21 cells) | FR-018: see where it happened |
| 2 – 9 | `null` | just the changed cells | FR-026: extent, without flooding |
| > 9 | — | **no spotlight raised at all** | `auto_fill_all_pencil_marks` touches every empty cell; sixty spotlit cells convey nothing and obscure the board |

`SPOTLIGHT_MAX_CELLS = 9` is the threshold, exported and asserted.

### Lifecycle

```
  agent write succeeds ──▶ spotlight replaced (never appended)
                            │
                            ├── SPOTLIGHT_TTL_MS elapses ──▶ gone  (FR-023)
                            ├── clear_visual_annotations  ──▶ gone  (FR-023, 002/FR-031)
                            └── a later agent write       ──▶ replaced (FR-022)
```

- **TTL**: `SPOTLIGHT_TTL_MS`, aligned with `ANNOTATION_TTL_MS` (60 s). One expiry vocabulary.
- **Expiry is a pure selector** over `expiresAt`, driven by the `expire` tick the View already runs.
  The State layer runs no timer, and the behaviour is deterministic in a headless test.
- **Never persisted** (FR-024). It lives on the agent session store, which `serialiseSession` has no
  route to — the same structural guarantee 002 relies on.
- **Never in `history`** (FR-024). It is not a `ChangeRecord` and no undo touches it.

### Derived

```ts
/** Flat indices to render, empty when no spotlight is live. */
export function spotlitIndices(spotlight: Spotlight | null, now: number): ReadonlySet<number>;
/** Which of those are the focus cell itself, for the corner glyph. */
export function spotlightFocusIndex(spotlight: Spotlight | null, now: number): number | null;
```

Computed per render over at most 21 cells — trivially inside the 16 ms frame budget, and computing
rather than storing keeps it from drifting out of step with the board.

---

## 3. `Confirmation` — generalised to two subjects

**Changed**: `src/state/confirmation.ts`. One field renamed, one added.

```ts
export type ConfirmationKind = 'drill' | 'difficulty';

export interface Confirmation {
  readonly id: string;
  readonly kind: ConfirmationKind;        // NEW
  readonly subject: string;               // WAS `technique` — now a technique id OR a difficulty
  readonly prompt: string;                // agent-authored, UNTRUSTED, rendered as a text node
  readonly expiresAt: number;
  readonly answer: 'accepted' | 'declined' | null;
}
```

**Still exactly one slot.** A second request while one is unanswered is **rejected**, never queued and
never stacked — the spec forbids showing the learner two prompts at once, and a single slot with an
explicit rejection makes that structural ([R8](./research.md#r8)).

`CONFIRMATION_TTL_MS = 60_000` and the decline-on-timeout rule are reused unchanged, so an unanswered
difficulty prompt cannot hang the agent's call.

### State transitions

```
   (none) ──askConfirmation──▶ pending ──answerConfirmation(accepted)──▶ accepted ──▶ act
                                 │
                                 ├─────answerConfirmation(declined)───▶ declined ──▶ report, no change
                                 └─────expiresAt passes───────────────▶ declined ──▶ report, no change
```

A second `askConfirmation` while `pending` is a rejection at the tool boundary, not a state
transition.

---

## 4. The puzzle-request signal — the Tools↔UI seam

**Changed**: `src/state/agentSession.ts`. Mirrors `disconnectRequests`, which already works this way
in the opposite direction ([R1](./research.md#r1)).

```ts
readonly puzzleRequest: { readonly difficulty: Difficulty; readonly id: number } | null;
readonly puzzleRequests: number;   // monotonic counter; the UI watches it, as registry.ts watches disconnectRequests
```

| Actor | Does |
|---|---|
| Tools (`switch_difficulty`) | Dispatches `requestPuzzle({ difficulty })`, then waits |
| UI (`GameScreen`) | Subscribed; on a new counter value calls `requestPuzzle()` from `puzzleLoader.ts` |
| Tools | Resolves by observing the **game store**: `status: 'generating' → 'playing'` with a new puzzle (loaded), or the failure signal (failed) |

Neither layer imports the other. The lint rule stays true.

**Generation failure** is reported through `puzzleGenerationFailed()` on the agent session store,
dispatched by the UI when `puzzleLoader` exhausts its retry budget. Without it, `switch_difficulty`
could only fail by timing out, and FR-036 requires it to say the attempt failed.

---

## 5. `WriteOutcome` — one optional field

**Changed**: `src/tools/narration.ts`.

```ts
export type WriteOutcome =
  | { readonly ok: true;
      readonly data: unknown;
      /** Cells this write changed. The wrapper raises the spotlight from it (R4). */
      readonly changed?: readonly Coord[] }
  | { readonly ok: false; readonly code: ErrorCode; readonly message: string;
      readonly details?: Readonly<Record<string, unknown>> };
```

Optional because three of the five new tools change no cells. Handled in the wrapper rather than in
each tool so a write tool cannot forget — the same argument the file already makes about the
explanation ([R4](./research.md#r4)).

**Ordering is unchanged and load-bearing**: `validate → mutate → publish`. The spotlight is published
with the explanation, after the mutation succeeds. A spotlight on a rejected write would point at a
cell that did not change.

---

## 6. Tool surface metadata

**Changed**: `src/tools/types.ts`.

```ts
export const TOOL_SURFACE_VERSION = '1.1.0';   // was '1.0.0' — additive (002/FR-010, R10)
```

New `ErrorCode` members:

| Code | Raised when |
|---|---|
| `unknown-difficulty` | A level the game does not offer; the result lists the ones that exist (FR-029) |
| `confirmation-pending` | A second confirmation requested while one is unanswered |
| `generation-failed` | No puzzle satisfying the integrity rules could be produced (FR-036) |

No existing code is removed or repurposed, so no agent coded against 1.0.0 breaks.

---

## Invariants this feature must preserve

Each is already asserted by an existing test that must still pass, or gets a new one.

| Invariant | Guarded by |
|---|---|
| The solution never leaves the Engine | `tests/unit/tools.no-solution-leak.test.ts`, extended to 16 tools |
| The store runs headlessly with no DOM | `tests/unit/store.headless.test.ts` — must not need a browser |
| Tools never touch `document` outside `registry.ts` | `tests/unit/tools.layering.test.ts` |
| `src/tools` ↔ `src/ui` import neither way | `eslint.config.mjs`, `import/no-restricted-paths` |
| Annotations and spotlight never persist | Extend the localStorage assertion to `spotlight` |
| Agent changes undo exactly like a learner's | `tests/unit/actions.origin-parity.test.ts` |
| The ruler is **not** undoable and **not** in history | New test: dispatching ruler actions leaves `history` untouched |
| The learner's selection is never moved by an agent | New test: selection is byte-identical across every agent write |
| Existing saved sessions still restore | `tests/unit/persistence.roundtrip.test.ts` — unchanged, and must stay that way |
