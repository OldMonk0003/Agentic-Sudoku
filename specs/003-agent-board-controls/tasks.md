---

description: "Task list for feature 003 — Agent Board Controls & Coordinate Ruler"
---

# Tasks: Agent Board Controls & Coordinate Ruler

**Input**: Design documents from `/specs/003-agent-board-controls/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: **MANDATORY, and written first.** Constitution Principle V is NON-NEGOTIABLE and requires
the failing test to arrive before or with the code, **visible in commit history**. Principle V also
requires a contract test for every WebMCP tool. Tests are not optional in this repository.

> **Commit the tests, then commit the implementation.** Feature 002 left task T131 open precisely
> because it shipped as a single commit, so the test-first ordering Principle V wants was not visible
> in history. Every phase below is a natural commit boundary: **commit the failing tests, then commit
> what makes them pass.** That closes the gap this time rather than recording it again.

**Organization**: grouped by user story, each a **vertical slice** ending in a deployable site that can
be opened and reviewed. Tool count runs `11 → 13 → 13 → 14 → 16`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: which user story the task serves (US1–US4). Setup, Foundational, and Polish carry none.

## Path Conventions

Repository root. `src/engine/` (untouched by this feature), `src/state/`, `src/tools/`, `src/ui/`,
`app/`, `tests/`. Layer direction `Engine ← State ← Tools/View` is enforced by lint, not review.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: make the existing test matrices grow with the surface instead of pinning it at eleven. No
product behaviour changes here.

- [X] T001 Parameterise `tests/contract/hostile-inputs.test.ts` over the exported `descriptors` array rather than a hardcoded list of eleven tools, so every tool added below is covered by the 19-payload matrix automatically
- [X] T002 [P] Parameterise `tests/unit/tools.no-solution-leak.test.ts` over `descriptors` likewise, so solution-leak coverage cannot lag the surface
- [X] T003 [P] Parameterise `tests/contract/readOnly.invariants.test.ts` over the read-only subset of `descriptors`
- [X] T004 [P] Create `tests/review/ruler-and-spotlight.spec.ts`, a screenshot harness capturing the board at 360 px and desktop in every ruler and spotlight state, added to `testIgnore` in `playwright.config.ts` alongside the existing review harness so it never runs in CI
- [X] T005 Run `npm test && npm run test:e2e && npm run lint && npm run typecheck` and record the green baseline this feature must not regress (851 unit, 204 browser as of `8f71cd2`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the surface metadata every story writes against. Small on purpose — everything else
belongs to a story.

**⚠️ CRITICAL**: no user story work begins until this phase completes.

**Tools after this phase: 11** (unchanged)

### Tests for Phase 2 (write first, watch fail)

- [X] T006 [P] Extend `tests/unit/tools.surface.test.ts` to assert `TOOL_SURFACE_VERSION === '1.1.0'`, and that all eleven existing tool names are still present with their input schemas unnarrowed (002/FR-010)
- [X] T007 [P] Write `tests/unit/tools.errorCodes.test.ts` asserting `ErrorCode` gains `unknown-difficulty`, `confirmation-pending`, and `generation-failed`, and that no existing member was removed or repurposed

### Implementation for Phase 2

- [X] T008 Bump `TOOL_SURFACE_VERSION` from `'1.0.0'` to `'1.1.0'` in `src/tools/types.ts` — additive, per [research.md § R10](./research.md)
- [X] T009 Add the three new members to the `ErrorCode` union in `src/tools/types.ts` per [data-model.md § 6](./data-model.md)

**Checkpoint**: eleven tools, version `1.1.0`, full suite still green. Nothing visible has changed.

---

## Phase 3: User Story 1 — The Coordinate Ruler (Priority: P1) 🎯 MVP

**Goal**: the learner can read a cell's coordinates straight off the board instead of counting
squares, and either actor can turn the guides on.

**Independent Test**: with only the two ruler tools added, ask an agent to label the grid on a mid-game
board. Confirm both axes number 1–9, that every digit, candidate, highlight, and the clock are
untouched, that the ruler persists across a reload, and that the learner's own toggle works with no
agent connected.

**Tools after this phase: 13** — `show_coordinate_ruler`, `hide_coordinate_ruler`

### Tests for User Story 1 (write first, watch fail)

- [X] T010 [P] [US1] Write `tests/unit/preferences.store.test.ts` in the **node** project asserting `expect(typeof document).toBe('undefined')`, then `showRuler`/`hideRuler`/`loadPreferences`, a default of `rulerVisible: false`, and that a redundant call reports `{ ok: true, changed: false }` rather than failing (FR-011, FR-015)
- [X] T011 [P] [US1] Write `tests/unit/preferences.persistence.test.ts` covering the full untrusted-input matrix from [contracts/preferences-store.md](./contracts/preferences-store.md): key absent, unparseable JSON, wrong `schemaVersion`, `rulerVisible` non-boolean (**never coerced** — `"true"`, `1`, and `null` all rejected), extra properties, and a throwing backend. Every case yields `DEFAULT_PREFERENCES`
- [X] T012 [P] [US1] Write `tests/unit/preferences.isolation.test.ts` asserting ruler actions leave `GameSession.history` untouched and that undo immediately after showing the ruler reports `nothing-to-undo` (FR-014)
- [X] T013 [P] [US1] Extend `tests/unit/persistence.roundtrip.test.ts` to assert the `agentic-sudoku/session` payload contains **no ruler field**, and that a pre-existing v1 payload still restores unchanged — the reason the preference got its own key ([research.md § R2](./research.md))
- [X] T014 [P] [US1] Write `tests/contract/coordinateRuler.test.ts` covering both tools: registered names, `explanation` required and length-bounded 20–240, `additionalProperties: false` rejection, the success shapes including `already_visible` / `already_hidden`, and that neither fails while the board is paused or complete
- [X] T015 [P] [US1] Write `tests/component/CoordinateRuler.test.tsx` asserting both axes render 1–9 in canonical order with their captions, and that the gutters carry `aria-hidden="true"` (FR-007, FR-017)
- [X] T016 [P] [US1] Write `tests/component/RulerToggle.test.tsx` asserting an accessible name, `aria-pressed` reflecting state, and full keyboard operability (FR-013, 001/FR-046)
- [X] T017 [P] [US1] Write `tests/integration/ruler.spec.ts`: shown → reload → still shown; hidden → reload → still hidden; and that it **does not expire** after the annotation TTL elapses (FR-012, FR-015)
- [X] T018 [P] [US1] Extend `tests/integration/agent-absent.spec.ts` to assert the ruler toggle is present **and working** with no agent host, while zero agent-related elements exist (FR-013, SC-011)
- [X] T019 [P] [US1] Write `tests/a11y/ruler.spec.ts`: axe clean with the ruler shown and hidden, gutters absent from the accessibility tree, toggle reachable and operable keyboard-only
- [X] T020 [P] [US1] Extend `tests/perf/agent-tools.spec.ts` to gate both ruler tools at the 100 ms p95 budget

### Implementation for User Story 1

- [X] T021 [US1] Create `src/state/preferences.ts` — the third store per [contracts/preferences-store.md](./contracts/preferences-store.md): `Preferences`, the three actions, `createPreferencesStore`, `DEFAULT_PREFERENCES`. No React, no DOM, no timers, no randomness
- [X] T022 [US1] Add `serialisePreferences`, `restorePreferences`, and `attachPreferencePersistence` to `src/state/preferences.ts` under key `agentic-sudoku/preferences` with its own schema version. Every storage call wrapped; discard rather than partially apply. **Do not touch the session's `SCHEMA_VERSION`**
- [X] T023 [P] [US1] Create `src/ui/usePreferences.ts` — the single `useSyncExternalStore` binding for the preferences store
- [X] T024 [P] [US1] Implement `src/tools/tools/showCoordinateRuler.ts` through `defineWriteTool`, with the description written for an agent that has never seen this site (002/FR-006)
- [X] T025 [P] [US1] Implement `src/tools/tools/hideCoordinateRuler.ts` through `defineWriteTool`
- [X] T026 [US1] Register both in `src/tools/registry.ts`, taking `descriptors` to 13
- [X] T027 [P] [US1] Create `src/ui/CoordinateRuler.tsx` — gutter tracks, numerals and captions in `--color-ink-note`, `aria-hidden="true"`. **Not the screenshot's red**; see [research.md § R6](./research.md)
- [X] T028 [P] [US1] Create `src/ui/RulerToggle.tsx` — the learner's own always-available control with `aria-pressed`
- [X] T029 [US1] Wire the gutters into `src/ui/Board.tsx` as **grid tracks** around the 9×9 grid — not overlays, not padding inside it. The hidden state renders no tracks and is byte-identical to today's board
- [X] T030 [US1] Mount `<RulerToggle />` in `src/ui/GameScreen.tsx` beside the existing header controls
- [X] T031 [US1] Attach preference persistence in `src/ui/GameScreen.tsx` alongside the existing `attachPersistence`, reusing the single storage-failure notice rather than adding a second (001/FR-042)
- [X] T032 [US1] **Look at the board.** Run `npx playwright test tests/review/ruler-and-spotlight.spec.ts` and **read the screenshots back** at 360 px and desktop, ruler shown and hidden. Counting label elements proves nothing about whether the board is still usable — three purely visual defects have shipped past a fully green suite in this project

**Checkpoint**: US1 complete and deployable. 13 tools. The board can be numbered by either actor, the
preference survives a reload, and a host-less page gains the toggle and nothing else.

---

## Phase 4: User Story 2 — The Agent Spotlight (Priority: P2)

**Goal**: when the agent changes something, the learner can see where — without the agent taking their
selection, their focus, or their next keypress.

**Independent Test**: park the learner's selection on one cell, have the agent fill a different one.
Confirm the agent's cell is spotlit and attributed, that the learner's crosshair has not moved, and
that the learner's next digit lands in the cell **they** had selected.

**Tools after this phase: 13** (unchanged — this slice changes what existing writes *look* like)

### Tests for User Story 2 (write first, watch fail)

- [X] T033 [P] [US2] Write `tests/unit/spotlight.test.ts` in the **node** project: the focus form yields 21 indices for a single cell; the region form yields exactly the changed cells for 2–9; **no spotlight at all above `SPOTLIGHT_MAX_CELLS = 9`**; expiry is a pure selector over `expiresAt` with an injected `now` ([data-model.md § 2](./data-model.md))
- [X] T034 [P] [US2] Write `tests/unit/agentSession.spotlight.test.ts` asserting the single slot: a second agent write **replaces** rather than accumulating (FR-022), and `clearAnnotations` removes it with everything else (FR-023)
- [X] T035 [P] [US2] Write `tests/unit/narration.spotlight.test.ts` asserting `WriteOutcome.changed` raises the spotlight, and that a **rejected** write raises none — the `validate → mutate → publish` ordering, so a spotlight never points at a cell that did not change
- [X] T036 [P] [US2] Write `tests/unit/selection.untouched.test.ts` asserting `session.selection` is byte-identical before and after **every** write tool in `descriptors` (FR-019, SC-004)
- [X] T037 [P] [US2] Write `tests/integration/agent-spotlight.spec.ts` — the SC-004 keypress test: the learner selects row 8 column 2, the agent fills row 1 column 3, the learner presses `5`, and it lands in **row 8 column 2**. Also assert `document.activeElement` did not move
- [X] T038 [P] [US2] Write `tests/unit/spotlight.no-persist.test.ts` asserting the spotlight appears in neither `localStorage` nor `GameSession.history` (FR-024)
- [X] T039 [P] [US2] Write `tests/component/Cell.spotlight.test.tsx` asserting the edge rule renders, the focus cell carries the corner glyph, and the learner's ring takes precedence when both mark the same cell
- [X] T040 [P] [US2] Extend `tests/integration/agent-playback.spec.ts` to assert the spotlight follows each walkthrough step as it executes
- [X] T041 [P] [US2] Write `tests/a11y/agent-spotlight.spec.ts`: distinguishable from the learner's crosshair in greyscale and under CVD simulation, axe clean with both on screen, and announced through the **existing** polite live region without taking focus (FR-020, FR-021, FR-025)
- [X] T042 [P] [US2] Extend `tests/a11y/reduced-motion.spec.ts` to assert no spotlight transition under `prefers-reduced-motion` (FR-027)

### Implementation for User Story 2

- [X] T043 [US2] Create `src/state/spotlight.ts` — `Spotlight`, `SPOTLIGHT_TTL_MS`, `SPOTLIGHT_MAX_CELLS`, `spotlitIndices`, `spotlightFocusIndex`
- [X] T044 [US2] Add the `spotlight` **slot** and its actions to `src/state/agentActions.ts`, `src/state/agentReduce.ts`, and `src/state/agentSession.ts`, including it in the existing `expire` tick and in `clearAnnotations`
- [X] T045 [US2] Add `changed?: readonly Coord[]` to `WriteOutcome` in `src/tools/narration.ts` and raise the spotlight in the same `validate → mutate → publish` step that queues the explanation — so a write tool cannot forget ([research.md § R4](./research.md))
- [X] T046 [P] [US2] Return `changed` from `src/tools/tools/fillCell.ts`
- [X] T047 [P] [US2] Return `changed` from `src/tools/tools/updatePencilMarks.ts`
- [X] T048 [P] [US2] Return `changed` from `src/tools/tools/autoFillAllPencilMarks.ts` — above the threshold the wrapper raises nothing, which is the intended behaviour, not an omission
- [X] T049 [US2] Render the spotlight in `src/ui/Cell.tsx` as a **dashed edge rule in `--color-mark-agent`, never a wash**, with the corner glyph on the focus cell. **Nothing new goes underneath a digit** — that is the 002 hatch lesson ([research.md § R5](./research.md))
- [X] T050 [US2] Derive the spotlit set in `src/ui/Board.tsx`, pass it to `Cell`, and extend the existing polite announcement to name the spotlit location
- [X] T051 [US2] Add a spotlight class to `app/globals.css` **only if** the dashed rule needs a token that does not exist. If a token is added, `tests/unit/palette.contrast.test.ts` re-runs — that file parses the theme block, so a new token is a test event
- [X] T052 [US2] **Look at the board.** Screenshot the learner's crosshair and the agent's spotlight on screen together, in colour and in greyscale, and **read the images back**. This is the exact class of defect that has shipped three times in this project

**Checkpoint**: US2 complete and deployable. The board shows where the agent acted, and the learner's
hand is never moved.

---

## Phase 5: User Story 3 — Switching Difficulty (Priority: P3)

**Goal**: the agent can move the learner up or down a level, behind a confirmation whenever progress
would be lost.

**Independent Test**: from a partly solved board, ask for a different difficulty. Confirm the learner
is asked first, that declining changes nothing, and that accepting produces a fresh uniquely-solvable
puzzle with a clean clock and empty undo history.

**Tools after this phase: 14** — `switch_difficulty`

### Tests for User Story 3 (write first, watch fail)

- [X] T053 [P] [US3] Extend `tests/unit/agentSession.*` with a confirmation test asserting the generalised shape: `kind: 'drill' | 'difficulty'`, `subject` replacing `technique`, the **single slot**, rejection of a second ask while one is pending, and the 60 s timeout resolving as `declined` ([research.md § R8](./research.md))
- [X] T054 [P] [US3] Write `tests/unit/agentSession.puzzleRequest.test.ts` asserting the request counter is observable by a subscriber and that `puzzleGenerationFailed` is observable — with no DOM, since this is the Tools↔UI seam ([research.md § R1](./research.md))
- [X] T055 [P] [US3] Write `tests/contract/switchDifficulty.test.ts`: the enum-bounded `difficulty`, `unknown-difficulty` carrying the available levels, `outcome: 'loaded'` and `outcome: 'declined'` **both** as `ok: true`, `confirmation-pending`, `generation-failed`, `wrong-status` while paused, and success while complete
- [X] T056 [P] [US3] Write `tests/integration/agent-difficulty.spec.ts`: with progress on the board, a decline leaves it **bit-identical**; an accept loads a fresh board with the clock at zero and Undo unavailable (FR-030, FR-033)
- [X] T057 [P] [US3] Extend `tests/integration/agent-playback.spec.ts` to assert a difficulty change stops a running walkthrough and reports how far it got (FR-034)
- [X] T058 [P] [US3] Write `tests/unit/switchDifficulty.uniqueness.test.ts` asserting every board loaded through this path has exactly one solution and a **derived** rating, never a trusted one (FR-032, Principle IV)
- [X] T059 [P] [US3] Extend `tests/unit/tools.layering.test.ts` to assert `src/tools/**` imports nothing from `src/ui/**` — the lint rule's test-side twin, so the R1 seam cannot be quietly bypassed
- [X] T060 [P] [US3] Write `tests/a11y/agent-difficulty.spec.ts` asserting the confirmation banner is not a modal, never takes focus, and is axe clean
- [X] T061 [P] [US3] Extend `tests/perf/agent-tools.spec.ts` to assert **no long task** blocks the learner during generation, while explicitly exempting `switch_difficulty` itself from the 100 ms gate per the recorded deviation

### Implementation for User Story 3

- [X] T062 [US3] Generalise `src/state/confirmation.ts`: add `kind: ConfirmationKind`, rename `technique` to `subject`, keeping `CONFIRMATION_TTL_MS` and the decline-on-timeout rule unchanged
- [X] T063 [US3] Update `src/state/agentActions.ts` and `src/state/agentReduce.ts` for the generalised confirmation, and **reject** a second `askConfirmation` while one is pending rather than overwriting it
- [X] T064 [P] [US3] Update `src/tools/tools/loadTechniquePractice.ts` to the new confirmation shape (`kind: 'drill'`) with no behaviour change
- [X] T065 [P] [US3] Update `src/ui/ConfirmationBanner.tsx` to render either kind
- [X] T066 [US3] Add `puzzleRequest`, the `puzzleRequests` counter, and `puzzleGenerationFailed` to `src/state/agentActions.ts`, `agentReduce.ts`, and `agentSession.ts`, mirroring how `disconnectRequests` already works in the opposite direction
- [X] T067 [US3] Report retry exhaustion from `src/ui/puzzleLoader.ts` — it currently gives up silently, and FR-036 requires the agent to be told the attempt failed
- [X] T068 [US3] Subscribe to puzzle requests in `src/ui/GameScreen.tsx` and call `requestPuzzle` from `src/ui/puzzleLoader.ts`, dispatching `puzzleGenerationFailed` when the retry budget is exhausted
- [X] T069 [US3] Implement `src/tools/tools/switchDifficulty.ts`: enum validation, progress detection, the confirmation gate, raising the request, awaiting the outcome from the **game** store, and mapping to `loaded` / `declined` / `generation-failed`
- [X] T070 [US3] Register it in `src/tools/registry.ts`, taking `descriptors` to 14
- [X] T071 [US3] Run `npm run lint`. If `src/tools` ever imports `src/ui`, **this is what fails, and that failure is correct** — it is the rule that forced the seam in the first place

**Checkpoint**: US3 complete and deployable. 14 tools. The agent can change the level, and cannot
discard the learner's work without being told to.

---

## Phase 6: User Story 4 — Pause and Resume (Priority: P4)

**Goal**: the agent can stop and restart the clock, and the learner can always take it back.

**Independent Test**: with the clock running, have the agent pause. Confirm the clock stops and the
board is covered, that the learner's own Resume works without the agent, and that the agent can
resume too.

**Tools after this phase: 16** — `pause_timer`, `resume_timer`

### Tests for User Story 4 (write first, watch fail)

- [X] T072 [P] [US4] Write `tests/contract/pauseTimer.test.ts`: the success shape, `wrong-status` when the board is not running with the message naming the actual state, and the explanation requirement (FR-041)
- [X] T073 [P] [US4] Write `tests/contract/resumeTimer.test.ts` including the carve-out: `resume_timer` **succeeds while the board is paused** (FR-040). Pin it explicitly, so the exemption cannot be closed by accident and turn `pause_timer` into a one-way door for the agent
- [X] T074 [P] [US4] Write `tests/contract/pausedWrites.test.ts` asserting that while paused **every other** write tool in `descriptors` is rejected and **every read** still succeeds (002/FR-045)
- [X] T075 [P] [US4] Write `tests/integration/agent-pause.spec.ts`: the agent pauses, the learner's **own** Resume control works with no agent involvement (FR-043), and then an agent resume works too
- [X] T076 [P] [US4] Extend `tests/integration/agent-playback.spec.ts` to assert a pause during a walkthrough stops it at the last completed step — steps must never execute behind the overlay (FR-042)
- [X] T077 [P] [US4] Write `tests/unit/pauseResume.history.test.ts` asserting neither is undoable and neither touches `history` (FR-044)
- [X] T078 [P] [US4] Extend `tests/perf/agent-tools.spec.ts` to gate both at the 100 ms p95 budget
- [X] T079 [P] [US4] Write `tests/a11y/agent-pause.spec.ts` asserting an agent-initiated pause overlay is escapable keyboard-only through the learner's Resume control

### Implementation for User Story 4

- [X] T080 [P] [US4] Implement `src/tools/tools/pauseTimer.ts` through `defineWriteTool` over the store's existing `pause` action
- [X] T081 [P] [US4] Implement `src/tools/tools/resumeTimer.ts` through `defineWriteTool` over the store's existing `resume` action. **No status gate is added at the wrapper level** — the carve-out exists by construction because `resumeSession` already requires `status === 'paused'`
- [X] T082 [US4] Stop a running walkthrough on pause in `src/tools/playback.ts`, which already watches the agent store for `learnerActed` (FR-042)
- [X] T083 [US4] Register both in `src/tools/registry.ts`, taking `descriptors` to 16

**Checkpoint**: US4 complete. **The surface is complete at 16 tools.**

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T084 Run the full suite: `npm test && npm run test:e2e && npm run test:a11y && npm run test:perf && npm run lint && npm run typecheck`
- [ ] T085 [P] Extend `tests/integration/agent-no-network.spec.ts` to all 16 tools, asserting zero network requests after load (FR-046, 001/FR-043)
- [ ] T086 [P] Extend `tests/a11y/agent-full-sweep.spec.ts` to every new state: ruler shown, spotlight live, confirmation pending, agent-paused
- [ ] T087 Run `npm run build && npm start` and verify the static export runs from a plain file server with no server runtime (Definition of Done #9)
- [ ] T088 Measure and **record** p95 for the four budgeted new tools in this file, and record `switch_difficulty`'s exemption alongside the two 002 already carries (Definition of Done #5)
- [ ] T089 Record the gzipped first-load bundle number — informational only, the budget stays deferred
- [ ] T090 [P] Update `README.md`: the status table gains feature 003, and the tool count moves from eleven to sixteen
- [ ] T091 [P] Update `CLAUDE.md`: feature 003's state, the third store and its separate storage key, the Tools↔UI seam that `switch_difficulty` uses, the ruler's exemption from 002/FR-033, and the new tool count
- [ ] T092 [P] Document all five new tools with schema and example invocation in the registry module (Definition of Done #6)
- [ ] T093 Review every touched module against Principle III's ~300-line trigger — `agentSession.ts`, `agentReduce.ts`, `narration.ts`, and `Board.tsx` all grow in this feature — and split anything over, as 002 did twice
- [ ] T094 Walk [quickstart.md](./quickstart.md) end to end and record what it found
- [ ] T095 Confirm the two deviations in [plan.md § Complexity Tracking](./plan.md#complexity-tracking) still read true against what was actually built

---

## Open Items to Resolve, Not Bury

- [ ] T096 **Confirm the ruler's colour with the author.** The supplied screenshot shows the row and column numbers in a saturated red; the implementation uses `--color-ink-note` because red would borrow the board's conflict vocabulary and break 001/FR-052 ([research.md § R6](./research.md)). Everything else in the screenshot is reproduced as shown. If the red was load-bearing rather than incidental, this becomes a **palette amendment with a contrast re-run**, not a component change
- [ ] T097 **SC-001 of feature 002 remains unverified against a live agent**, and this feature enlarges the untested contact area from eleven tools to sixteen. Nothing in this environment implements `document.modelContext`, so the whole surface has still only ever been driven through a spec-conformant fake. Point a real agent at it before believing the "no site-specific instructions" claim

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — **blocks every user story**
- **US1 (Phase 3)**: depends on Phase 2 only
- **US2 (Phase 4)**: depends on Phase 2 only — independent of US1
- **US3 (Phase 5)**: depends on Phase 2 only — independent of US1 and US2
- **US4 (Phase 6)**: depends on Phase 2 only — the smallest slice, and touches nothing the others do
- **Polish (Phase 7)**: depends on every story you intend to ship

### Story independence

All four stories are genuinely independent after Phase 2, and each owns its own modules:

| Story | Owns |
|---|---|
| US1 | `preferences.ts`, both ruler tools, `CoordinateRuler.tsx`, `RulerToggle.tsx`, `usePreferences.ts` |
| US2 | `spotlight.ts`, the `narration.ts` change, `Cell.tsx` rendering |
| US3 | `confirmation.ts`, the puzzle-request seam, `switchDifficulty.ts` |
| US4 | `pauseTimer.ts`, `resumeTimer.ts` |

Three shared files are touched by more than one story — `registry.ts` (all four),
`agentSession.ts`/`agentReduce.ts` (US2 and US3), and `Board.tsx` (US1 and US2). **If stories are run
in parallel, those three are the merge points**; everything else is disjoint.

### Within each story

Tests are written and **fail** before implementation. Then: state → tools → view. Commit the tests,
then commit the implementation, so Principle V's ordering is visible in history.

### Parallel opportunities

- Setup: T002, T003, T004 in parallel
- Foundational: T006, T007 in parallel
- **Every test task inside a story is `[P]`** — different files, no ordering between them
- US1: T023–T025 and T027–T028 parallel; US2: T046–T048 parallel; US4: T080–T081 parallel
- Polish: T085, T086, T090, T091, T092 in parallel

---

## Parallel Example: User Story 1

```bash
# All eleven US1 tests, written together, all failing before any implementation:
Task: "tests/unit/preferences.store.test.ts"          # T010
Task: "tests/unit/preferences.persistence.test.ts"    # T011
Task: "tests/unit/preferences.isolation.test.ts"      # T012
Task: "tests/contract/coordinateRuler.test.ts"        # T014
Task: "tests/component/CoordinateRuler.test.tsx"      # T015
Task: "tests/component/RulerToggle.test.tsx"          # T016
Task: "tests/integration/ruler.spec.ts"               # T017
Task: "tests/a11y/ruler.spec.ts"                      # T019
```

```bash
# Then the independent implementation files:
Task: "src/ui/usePreferences.ts"                      # T023
Task: "src/tools/tools/showCoordinateRuler.ts"        # T024
Task: "src/tools/tools/hideCoordinateRuler.ts"        # T025
Task: "src/ui/CoordinateRuler.tsx"                    # T027
Task: "src/ui/RulerToggle.tsx"                        # T028
```

---

## Implementation Strategy

### MVP: User Story 1 only

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1)
2. **Stop and look at the board**, at 360 px and desktop
3. Deploy. The learner can number the grid and stop counting squares — the thing the author asked for
   first, and the only slice that cannot break a puzzle

### Incremental delivery

Each slice ends in a deployable site that can be opened and reviewed:

| After | The site can |
|---|---|
| US1 | Number the grid, from either actor, surviving a reload — **13 tools** |
| US2 | Show where the agent acted, without moving the learner's hand — 13 tools |
| US3 | Change difficulty, behind a confirmation — **14 tools** |
| US4 | Pause and resume from either side — **16 tools** |

### Notes

- `[P]` = different files, no dependencies
- **Verify tests fail before implementing.** A test that passes on first run is testing nothing
- **Commit tests before implementation**, per phase. This is what 002's T131 was left open for
- Stop at any checkpoint and validate the story on its own
- **Look at the page, don't just run the tests.** Three purely visual defects have shipped past a
  fully green suite here. T032 and T052 are not optional
