# Implementation Plan: Restart, Undo, and Prompt-Free Board Replacement

**Branch**: `005-hands-free-board-controls` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-hands-free-board-controls/spec.md`

**Builds on**: features 001–004, all on `main` at `46c9f70`. Cut this branch from `main` — unlike
003 and 004, `main` now carries the whole agent surface.

## Summary

A Restart control for the learner, two new agent tools (`restart_puzzle`, `undo_move`), and the
removal of the confirmation prompt. Tool surface **16 → 18**, version **1.1.0 → 1.2.0**.

**This feature is mostly a deletion.** The two new tools are thin — one wraps an action that already
exists, the other wraps a function the completion banner has been calling since feature 001. The
substantial work is retiring the confirmation mechanism across
[24 files](./research.md#r5--what-does-retiring-the-confirmation-actually-touch).

Four findings from [research](./research.md) shape the plan, and **two of them corrected the spec**:

1. **Undo is already permitted on a completed board** and the learner's button is disabled only by an
   empty history, never by status. The spec said the agent's undo should be rejected when complete;
   that would diverge from the button, which is the one thing FR-012 forbids. **Spec corrected**
   ([R3](./research.md#r3--what-are-undos-real-status-rules-contradicted-the-spec)).
2. **Nothing guarantees a restart yields a *different* grid.** SC-003 states an absolute that the code
   only makes probable. One string comparison in `puzzleLoader` closes it, for every caller
   ([R2](./research.md#r2--how-is-a-different-puzzle-guaranteed-rather-than-merely-likely)).
3. **`restart_puzzle` and `switch_difficulty` become nearly the same tool** once the confirmation is
   gone. One shared replacement routine, not two
   ([R6](./research.md#r6--restart_puzzle-and-switch_difficulty-are-now-nearly-the-same-tool)).
4. **The Restart button must not sit beside Erase and Undo.** An unconfirmed board-destroying control
   next to the two most-pressed buttons on the page is a mis-click with an unrecoverable consequence
   ([R7](./research.md#r7--where-does-the-restart-button-go)).

## Technical Context

**Language/Version**: TypeScript 5.9, `strict`. No `any` without an inline justification.

**Primary Dependencies**: Unchanged — Next.js 16 (static export), React 19, Tailwind 4, Lucide,
`sudoku-gen`. **No dependency added**, so Principle IV's budget re-validation trigger is not tripped.

**Storage**: Unchanged. Both storage keys and both schema versions stay as they are. Nothing this
feature touches is persisted — the confirmation never was (002/FR-034).

**Testing**: Vitest across `node`, `component`, `contract`; Playwright for e2e, a11y, perf. Two new
contract tests; a significant number of **deletions** where they covered the retired mechanism.

**Target Platform**: Evergreen browsers; `document.modelContext` where present, fully playable
without it.

**Project Type**: Client-side static web application, zero server runtime.

**Performance Goals**: `undo_move` holds the ≤ 100 ms p95 budget comfortably — it is one store
dispatch. `restart_puzzle` waits on off-thread generation and joins the existing exemption.
**Removing the confirmation narrows that exemption rather than widening it**: `switch_difficulty` no
longer waits up to 60 s on a human, only on generation.

**Constraints**: No network request. The solution never leaves the Engine. Palette values only in
`app/globals.css`. Layer boundaries enforced by lint. `src/tools → src/ui` remains a lint error, so
board replacement continues to go through the agent-session seam.

**Scale/Scope**: 2 tools added, 1 UI control added, 1 UI component deleted, 1 state module deleted,
~24 files touched, net **negative** lines expected.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — result unchanged.*

| Principle | Requirement | Initial | Post-design |
|---|---|---|---|
| **I. WebMCP standard compliance** | One channel; strict schemas; structured results; registration isolated and enumerable headlessly | **PASS** | **PASS.** Two tools added through the same registration module, both declared through `defineWriteTool` so they cannot skip narration. Surface version raised. Removing the `confirmation-pending` error code is not a rename, a removal, or a schema narrowing, so it is MINOR under 002/FR-010. |
| **II. Zero-backend, client-side only** | No runtime network request; local storage only | **PASS** | **PASS.** Nothing added reaches the network. Generation was already local and off-thread. |
| **III. Modular architecture** | Engine ← State ← Tools/View; single responsibility; no circular imports | **PASS** | **PASS, and improved.** The shared replacement routine (R6) removes a duplicate rather than adding an abstraction, and deleting `confirmation.ts` removes a module whose single responsibility no longer exists. `src/tools → src/ui` stays unviolated: `restart_puzzle` raises a request on the agent store exactly as `switch_difficulty` does. |
| **IV. Puzzle integrity & budgets** | Unique solutions; derived difficulty; ≤ 100 ms tool calls | **PASS** | **PASS, and the existing deviation NARROWS.** Restarted puzzles run through the same verified generator. `undo_move` is one dispatch. `switch_difficulty` stops waiting on a human — the 003 exemption still applies but for a smaller reason. |
| **V. Test-first & non-blocking feedback** | Failing tests first; contract test per tool; nothing blocks either actor; non-colour cues | **PASS** | **PASS.** Two contract tests written first. Removing the prompt removes the only agent-raised element that ever asked the learner to act. **Deleting a test is not exempt from Principle V** — see the note below. |

**On deleting tests.** Principle V is about tests arriving before code, and says nothing about
removal — but a feature that deletes 24 files' worth of assertions could quietly delete coverage of
things that still matter. The rule for this feature: a test is deleted **only** when the behaviour it
asserts no longer exists. A test that merely *mentions* the confirmation while asserting something
else (undo parity, no-network, a11y sweeps) is rewritten, not removed. Phase 1 lists which is which.

**Solution quarantine**: untouched. Neither new tool reads a cell's correct answer; `undo_move`
returns only what was already on the board, and `restart_puzzle` returns the same shape
`switch_difficulty` does.

**Security posture**: the new input surface is the smallest yet — `undo_move` and `restart_puzzle`
each take nothing beyond the mandatory `explanation`. Both validate through the same validator
against the same schema object.

**Accessibility**: the Restart control is an ordinary button with a text label, keyboard-reachable
like every other. Removing the confirmation banner removes a polite live region; the a11y suite's
confirmation sweep is deleted with the behaviour, and the remaining sweeps are re-run to confirm
nothing else depended on it.

**Result: PASS on both evaluations. No new deviation; one existing deviation narrowed.**

## Project Structure

### Documentation (this feature)

```text
specs/005-hands-free-board-controls/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 — seven questions, two of which corrected the spec
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── webmcp-tool-surface.md   # the two new tools, and what changed in two existing ones
│   └── board-replacement.md     # the shared routine, and the retired confirmation
└── checklists/
    └── requirements.md
```

### Source (repository root)

```text
src/state/
├── confirmation.ts              DELETE — its responsibility no longer exists
├── agentSession.ts              CHANGE — drop the confirmation slot, actions, selectors
├── agentActions.ts              CHANGE — drop ask/answer/clearConfirmation
├── agentReduce.ts               CHANGE — drop their reducer arms
└── lifecycle.ts                 unchanged — undoLast already does what is needed (R3)

src/tools/
├── boardReplacement.ts          NEW — the shared raise-request-and-wait routine (R6)
├── tools/restartPuzzle.ts       NEW
├── tools/undoMove.ts            NEW
├── tools/switchDifficulty.ts    CHANGE — confirmation removed; delegates to the shared routine
├── tools/loadTechniquePractice.ts  CHANGE — confirmation removed
├── registry.ts                  CHANGE — two descriptors added
└── types.ts                     CHANGE — surface version 1.2.0; drop confirmation-pending

src/ui/
├── RestartButton.tsx            NEW — beside DifficultySelect, not beside Undo (R7)
├── ConfirmationBanner.tsx       DELETE
├── GameScreen.tsx               CHANGE — unmount the banner, mount the button
└── puzzleLoader.ts              CHANGE — regenerate if the grid matches the current one (R2)

tests/
├── contract/restartPuzzle.test.ts   NEW
├── contract/undoMove.test.ts        NEW
├── unit/agentSession.confirmation.test.ts   DELETE
├── a11y/agent-confirmation.spec.ts          DELETE
└── (eight suites)               REWRITE — they mention the confirmation while asserting other things
```

**Structure Decision**: no new layer, no new store, no new seam. Everything added slots into a
structure features 002 and 003 already built, which is why the net line count is expected to be
negative.

## Phase 1 Design

### The three slices, and why they are ordered this way

| Story | Delivers | Depends on |
|---|---|---|
| **US1** | The learner's Restart button | Nothing. Pure UI over an existing function. |
| **US2** | `restart_puzzle` and `undo_move` | The shared routine (R6), which is cleanest to extract *after* US3 has stripped the confirmation out of `switch_difficulty` |
| **US3** | The confirmation removed | Nothing, but it touches the most files |

**US1 ships alone and is worth shipping alone** — it needs no agent and answers the "I closed the tab
and don't want this game back" complaint on its own.

**US2 and US3 are entangled in one direction only.** `restart_puzzle` could be written against
today's confirmation-bearing `switch_difficulty`, but the shared routine cannot be cleanly extracted
until the confirmation is gone — otherwise it would be extracted twice. **Do US3 before US2's restart
tool.** `undo_move` is independent of both and can be built at any point.

### The riskiest part, and how it is contained

**Deleting the confirmation is the part that can silently lose coverage.** Eight test suites mention
it while asserting something else entirely — no-network behaviour, undo parity, a11y sweeps, tool
latency. Deleting them wholesale would remove real guarantees and nothing would say so.

So the rule is mechanical: **delete a test only when the behaviour it asserts is gone.** Concretely,
`agentSession.confirmation.test.ts` and `a11y/agent-confirmation.spec.ts` go, because they exist to
test the prompt. Everything else is edited to drop its confirmation arm and keep the rest, and the
suite count before and after is recorded in `tasks.md` so a drop is visible rather than assumed.

### What the learner is left with

Worth stating plainly in the plan, because the code will not say it anywhere: after this feature the
**Disconnect button is the learner's only protection against an unwanted board replacement**. FR-026
requires it to stay present and functional, and the quickstart checks it explicitly rather than
trusting that nothing disturbed it.

## Complexity Tracking

**No new deviations.** This feature adds none and narrows one.

For the record, the existing deviation it touches:

| Existing deviation | Status after this feature |
|---|---|
| **Principle IV — `switch_difficulty` does not meet the ≤ 100 ms tool-call budget** (recorded in 003's plan, extended from 002's two confirmation-gated tools) | **Narrowed.** It previously waited on *both* a human answer (up to 60 s) and off-thread generation. The human wait is gone. It still exceeds 100 ms because generation is asynchronous, so the exemption stands — but for one reason instead of two, and with a far smaller bound. `restart_puzzle` joins it on the same, smaller, grounds. |

**Not a deviation, but the thing a reviewer should object to if they object to anything**: repealing
002/FR-053 and 003/FR-030. That is a **specification amendment**, made deliberately and recorded in
[spec.md](./spec.md) with its cost — an agent can now discard an hour of the learner's work with no
question asked, no undo, and no retained copy. The constitution does not mandate confirmation, so
this passes the Constitution Check honestly; it is nonetheless the most consequential thing in the
feature, and it is named here so it cannot be missed.
