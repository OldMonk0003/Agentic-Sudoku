# Contract: Board Replacement, and the Retired Confirmation

**Feature**: [../spec.md](../spec.md) | **Date**: 2026-09-02

Three tools now replace the board — `switch_difficulty`, `load_technique_practice`, and
`restart_puzzle`. This is the one routine they share, and the rules that apply to all three.

---

## The shared routine

Extracted because with the confirmation gone, `switch_difficulty` and `restart_puzzle` differ only in
where the difficulty comes from ([R6](../research.md#r6--restart_puzzle-and-switch_difficulty-are-now-nearly-the-same-tool)).

```
replaceBoard(difficulty) →
  1. reject if the board is paused or generating
  2. raise a puzzle request on the AGENT SESSION store
  3. wait for the GAME store to settle on a puzzle whose identity differs from the one before
  4. or for puzzleFailures to tick up  →  generation-failed
  5. or for the timeout             →  generation-failed
```

**Step 2 is the architectural constraint, unchanged from 003.** `src/tools → src/ui` is a lint error,
and generation lives in the UI because `Worker` is a browser API. So no tool calls the generator: it
raises a request and `GameScreen`, which is subscribed, performs it. `restart_puzzle` needs no new
plumbing — only the current difficulty, which the game store already holds.

**Step 4 exists because of 003/FR-036.** Without the `puzzleFailures` counter a failed generation
could only be reported by timing out, and the learner's board would appear to have been left alone
for the wrong reason.

| Guarantee | Source |
|---|---|
| Exactly one solution | the existing generator; never re-implemented here |
| Difficulty derived from techniques required | `rateDifficulty`, not the label requested |
| A grid different from the one on screen | `puzzleLoader` (R2), so learner controls get it too |
| Clock reset, history cleared | `loadPuzzle` in the state layer |
| The learner is never locked out while generating | generation is off the main thread |
| A failure leaves the board **exactly** as it was | nothing is dispatched until a verified puzzle exists |

---

## Rules for all three replacement tools

| Rule | |
|---|---|
| **No confirmation** | FR-020. Whatever progress the board carries. |
| **Narration is mandatory** | FR-022. The explanation is now the learner's *only* account of why their board changed, so it is not relaxed — 20–240 characters, validated before anything happens. |
| **Rejected while paused** | 002/FR-045, 003/FR-035. |
| **Permitted when complete** | No progress remains to lose. |
| **Stops a walkthrough** | 002/FR-049 — remaining steps address a board that no longer exists; the agent is told how far it got. |
| **Never waits on a human** | FR-023. The call completes when the board is ready or generation fails. |

---

## The retired confirmation

**Deleted, not disabled** (FR-024).

Every producer of a confirmation was an agent-initiated replacement, so once those stop raising one,
nothing can. What goes:

| Layer | |
|---|---|
| State | `confirmation.ts`; the slot, actions, selectors and reducer arms in `agentSession.ts`, `agentActions.ts`, `agentReduce.ts` |
| Tools | the `ConfirmationWaiter` machinery in both confirming tools; the `confirmation-pending` error code |
| UI | `ConfirmationBanner.tsx` and its mount in `GameScreen.tsx` |

**Why deleted.** A prompt no code path can raise still reads as a live safeguard to the next person
who opens the file. They may then believe the learner is protected when they are not. Dead safety
machinery is worse than absent safety machinery, because it lies.

**What is lost, stated so it is on the record in a contract and not only in a spec**: the guarantee
that an agent cannot discard the learner's board without being told it may. An agent that misreads
*"this is too easy"* as *"replace this"* now destroys the work with no question, **no undo — a
replaced board is not in the undo history** — and no retained copy, since only one game is ever
saved.

**What remains**: the narration contract, and the Disconnect control (002/FR-057). FR-026 requires
Disconnect to stay present and functional, because after this feature it is the learner's only
protection. The quickstart checks it explicitly rather than assuming nothing disturbed it.

---

## Test rule for the removal

**A test is deleted only when the behaviour it asserts no longer exists.**

Eight suites mention the confirmation while asserting something else — no-network behaviour, undo
parity, accessibility sweeps, tool latency. Those are **edited** to drop their confirmation arm and
keep the rest. Only `agentSession.confirmation.test.ts` and `a11y/agent-confirmation.spec.ts` are
deleted outright, because the prompt is the whole of what they test.

The suite count before and after is recorded in `tasks.md`, so a coverage drop is visible rather than
assumed.
