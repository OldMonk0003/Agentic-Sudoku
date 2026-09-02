---

description: "Task list for feature 005 — Restart, Undo, and Prompt-Free Board Replacement"
---

# Tasks: Restart, Undo, and Prompt-Free Board Replacement

**Input**: Design documents from `specs/005-hands-free-board-controls/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **MANDATORY.** Constitution Principle V is NON-NEGOTIABLE and exempts no module. The tasks
template calls tests optional; this repository's constitution overrides it.

**Branch**: cut from `main` at `46c9f70`. Unlike 003 and 004, `main` now carries the whole agent
surface.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependencies — can run in parallel
- **[Story]**: US1–US3, mapping to the user stories in [spec.md](./spec.md)

---

## ⚠️ Two things that shape this list

**1. This feature is mostly a DELETION.** Two thin tools, one button, and the removal of the
confirmation mechanism across 24 files. The net line count should be negative. The risk is not
writing the new code — it is **silently losing coverage** while deleting the old, which is why T002
captures a baseline before anything is touched and T044 checks the delta against it.

**2. Deleting behaviour still gets a red-green cycle.** You cannot write a failing test for absence
by deleting a test — but you *can* write the test that asserts the **new** behaviour ("the board
switches immediately, no prompt appears"), watch it fail against today's code, and then remove the
confirmation to make it pass. T032 and T033 do exactly that. This is what keeps Principle V honest
through a removal.

**A planning assumption was improved on.** [plan.md](./plan.md) expected `restart_puzzle` to wait for
US3, because the shared routine looked entangled with the confirmation. It is not: `storeGenerator`
in `switchDifficulty.ts` contains no confirmation references, so the routine is extractable as a pure
refactor in Phase 2. **US2 and US3 are therefore fully independent**, and the stories run in plain
priority order.

---

## Phase 1: Setup

- [X] T001 Cut branch `005-hands-free-board-controls` from `main` at `46c9f70`.
- [X] T002 **Capture the baseline before touching anything.** Run `npm test` and record the file and
      test counts in the Results section at the bottom of this file. This feature deletes tests, and
      without a number recorded first, a coverage loss is invisible.
- [X] T003 [P] Record the current `switch_difficulty` latency from `npm run test:perf`, so the claim
      that removing the confirmation *improves* it can be checked rather than asserted (T046).
- [X] T004 [P] Confirm the baseline is green: `npm test`, `npm run lint`, `npm run typecheck`.

**Checkpoint**: a recorded starting point. Nothing changed yet.

---

## Phase 2: Foundational (blocks US1 and US2)

**Purpose**: the "different grid" guarantee, and the shared routine both replacement tools need.

- [X] T005 [P] Write `tests/unit/puzzleLoader.distinct.test.ts`: when generation returns a puzzle
      whose `puzzleString` equals the one currently on the board, the loader regenerates rather than
      presenting it. Covers FR-002 and SC-003, which today are only *probable*
      ([R2](./research.md#r2--how-is-a-different-puzzle-guaranteed-rather-than-merely-likely)).
- [X] T006 Run T005. It must **fail** — nothing compares grids today.
- [X] T007 Implement the comparison in `src/ui/puzzleLoader.ts`, beside the existing
      retry-on-exhaustion path, which already has the "reject this candidate and go again" shape.
      Every caller benefits, including the learner's own difficulty control.
- [X] T008 Extract the generation-wait half of `storeGenerator` from
      `src/tools/tools/switchDifficulty.ts` into a new `src/tools/boardReplacement.ts`
      ([R6](./research.md#r6--restart_puzzle-and-switch_difficulty-are-now-nearly-the-same-tool)).
      **A pure refactor** — it carries no confirmation references, so nothing about behaviour changes.
      Keep the `puzzleFailures` handling: without it a failed generation can only be reported by
      timing out (003/FR-036).
- [X] T009 Point `switchDifficulty.ts` at the extracted routine and run the full suite. **The existing
      tests are the safety net for this refactor** — if any of them move, the extraction changed
      behaviour and is wrong.

**Checkpoint**: a restart cannot return the grid you were already on, and one routine performs board
replacement. Story work can begin.

---

## Phase 3: User Story 1 — Give Me a Different Puzzle, Same Level (P1) 🎯 MVP

**Goal**: a Restart control that gives the learner a fresh puzzle at the level they are already on.

**Independent Test**: restore a half-finished board, press Restart, and confirm a *different* puzzle
at the *same* difficulty appears with a clock at zero and Undo unavailable — with no agent involved.

### Tests (write first, watch fail) ⚠️

- [X] T010 [P] [US1] Write `tests/component/RestartButton.test.tsx`: the control renders with a text
      label, is keyboard-operable, and dispatches a request for the board's current difficulty
      (FR-001, FR-003).
- [X] T011 [P] [US1] Write `tests/integration/restart.spec.ts`: from a half-solved board, pressing
      Restart yields a different grid at the same difficulty, clock at zero, empty history, and the
      difficulty select unchanged (FR-002 through FR-005).
- [X] T012 [P] [US1] Write `tests/a11y/restart.spec.ts`: the control is reachable by keyboard with a
      visible focus ring, has an accessible name, and passes axe at 360 px and desktop.
- [X] T013 [US1] Run all three. They must **fail** — no control exists.

### Implementation

- [X] T014 [US1] Create `src/ui/RestartButton.tsx`. It reads the current difficulty from the store and
      calls `requestPuzzle` — the same function `CompletionBanner` has called since feature 001
      ([R1](./research.md#r1--what-does-restart-actually-reuse)). Lucide icon imported singly, text
      label beside it, no colour-only meaning.
- [X] T015 [US1] Mount it in `src/ui/GameScreen.tsx` **beside `DifficultySelect` in the header — not
      in the `Controls` row with Erase and Undo**
      ([R7](./research.md#r7--where-does-the-restart-button-go)). An unconfirmed board-destroying
      button next to the two most-pressed controls on the page is a mis-click whose consequence
      cannot be undone.
- [X] T016 [US1] Run T010–T012. All green.
- [X] T017 [US1] **Look at the page** at 360 px and desktop: `npm run build && npm start`. Three
      purely visual defects have shipped past a green suite in this project. Confirm the control fits,
      the grid is not squeezed, and there is no horizontal page scroll (001/FR-050).
- [X] T018 [US1] **The mis-click check** (quickstart Part 2): play normally for a minute, pressing
      Erase and Undo as you would while solving. If your hand ever lands on Restart, T015's placement
      is wrong and the consequence is a board you cannot get back.

**Checkpoint**: **shippable on its own.** The learner can get a fresh puzzle at the same level, with
no agent anywhere in the picture.

---

## Phase 4: User Story 2 — Ask for a Fresh Board or Take a Move Back (P2)

**Goal**: `restart_puzzle` and `undo_move`, taking the surface from 16 tools to 18.

**Independent Test**: with a board in progress, have the agent undo and confirm the board steps back
exactly as the button would; have it restart and confirm a different puzzle at the same difficulty.

### Tests (write first, watch fail) ⚠️

- [X] T019 [P] [US2] Write `tests/contract/undoMove.test.ts` against
      [contracts/webmcp-tool-surface.md](./contracts/webmcp-tool-surface.md): a call without
      `explanation` is rejected before anything changes; an empty history returns `nothing-to-undo`;
      a paused board returns `wrong-status`; **a completed board succeeds and returns to play**; a
      multi-cell change reverses whole; the result names `undone_origin`.
- [X] T020 [P] [US2] Write `tests/contract/restartPuzzle.test.ts`: no arguments beyond `explanation`;
      the new puzzle carries the same difficulty; a paused board is rejected; a completed board is
      permitted; a failed generation leaves the board untouched and returns `generation-failed`.
- [X] T021 [P] [US2] Write `tests/integration/agent-undo-restart.spec.ts`: driven through the
      spec-conformant fake host — the learner's selection does not move, and each change carries its
      explanation on screen (FR-018, FR-022).
- [X] T022 [US2] Run all three. They must **fail** — neither tool exists.

### Implementation

- [X] T023 [P] [US2] Create `src/tools/tools/undoMove.ts` via `defineWriteTool`. Two details decide
      whether it is correct:
      **(a)** read `history.at(-1)` **before** dispatching — afterwards the record is gone and there
      is nothing to report (FR-016,
      [R4](./research.md#r4--how-does-the-undo-tool-report-whose-change-it-reversed-fr-016));
      **(b)** guard `status === 'paused'` **explicitly** — `undoLast` has no status check and
      `defineWriteTool` deliberately does not gate on status, so nothing else will reject it
      ([R3](./research.md#r3--what-are-undos-real-status-rules-contradicted-the-spec)). Do **not**
      guard `complete`: the learner's own button works there.
- [X] T024 [P] [US2] Create `src/tools/tools/restartPuzzle.ts` via `defineWriteTool`, taking the
      current difficulty from the game store and delegating to `boardReplacement.ts` (T008). No
      arguments beyond `explanation` — an agent that had to supply the difficulty could supply the
      wrong one, and this tool exists to mean "same level, new grid".
- [X] T025 [US2] Register both in `src/tools/registry.ts`, appending to `descriptors` — the array is
      append-only in practice, because renaming or removing an entry is a MAJOR break (002/FR-010).
- [X] T026 [US2] Raise `TOOL_SURFACE_VERSION` to `1.2.0` in `src/tools/types.ts`, and document both
      new tools with an example invocation in `registry.ts`'s header comment, as 003 did for its five.
- [X] T027 [US2] Update `tests/unit/tools.surface.test.ts` for eighteen tools and the new version.
- [X] T028 [US2] Run T019–T021 and the full unit suite. All green.
- [X] T029 [US2] Add `undo_move` to `tests/perf/agent-tools.spec.ts` and confirm it holds the ≤ 100 ms
      p95 budget — it is one store dispatch, so it should be comfortable. `restart_puzzle` joins
      `switch_difficulty` on the existing generation-bound exemption.

**Checkpoint**: eighteen tools. The agent can restart and undo, and the confirmation is still in place
— US3 has not run yet.

---

## Phase 5: User Story 3 — Switch My Board Without Reaching for Anything (P3)

**Goal**: the confirmation prompt is gone, and agent-initiated replacement is immediate.

**Independent Test**: from a board with real progress, ask the agent to change difficulty. The board
switches immediately, no prompt appears at any point, and the agent's reason is on screen.

### Tests (write first, watch fail) ⚠️

- [X] T030 [P] [US3] Rewrite `tests/contract/switchDifficulty.test.ts` to assert the **new** contract:
      a board with progress is replaced immediately; no confirmation is raised; `outcome: 'declined'`
      is unreachable; the call does not wait on a human.
- [X] T031 [P] [US3] Rewrite `tests/contract/loadTechniquePractice.test.ts` the same way — the drill
      and difficulty prompts were one mechanism and go together.
- [X] T032 [P] [US3] Write `tests/integration/agent-no-prompt.spec.ts`: with progress on the board, an
      agent difficulty switch and an agent drill load each replace the board with **no confirmation
      element ever present in the DOM**, and the agent's explanation appears (FR-020, FR-022).
- [X] T033 [US3] Run T030–T032. They must **fail** — today a prompt appears and the call waits. This
      is the red half of a red-green cycle for a *deletion*, and it is the reason these come first.

### Implementation

- [X] T034 [US3] Strip the confirmation from `src/tools/tools/switchDifficulty.ts`: the
      `ConfirmationWaiter` interface, `storeWaiter`, the `hasProgress` gate, the
      `confirmation-pending` branch, and the `outcome: 'declined'` path.
- [X] T035 [US3] Strip the same from `src/tools/tools/loadTechniquePractice.ts`.
- [X] T036 [US3] **Update both tools' descriptions.** They currently promise the human will be asked
      first. A description that describes behaviour the site does not have is exactly the defect
      002/FR-006 exists to prevent, and an agent reads these at runtime.
- [X] T037 [US3] Delete `src/state/confirmation.ts`.
- [X] T038 [US3] Strip `src/state/agentSession.ts`: the `confirmation` slot, `visibleConfirmation`,
      the `Confirmation` re-exports, `CONFIRMATION_TTL_MS`, and `canAsk`.
- [X] T039 [P] [US3] Strip `askConfirmation`, `answerConfirmation`, `clearConfirmation` and their
      action-type entries from `src/state/agentActions.ts`, and their reducer arms from
      `src/state/agentReduce.ts`.
- [X] T040 [P] [US3] Remove the `confirmation-pending` error code from `src/tools/types.ts`. Not a
      MAJOR change: 002/FR-010 reserves that for renaming a tool, removing a tool, or narrowing a
      schema.
- [X] T041 [US3] Delete `src/ui/ConfirmationBanner.tsx` and unmount it from `src/ui/GameScreen.tsx`.
- [X] T042 [US3] Delete the two test files whose whole subject is the prompt:
      `tests/unit/agentSession.confirmation.test.ts` and `tests/a11y/agent-confirmation.spec.ts`.
      **These are the only deletions permitted.**
- [X] T043 [US3] Edit — do not delete — the suites that mention the confirmation while asserting
      something else: `tests/a11y/agent-difficulty.spec.ts`, `tests/a11y/agent-full-sweep.spec.ts`,
      `tests/integration/agent-difficulty.spec.ts`, `tests/integration/agent-drill.spec.ts`,
      `tests/integration/agent-no-network.spec.ts`, `tests/integration/agent-parity.spec.ts`,
      `tests/perf/agent-tools.spec.ts`, `tests/unit/agentSession.spotlight.test.ts`,
      `tests/unit/tools.errorCodes.test.ts`. Drop the confirmation arm, keep everything else
      ([contracts/board-replacement.md](./contracts/board-replacement.md#test-rule-for-the-removal)).
- [X] T044 [US3] **Check the delta against T002's baseline.** The count should drop by the two deleted
      files and their tests, and by nothing else. Record both numbers in Results and explain the
      difference. An unexplained drop means coverage was lost by accident.

**Checkpoint**: no code path can raise a confirmation. The mechanism is gone, not dormant.

---

## Phase 6: Polish & Verification

- [X] T045 [P] Run `npm test`, `npm run lint`, `npm run typecheck` — all clean.
- [X] T046 Run `npm run test:perf` and compare `switch_difficulty` against T003. It should have
      **improved**: it no longer waits on a human. If it did not, the waiter was not actually removed.
- [X] T047 [P] Run `npm run test:e2e` and `npm run test:a11y`. The a11y sweeps are where a deleted
      live region would show up as a surprise.
- [X] T048 [P] Run `npm run build && npm start` and confirm the static export is unaffected.
- [X] T049 Verify the **no-host** path by hand (SC-012): with no WebMCP host, Restart and Undo work,
      and there are zero agent-related elements on screen — no badge, no live region, and no banner.
- [X] T050 Verify **Disconnect** is present and functional (FR-026). After this feature it is the
      learner's only protection against an unwanted board replacement, so it gets its own task rather
      than being assumed intact.
- [ ] T051 Run [quickstart.md](./quickstart.md) Part 3 against a live Codex session, including the
      deliberate moment of watching a board with real progress vanish without being asked.
- [X] T052 [P] Update the status tables in `README.md` and `CLAUDE.md` for feature 005, and note the
      surface is now **eighteen tools at 1.2.0**.
- [X] T053 [P] Update `CLAUDE.md`'s constraints section: the confirmation is gone, `undo_move` exists,
      and the note that `resume_timer` is the sole paused-board exemption now has a sibling rule —
      `undo_move` guards `paused` itself because nothing else will.
- [X] T054 Record in `README.md` and the spec that **002/FR-053 and 003/FR-030 are repealed**, so a
      reader of those specs is not misled into thinking a confirmation still protects them.
- [X] T055 Confirm the commit history shows each phase's tests committed **before** its
      implementation (Principle V), including T030–T033 preceding the removal. **Done at three
      commits** (`05a0426` spec, `47575c2` the eight failing tests, `e28680e` the implementation)
      rather than one pair per phase: `switchDifficulty.ts` carries both the Phase 2 refactor and the
      US3 repeal, so a per-phase split would have meant staging one file's content across two
      commits. The tests-before-code ordering Principle V asks for is visible either way.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none. **T002 first** — the baseline cannot be captured after the fact.
- **Foundational (Phase 2)**: depends on Setup. Blocks US1 and US2.
- **US1 (Phase 3)**: depends on Phase 2 (T007 for the distinct-grid guarantee).
- **US2 (Phase 4)**: depends on Phase 2 (T008's shared routine). **Independent of US3.**
- **US3 (Phase 5)**: depends on Phase 2 only. **Independent of US2.**
- **Polish (Phase 6)**: depends on everything shipped.

### Story independence

| Story | Independently deliverable? | Independently developable? |
|---|---|---|
| US1 | **Yes** — a learner-facing control needing no agent | Yes |
| US2 | **Yes** — 18 tools, confirmation still in place | **Yes**, once T008 lands |
| US3 | **Yes** — removal stands alone | **Yes** |

**All three are genuinely parallel after Phase 2**, which the plan did not expect: it assumed
`restart_puzzle` had to wait for the confirmation to be stripped. Checking the code showed
`storeGenerator` carries no confirmation references, so the extraction is a pure refactor and the
entanglement does not exist.

**Shared files, if stories are run in parallel** — these are the merge points:

| File | Touched by |
|---|---|
| `src/tools/tools/switchDifficulty.ts` | Phase 2 (T009) and US3 (T034) |
| `src/ui/GameScreen.tsx` | US1 (T015) and US3 (T041) |
| `src/tools/types.ts` | US2 (T026) and US3 (T040) |

### Within each story

Tests written and **failing** first, then the code. Commit the tests, then the implementation, per
phase.

---

## Parallel Example: the test-writing waves

```bash
# Phase 3, all three US1 tests together — different files, no ordering:
Task: "tests/component/RestartButton.test.tsx"      # T010
Task: "tests/integration/restart.spec.ts"           # T011
Task: "tests/a11y/restart.spec.ts"                  # T012
```

```bash
# Phase 4 and Phase 5 test waves can run at the same time as each other:
Task: "tests/contract/undoMove.test.ts"             # T019
Task: "tests/contract/restartPuzzle.test.ts"        # T020
Task: "tests/contract/switchDifficulty.test.ts"     # T030
Task: "tests/contract/loadTechniquePractice.test.ts" # T031
```

---

## Implementation Strategy

### MVP: User Story 1 only

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1)
2. **Look at the page**, and do the mis-click check
3. Deploy. The learner can get a fresh puzzle at the same level — the thing that prompted the request,
   and the only slice that cannot affect the agent surface at all

### Incremental delivery

| After | The product | Tools |
|---|---|---|
| US1 | A Restart control | 16 |
| US2 | The agent can restart and undo | **18** |
| US3 | Agent board replacement is immediate; no prompt exists | 18 |

### Notes

- `[P]` = different files, no dependencies
- **Verify tests fail before implementing** — including T033, where the failure *is* the proof that
  the confirmation still exists
- **Deleting a test is not free.** T002 and T044 exist so a coverage drop is visible rather than
  assumed
- **Look at the page, don't just run the tests.** T017 and T018 are not optional

---

## Results

*Fill in as the work proceeds.*

### Suite counts (T002, T044)

| | Vitest files | Vitest tests | Browser tests |
|---|---|---|---|
| Baseline before any change (T002) | 79 | 1207 | 262 |
| After US1 + US2, before the removal | 83 | 1295 | — |
| **After the removal (T044)** | **82** | **1283** | **275** |

**Delta explained.**

*Files*: +4 added (`puzzleLoader.distinct`, `RestartButton`, `undoMove`, `restartPuzzle`), −1 deleted
(`agentSession.confirmation.test.ts`, 10 tests, whose entire subject was the prompt). 79 + 4 − 1 = 82. ✓

*Tests*: +32 written directly (4 + 6 + 13 + 9), plus ~56 generated automatically — `hostile-inputs`
and `tools.layering` iterate the descriptor list and the `src/tools/` directory, so two new tools and
one new module are covered the moment they exist. Then −10 for the deleted unit file and −~12 for the
confirmation arms removed from the rewritten suites.

**Three files deleted, not two.** The plan predicted two. `tests/a11y/agent-difficulty.spec.ts` was
the third: all four of its tests asserted the accessibility of the confirmation banner, so the whole
file's subject was gone. **The rule governs, not the count** — a test is deleted only when the
behaviour it asserts no longer exists, and that was true of every test in it. Nine other suites were
*edited* rather than removed, keeping their no-network, parity, latency, and a11y assertions intact.

### `switch_difficulty` latency (T003, T046)

| | Result |
|---|---|
| Before | `agent-tools.spec.ts` green in **2.2s**; `switch_difficulty` exempt because it waited on a human **and** on generation |
| After | green in **1.7s**; it no longer waits on a human at all |

The deviation recorded in 003's plan is **narrowed, not removed**: `switch_difficulty` still exceeds
the 100 ms budget because generation is asynchronous, but the sixty-second human wait is gone. A new
integration test asserts the call returns in under five seconds where it could previously block for a
minute. `undo_move` is one store dispatch and sits inside the budget with the non-exempt tools.

### Decisions confirmed by looking (T017, T018)

- **Restart placement survived the mis-click check: yes.** It sits beside the Difficulty select in
  the header; Erase and Undo are at the foot of the board, separated by the whole grid. Screenshots
  taken at desktop and 360 px. `tests/a11y/restart.spec.ts` now asserts Restart and Undo are **not
  adjacent in the tab order**, so a later layout change cannot quietly undo the reasoning.
- **Board and control usable at 360 px: yes.** The header wraps to three rows, the board keeps its
  full width, and there is no horizontal page scroll.

### The live session (T051)

- Board with real progress replaced with no prompt: **verified automatically**
  (`tests/integration/agent-no-prompt.spec.ts`), **not yet felt in a live session**.
- **How that felt, and whether the repeal should stand**: _still the finding most worth having._ The
  tests prove the board vanishes without being asked; they cannot tell you whether that is
  acceptable when it is an hour of your own work. Run quickstart Part 3.
