# Phase 0 Research: Restart, Undo, and Prompt-Free Board Replacement

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-02

Six questions. All are answered from this repository rather than from outside it — unlike feature
004, nothing here depends on a third party. Two of the answers **contradicted the spec as first
written**, and the spec has been corrected rather than the code bent to fit it.

---

## R1 — What does "restart" actually reuse?

**Decision**: `requestPuzzle(currentDifficulty)`. The behaviour already exists; this feature gives it
a control and a tool.

`src/ui/puzzleLoader.ts` already generates off-thread, verifies uniqueness, re-derives difficulty,
retries on exhaustion, and ignores superseded requests. Two callers already do exactly what Restart
means:

```ts
// DifficultySelect.tsx — selecting the level you are already on
onChange={(event) => requestPuzzle(event.target.value as Difficulty)}

// CompletionBanner.tsx — "new puzzle" after a win
onNewPuzzle={() => requestPuzzle(session.puzzle?.difficulty ?? 'easy')}
```

**The second one is Restart already.** The completion banner has shipped this exact behaviour since
feature 001; it is simply unreachable until you win. So US1 is a button wired to a function that is
already proven, not new machinery.

**Alternatives considered**: a `restartPuzzle` action in the State layer (rejected — the generator
lives in the UI because `Worker` is a browser API, and a state action could not reach it); clearing
the board and re-presenting the same puzzle (rejected — the description says "a different game", and
the spec records that as its most easily-misread requirement).

---

## R2 — How is "a *different* puzzle" guaranteed rather than merely likely?

**Decision**: compare the generated `puzzleString` against the one on screen and regenerate on a
match. Currently nothing does, and SC-003 states a guarantee the code only makes probable.

`requestPuzzle` seeds with `Date.now() >>> 0` and `sudoku-gen` draws its own randomness. Repeating
the exact grid is vanishingly unlikely — but "vanishingly unlikely" is not what SC-003 says, and the
check costs one string comparison against a value the store already holds.

**Where it goes**: `puzzleLoader.ts`, beside the existing retry-on-exhaustion path, which already has
the shape for "reject this candidate and go again". It applies to every caller, so the learner's
difficulty control gets the same guarantee for free.

**Alternatives considered**: asserting it only in tests (rejected — a test that a property holds
*usually* is a flake generator); ignoring it (rejected — SC-003 is written as an absolute, so either
the code or the criterion had to change, and the code is cheaper).

---

## R3 — What are undo's real status rules? *(contradicted the spec)*

**Decision**: **permitted on a completed board, rejected while paused.** The spec said "rejected while
paused or complete" and was wrong about complete.

`undoLast` in `src/state/lifecycle.ts` has **no status guard at all**:

```ts
export function undoLast(session: GameSession): ReducerOutcome {
  const record = session.history.at(-1);
  if (!record) return reject('nothing-to-undo');
  ...
    // Undoing out of a completed board returns it to play.
    status: session.status === 'complete' ? 'playing' : session.status,
```

That last line is deliberate, and the learner's Undo button is disabled only by `!canUndo` — never by
status. So **the learner can already undo out of a completed board**, and FR-012 ("exactly the result
the learner's own control produces") forces the agent to match.

Two consequences worth stating rather than discovering later:

1. **The paused rejection needs an explicit guard in the tool.** Every *edit* path guards status —
   `edits.ts` rejects `wrong-status` in four places — but `undoLast` does not, and `defineWriteTool`
   deliberately does not gate on status either (that is what keeps `resume_timer` working). So
   nothing would stop an agent undo on a paused board unless the tool checks. Same shape as
   `pause_timer`'s own explicit guard.
2. **A pre-existing asymmetry is now visible**: the learner's Undo button sits *outside* the pause
   overlay in `GameScreen.tsx`, so a learner can undo while paused; the agent may not (002/FR-045).
   This predates the feature. **Observed, not fixed** — changing it is a behaviour change to feature
   001 that nobody asked for.

**Alternatives considered**: making the agent's undo refuse on a complete board for symmetry with
001/FR-039's "read-only when complete" (rejected — it would diverge from the button, which is the one
thing FR-012 forbids, and 001/FR-039's tension with `undoLast` predates this feature).

---

## R4 — How does the undo tool report *whose* change it reversed (FR-016)?

**Decision**: read `history.at(-1)` **before** dispatching, and report the `origin` on the record's
`after` side.

A `ChangeRecord` carries `before` and `after` arrays of `{ index, cell }`, and every `Cell` carries
`origin: 'clue' | 'player' | 'agent'`. The `after` side is what the change *wrote*, so its origin is
the actor who made it. The record also names the `action`, which is worth reporting too — "took back
your whole-board pencil fill" is a more useful sentence than "took back a change".

The read must happen first: after the dispatch the record is gone from history.

**Alternatives considered**: adding an author field to `ChangeRecord` (rejected — the information is
already there, and a second copy could disagree with the cells); reporting nothing (rejected —
FR-016 exists so the agent can narrate what it just took back, and narration is mandatory anyway).

---

## R5 — What does retiring the confirmation actually touch?

**Decision**: delete it rather than leave it unreachable. **24 files** reference it — this feature is
mostly a removal.

| Layer | Goes |
|---|---|
| State | `confirmation.ts` entirely; the `confirmation` slot, its actions, and its reducer arms in `agentSession.ts` / `agentActions.ts` / `agentReduce.ts` |
| Tools | the `ConfirmationWaiter` machinery in `switchDifficulty.ts` and `loadTechniquePractice.ts`; the `confirmation-pending` error code |
| UI | `ConfirmationBanner.tsx`, and its mount in `GameScreen.tsx` |
| Tests | `agentSession.confirmation.test.ts`, `a11y/agent-confirmation.spec.ts`, and the confirmation arms of eight other suites |

**Why delete rather than disable.** FR-024 requires retirement, and the reason is maintenance rather
than tidiness: a prompt that no code path can raise still *looks* like a live safeguard to the next
reader, who may then trust a protection that cannot fire. Dead safety machinery is worse than absent
safety machinery, because it lies.

**What this simplifies as a side effect.** Both `switch_difficulty` and `load_technique_practice`
lose their waiter, their timeout, their `confirmation-pending` branch, and their `outcome: 'declined'`
path. `switch_difficulty` in particular drops from 247 lines to something much closer to
`restart_puzzle` — which motivates R6.

**Is removing an error code a breaking surface change?** No. 002/FR-010 reserves MAJOR for renaming a
tool, removing a tool, or narrowing a schema. `confirmation-pending` is none of those, and an agent
written against 1.1.0 that handled it simply never sees it again. **1.1.0 → 1.2.0**, two tools added.

---

## R6 — `restart_puzzle` and `switch_difficulty` are now nearly the same tool

**Decision**: extract one shared board-replacement routine in the Tools layer; both tools call it.

With the confirmation gone, both reduce to the same four steps: reject if paused, raise a puzzle
request on the agent session store, wait for the game store to settle on a puzzle whose identity
differs, and report the result or a generation failure. The only difference is where the difficulty
comes from — an argument for one, the current board for the other.

`storeGenerator` in `switchDifficulty.ts` already implements the waiting half, including the
`puzzleFailures` counter that lets a failure be reported rather than only timed out (003/FR-036).
Lifting it into its own module gives both tools one implementation to be correct in.

**This is the seam 003 established, unchanged**: `src/tools → src/ui` is a lint error, so no tool
calls the generator. It raises `requestPuzzle` on the agent store and `GameScreen` performs it.
`restart_puzzle` needs no new plumbing at all — only the current difficulty, which
`store.getState().puzzle?.difficulty` already provides.

**Alternatives considered**: `restart_puzzle` delegating to `switch_difficulty`'s descriptor
(rejected — a tool calling another tool doubles the narration and would queue two explanations for
one action); duplicating the wait logic (rejected — Principle III's composition rule, and the failure
path is subtle enough that two copies would drift).

---

## R7 — Where does the Restart button go?

**Decision**: in the header beside the difficulty control — **not** in the `Controls` row with Erase
and Undo.

Restart replaces the board without asking (FR-006). Erase and Undo are the two most-pressed,
lowest-stakes controls on the page. Putting an unconfirmed board-destroying button immediately beside
the button people press repeatedly and without looking is a mis-click waiting to happen, and the
consequence is unrecoverable: a replaced board is not in the undo history and only one game is ever
saved.

Beside `DifficultySelect` it also sits with the control it is semantically a variant of — R1 shows it
*is* the difficulty control aimed at the current level.

**Alternatives considered**: the `Controls` row (rejected on the mis-click grounds above); a
confirmation on the learner's own Restart (rejected — FR-006, and it would be inconsistent with the
difficulty control, which already discards a board without asking).

---

## Summary of decisions

| # | Question | Decision |
|---|---|---|
| R1 | What Restart reuses | `requestPuzzle(currentDifficulty)` — the completion banner already ships this |
| R2 | Guaranteeing a different grid | Compare `puzzleString`, regenerate on a match, in `puzzleLoader` |
| R3 | Undo status rules | Permitted on complete, rejected on paused — **spec corrected** |
| R4 | Reporting whose change | Read `history.at(-1)` before dispatch; `after` side carries `origin` |
| R5 | Retiring the confirmation | Delete across 24 files; dead safety machinery lies |
| R6 | Two near-identical tools | One shared replacement routine; the 003 seam unchanged |
| R7 | Restart button placement | Beside difficulty, away from Erase/Undo |
