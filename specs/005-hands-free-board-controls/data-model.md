# Phase 1 Data Model: Restart, Undo, and Prompt-Free Board Replacement

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-02

**This feature adds no state.** No new store, no new field, no new storage key, no schema version
bump. It **removes** state — one module and one slot — and adds two tools over data that already
exists.

What follows is therefore short: one entity deleted, three read-only shapes, and the invariants that
have to survive the deletion.

---

## 1. Confirmation — DELETED

```ts
// src/state/confirmation.ts — the whole module goes
export type ConfirmationKind = 'drill' | 'difficulty';
export interface Confirmation {
  readonly id: string;
  readonly kind: ConfirmationKind;
  readonly subject: string;
  readonly prompt: string;
  readonly expiresAt: number;
  readonly answer: 'accepted' | 'declined' | null;
}
export const CONFIRMATION_TTL_MS = 60_000;
```

Removed with it:

| Where | What |
|---|---|
| `agentSession.ts` | the `confirmation` slot, `visibleConfirmation`, the `Confirmation` re-exports, `CONFIRMATION_TTL_MS`, `canAsk` |
| `agentActions.ts` | `askConfirmation`, `answerConfirmation`, `clearConfirmation`, and their action-type entries |
| `agentReduce.ts` | the three reducer arms |
| `types.ts` (tools) | the `confirmation-pending` error code |
| `ConfirmationBanner.tsx` | the whole component and its mount |

**Why deletion and not disablement** (FR-024): every producer of a `Confirmation` was an
agent-initiated replacement, so after this feature nothing can construct one. A slot that no code
path can fill still reads to the next maintainer as a live safeguard. Dead safety machinery is worse
than absent safety machinery, because it lies about what protects the learner.

**The invariant this removes**: *"an agent may not replace the learner's board without being told it
may."* Nothing replaces it. FR-026 makes the Disconnect control the only remaining protection, which
is why it may not be weakened.

---

## 2. Restart Request

Not a stored entity — a **call**, resolving immediately. Modelled here because its inputs and
outcomes are what both the button and the tool are tested against.

| | |
|---|---|
| **Input** | Nothing. The difficulty is read from the board: `store.getState().puzzle?.difficulty` |
| **Precondition** | A puzzle exists, and the board is not `generating`. For the agent, also not `paused` (FR-009) |
| **Effect** | A new verified puzzle at the same difficulty; clock to zero; history emptied (FR-005) |
| **Outcomes** | `loaded` · `generation-failed` (board untouched, FR-010) · `wrong-status` |

**Invariants:**

- The difficulty **after** equals the difficulty **before** (FR-003) — this is what makes it a restart
  rather than a difficulty change.
- The new `puzzleString` differs from the previous one (FR-002, SC-003), enforced in `puzzleLoader`
  by regenerating on a match ([R2](./research.md#r2--how-is-a-different-puzzle-guaranteed-rather-than-merely-likely)).
- Exactly one solution, difficulty re-derived from techniques required — inherited from the existing
  generator, not re-implemented (FR-004).
- Permitted on a **complete** board, rejected on a **paused** one (FR-009).

---

## 3. Undo Request

Also a call. It carries **no target** — it always means "the most recent one".

| | |
|---|---|
| **Input** | Nothing beyond the mandatory `explanation` |
| **Precondition** | History is non-empty; the board is not paused (FR-015, FR-017) |
| **Effect** | The last `ChangeRecord` is reverted whole; a complete board returns to `playing` |
| **Outcomes** | `undone` · `nothing-to-undo` · `wrong-status` (paused) |

**What it reports, and where that comes from** ([R4](./research.md#r4--how-does-the-undo-tool-report-whose-change-it-reversed-fr-016)):

| Reported | Source |
|---|---|
| whose change it was | `history.at(-1).after[0].cell.origin` |
| what kind of change | `history.at(-1).action` |
| how many cells it touched | `history.at(-1).after.length` |
| remaining undo depth | `history.length` after the dispatch |

**The record must be read BEFORE dispatching.** After the dispatch it is gone from history, and the
tool would have nothing to report.

**Invariants:**

- One request reverses exactly one step (FR-013).
- A multi-cell record reverts whole or not at all — inherited from `revertRecord`, not re-implemented
  (FR-014).
- Authorship does not gate it: the agent may reverse the learner's change (FR-016). **There is no
  redo**, so this is destructive and is bounded only by narration, attribution, and Disconnect.
- The learner's selection does not move (FR-018) — undo addresses no cell, so this is true by
  construction rather than by care.

---

## 4. ChangeRecord — unchanged, and worth saying so

```ts
export interface ChangeRecord {
  readonly action: string;
  readonly before: readonly { readonly index: CellIndex; readonly cell: Cell }[];
  readonly after:  readonly { readonly index: CellIndex; readonly cell: Cell }[];
}
```

**No field is added.** FR-016 wants the author of a change, and `Cell.origin` on the `after` side
already carries it. Adding an author field to the record would create a second copy that could
disagree with the cells it describes — the same reasoning that keeps difficulty derived rather than
stored.

---

## What this feature deliberately does not model

- **A replaced board.** Nothing retains the puzzle an agent discarded. Recovering it is named in the
  spec's Assumptions as the obvious follow-up and scoped out here.
- **Redo.** 001 excluded it; making undo agent-reachable makes its absence more noticeable but does
  not change the decision.
- **Any record of who answered what.** With the confirmation gone there is nothing to record.
- **Restart or undo counts.** 001/FR-051 excludes cross-session statistics, and that applies here.
