---

description: "Task list for feature 002 — WebMCP Agent Tutor"
---

# Tasks: WebMCP Agent Tutor

**Input**: Design documents from `/specs/002-webmcp-agent-tutor/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: **MANDATORY, and written first.** Constitution Principle V is NON-NEGOTIABLE and requires
the failing test to arrive before or with the code, visible in commit history. Principle V further
requires a contract test for *every* WebMCP tool and at least one integration test exercising a full
agent → State → view session including undo. Tests are not optional in this repository.

**Organization**: grouped by user story, and each group is a **vertical slice** from
[plan.md § Vertical Slice Plan](./plan.md) — one deployable site with a larger, hand-drivable agent
surface. `getTools()` returns 2 → 5 → 6 → 7 → 9 → 10 → 11.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: which user story the task serves (US1–US6). Setup, Foundational, and Polish carry none.

## Path Conventions

Repository root. `src/engine/`, `src/state/`, `src/tools/` (new), `src/ui/`, `app/`, `tests/`.
Layer direction `Engine ← State ← Tools/View` is enforced by lint, not review.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: the scaffolding every slice needs. No product behaviour changes here.

- [X] T001 Add the new layer zones to `eslint.config.mjs`: `src/ui` must not import `src/tools`, `src/tools` must not import `src/ui`, and neither `src/engine` nor `src/state` may import `src/tools` (Principle III; see [plan.md § Project Structure](./plan.md))
- [X] T002 Add a `contract` project (jsdom, `tests/contract/**/*.test.ts`) to `vitest.config.ts`, leaving the `node` project's no-DOM guarantee untouched
- [X] T003 [P] Add `tests/review/**` to `testIgnore` in `playwright.config.ts` and a `review:agent` script to `package.json` so the headed review harness never runs in CI
- [X] T004 Write `tests/unit/fakeModelContext.test.ts` asserting the fake host matches the published IDL: `registerTool` rejects a duplicate name with `InvalidStateError`, an aborted `AbortSignal` unregisters exactly that tool, `getTools` reflects registrations, and `executeTool` resolves to the JSON **string** of the handler's return value ([research.md § R1](./research.md))
- [X] T005 Implement the spec-conformant fake host in `tests/support/fakeModelContext.ts` (deliberately strict, so our code cannot come to depend on a laxer host than the standard describes)
- [X] T006 [P] Create the headed review harness `tests/review/agent-demo.spec.ts`, injecting the fake host with `page.addInitScript` before load and leaving the browser open (quickstart Path B)

---

## Phase 2: Foundational (Blocking Prerequisites) — Slice 0

**Purpose**: the agent surface exists and can **see the board**. This is not scaffolding: it registers
two working tools, and it delivers US1's acceptance scenarios 1, 2, and 6.

**⚠️ CRITICAL**: no user story work begins until this phase completes.

**Tools after this phase: 2** — `get_board_state`, `check_for_conflicts`

### Tests for Phase 2 (write first, watch fail)

- [X] T007 [P] Write `tests/unit/tools.validate.test.ts` covering the JSON Schema subset: type mismatches, missing required properties, `additionalProperties: false` rejection, string length bounds, integer bounds, `enum`, array `minItems`/`maxItems`/`uniqueItems`, nested objects, and hostile inputs (`null`, arrays, prototype-polluting keys)
- [X] T008 [P] Write `tests/unit/tools.surface.test.ts` in the **node** project asserting `expect(typeof document).toBe('undefined')`, then that `src/tools/registry.ts` exports every descriptor with a unique snake_case name, a non-empty description stating the row/column addressing convention (FR-006, FR-007), an `inputSchema`, a `readOnly` flag, and `TOOL_SURFACE_VERSION` (FR-011)
- [X] T009 [P] Write `tests/unit/agentSession.connection.test.ts` asserting the agent store's connection transitions and that `requestDisconnect` is observable by a subscriber, with no DOM mounted
- [X] T010 [P] Write `tests/contract/registration.test.ts` asserting `registerTools()` twice yields 2 tools not 4 (FR-012), `unregisterTools()` leaves 0, teardown removes exactly what was registered via the single `AbortController`, and `registerTools()` returns `null` and throws nothing when `document.modelContext` is absent (FR-013)
- [X] T011 [P] Write `tests/contract/getBoardState.test.ts` asserting the registered name, rejection of unknown arguments, the success `data` shape (81 cells with `row`/`col`/`value`/`origin`/`candidates`, plus difficulty, status, elapsed, empty count), and that `surface_version` is present in every result (FR-024, FR-010)
- [X] T012 [P] Write `tests/contract/checkForConflicts.test.ts` asserting conflicts are returned grouped by unit and digit with every participating cell, and an empty list on a clean board (FR-025)
- [X] T013 [P] Write `tests/unit/tools.no-solution-leak.test.ts` exercising the whole surface on a nearly complete board and scanning every serialised result for an 81-character digit run or a `solution` key at any depth (FR-026, FR-058)
- [X] T014 [P] Write `tests/contract/readOnly.invariants.test.ts` snapshotting board data, annotations, elapsed time, and undo depth around every read-only call and asserting all four are unchanged (FR-027)
- [X] T015 [P] Write `tests/integration/agent-absent.spec.ts` asserting that with no `document.modelContext` the page renders no agent-related element and its accessibility tree matches feature 001's (FR-013, SC-010)
- [X] T016 [P] Write `tests/perf/agent-tools.spec.ts` measuring invocation-to-result p95 for the read tools against the 100 ms budget (Principle IV)

### Implementation for Phase 2

- [X] T017 Create `src/tools/types.ts` with `ToolDescriptor`, `ToolResult`, `ToolError`, and the closed `ErrorCode` enumeration from [data-model.md](./data-model.md#errorcode)
- [X] T018 Implement the JSON Schema subset interpreter in `src/tools/validate.ts`, driven by the **same** `inputSchema` object handed to the browser so the two cannot drift ([research.md § R5](./research.md))
- [X] T019 Create the second store in `src/state/agentSession.ts` with `connection`, `learnerActivity`, and their actions — framework-free, no React import, drivable with no DOM
- [X] T020 Create `src/ui/useAgentStore.ts`, the single `useSyncExternalStore` binding for the agent store
- [X] T021 [P] Implement `src/tools/tools/getBoardState.ts` as a thin adapter over the game store (no game rules in the handler, per Principle III)
- [X] T022 [P] Implement `src/tools/tools/checkForConflicts.ts` over the Engine's existing `findConflicts`, grouped by unit and digit
- [X] T023 Implement `src/tools/registry.ts`: descriptors, feature detection, `registerTools()` with the module-level idempotency guard against `InvalidStateError`, `unregisterTools()` via the single `AbortController`, and `readOnlyHint`/`untrustedContentHint` on every registration. **This is the only module permitted to touch `document`**
- [X] T024 Create `src/tools/AgentBootstrap.tsx` — `'use client'`, returns `null`, registering at module evaluation and never in render (Principle I; [research.md § R2](./research.md))
- [X] T025 Mount `<AgentBootstrap />` in `app/layout.tsx` so the registration module reaches the client bundle
- [X] T026 Create `src/ui/AgentBadge.tsx`: renders **nothing** when `connection` is `absent`, a sage badge plus Disconnect when connected (FR-057, FR-013)
- [X] T027 Render `<AgentBadge />` from `src/ui/GameScreen.tsx`
- [X] T028 Subscribe `src/tools/registry.ts` to the agent store so `requestDisconnect` aborts the controller — the UI never imports the tools layer ([contracts/agent-session-store.md](./contracts/agent-session-store.md))
- [X] T029 [P] Add worked example invocations for both tools to [contracts/webmcp-tool-surface.md](./contracts/webmcp-tool-surface.md) (Definition of Done, item 6)
- [X] T030 Run `npm run build && npm start` and walk **Slice 0** in [quickstart.md](./quickstart.md) against a real `document.modelContext` where available, the review harness otherwise

**Checkpoint**: ✅ **SLICE 0 COMPLETE** (2026-08-30). 322 unit/contract tests and 96 browser tests
green; lint, typecheck, and static export clean. Verified in a real browser with a host installed:
`getTools()` returns `['get_board_state', 'check_for_conflicts']`, the board reads back correctly, the
"Agent connected" badge and Disconnect render, and a host-less page is byte-identical to feature 001.
Measured tool-call p95: **get_board_state 0.1 ms, check_for_conflicts 0.2 ms** against a 100 ms budget.

### What Slice 0 turned up

**The published IDL forced three design decisions, all of them load-bearing.** Verified against the
spec rather than recalled (research.md R1), and each one is now pinned by a test:

1. `registerTool` **rejects a duplicate name** with `InvalidStateError`, so registration is not
   natively idempotent — React strict mode alone would have thrown. The module-level guard in
   `registerTools()` is what makes FR-012 true.
2. There is **no `unregisterTool`**; teardown is aborting the `AbortSignal` the tools were registered
   with. This is better than a manual unregister loop, because it cannot drift out of step with what
   was registered.
3. `executeTool` **collapses a rejected handler into an opaque `UnknownError`**, destroying the
   reason. That is the mechanical justification for FR-008/FR-009 — "never throw" is not a style
   preference, it is the only way the reason survives the boundary. `fakeModelContext.test.ts` asserts
   the destruction explicitly, so the constraint stays visible.

**`AgentBootstrap` exists because a server component's imports never reach the browser.** A bare
side-effect import in `app/layout.tsx` would have run at build time in Node, where `document` is
undefined, and never in the browser at all. A static export has no server runtime to register from, so
registration must be pulled in by a client module — one that renders `null` and registers at module
evaluation, never in a render path (Principle I).

**Conflict grouping went into the Engine, not the handler.** `check_for_conflicts` must report which
cells collide with which (FR-025), and working that out is a game rule — Principle III forbids rules in
a tool handler. `findConflictGroups` joins `findConflicts` in `src/engine/conflicts.ts`.

**Three test bugs, no product bugs.** All three are worth recording because each would have recurred:
a `[data-origin="empty"]` locator re-resolves to a *different* cell once a digit lands (001 documents
this exact trap); `/agent/i` matches the site's own "Agentic Sudoku" heading, so the no-host assertion
had to be narrowed to agent *affordances*; and placing the same digit twice in a row can also collide
with a clue elsewhere, so a fixed conflict count was wrong — the assertion now pins the count to the
groups actually reported.

---

## Phase 3: User Story 1 — A Tutor That Looks and Points (Priority: P1) 🎯 MVP — Slice 1

**Goal**: the agent can direct the learner's attention — highlight the cells a deduction targets and
the cells that justify it, drop a coaching note — and change nothing on the board.

**Independent Test**: with only read and annotation tools registered, ask an agent to explain the next
move on a mid-game board. It describes the position accurately, marks the right cells in
distinguishable roles, and leaves every digit and candidate untouched.

**Tools after this phase: 5**

### Tests for User Story 1 (write first, watch fail)

- [X] T031 [P] [US1] Extend `tests/unit/palette.contrast.test.ts` with `mark-agent-wash`, `agent-surface`, and `agent-edge`: inks ≥ 4.5:1 on the hatch fill and on the agent surface, edge ≥ 3:1 against both surfaces ([contracts/annotation-and-narration.md](./contracts/annotation-and-narration.md))
- [X] T032 [P] [US1] Write `tests/unit/narration.test.ts` asserting `defineWriteTool` injects `explanation` with identical 20–240 bounds into every write schema, rejects a missing or out-of-bounds explanation **before** the handler runs, and publishes the explanation **only** after the handler reports success (FR-014–FR-016, SC-003)
- [X] T033 [P] [US1] Write `tests/unit/agentSession.annotations.test.ts` asserting `visibleAnnotations(session, now)` is a pure function of `now`, that `visibleExplanations` caps at three with the rest queued, and that expiry needs no interval (FR-020, FR-033)
- [X] T034 [P] [US1] Write `tests/contract/highlightPatternCells.test.ts`: name, schema rejection of off-grid coordinates and unknown properties, `no-annotation-target` when both cell arrays are empty, success shape
- [X] T035 [P] [US1] Write `tests/contract/showPatternHintToast.test.ts`: the explanation *is* the message, five-second expiry reported, success and error shapes
- [X] T036 [P] [US1] Write `tests/contract/clearVisualAnnotations.test.ts` asserting annotations and toast are cleared, board values, candidates, timer, and history are untouched, and the call's **own** explanation survives (FR-031)
- [X] T037 [P] [US1] Write `tests/unit/agentSession.isolation.test.ts` running the entire agent action set and asserting the game store's state and the serialised persistence payload are byte-identical afterwards (FR-034)
- [X] T038 [P] [US1] Write `tests/component/ExplanationQueue.test.tsx` feeding `<img src=x onerror=alert(1)>`, a `javascript:` URL, and `[click](http://evil)`: `textContent` matches the input exactly, `innerHTML` contains no element, the document gains no anchor, and `document.activeElement` never changes (FR-021, FR-018)
- [X] T039 [P] [US1] Write `tests/integration/agent-annotations.spec.ts`: highlight → marks visible → board data unchanged → clear → board returns to its unannotated appearance
- [X] T040 [P] [US1] Write `tests/a11y/agent-annotations.spec.ts`: axe clean with annotations on screen at 360 px and desktop, the annotation summary announced politely, no annotation focusable, cell `aria-label` carries its role (FR-060, SC-011)
- [X] T041 [P] [US1] Write `tests/a11y/agent-greyscale.spec.ts` asserting `target`, `because`, and the learner's own crosshair remain three distinct things with colour removed (FR-035, SC-004)

### Implementation for User Story 1

- [X] T042 [US1] Add `--color-mark-agent-wash`, `--color-agent-surface`, and `--color-agent-edge` to the `@theme` block in `app/globals.css` — **computed to satisfy T031, not chosen and checked afterwards** ([research.md § R7](./research.md))
- [X] T043 [US1] Extend `src/state/agentSession.ts` with annotations, the explanation queue, the toast, `expire`, `setReducedMotion`, and the `visible*` selectors taking `now`
- [X] T044 [US1] Implement `src/tools/narration.ts` — `defineWriteTool`, the single enforcement point for the narration contract ([research.md § R4](./research.md))
- [X] T045 [P] [US1] Create `src/ui/AnnotationLayer.tsx`: an absolutely positioned **sibling** of the grid (never a child — `role="grid"` requires `role="row"` children), `aria-hidden`, `pointer-events: none`, rendering `target` as outline-plus-filled-dot and `because` as hatch-plus-hollow-dot
- [X] T046 [P] [US1] Create `src/ui/ExplanationQueue.tsx`: at most three, polite live region, dismissible, never focused, text node only
- [X] T047 [P] [US1] Create `src/ui/AgentToast.tsx` with five-second self-dismissal and earlier manual dismissal (FR-030)
- [X] T048 [US1] Render `<AnnotationLayer />` beside the grid in `src/ui/Board.tsx` and dispatch `learnerActed` on board key and click (the interruption signal Slice 5 will consume)
- [X] T049 [US1] Add the annotation role to the cell's `aria-label` in `src/ui/Cell.tsx` so a learner arrowing the board hears it in place
- [X] T050 [US1] Drive `expire` on a low-frequency interval and publish `prefers-reduced-motion` through `setReducedMotion` from `src/ui/GameScreen.tsx` (the View owns the interval, the store owns the number)
- [X] T051 [P] [US1] Implement `src/tools/tools/highlightPatternCells.ts` via `defineWriteTool`
- [X] T052 [P] [US1] Implement `src/tools/tools/showPatternHintToast.ts` via `defineWriteTool`
- [X] T053 [P] [US1] Implement `src/tools/tools/clearVisualAnnotations.ts`, clearing annotations and toast **before** publishing its own explanation
- [X] T054 [US1] Register the three new tools in `src/tools/registry.ts`
- [X] T055 [US1] Add example invocations to [contracts/webmcp-tool-surface.md](./contracts/webmcp-tool-surface.md) and walk **Slice 1** in [quickstart.md](./quickstart.md)

**Checkpoint**: ✅ **SLICE 1 COMPLETE** (2026-08-30). 398 unit/contract/component tests and 120 browser
tests green; lint, typecheck, and static export clean. `getTools()` returns five. Verified in a real
browser: target and because marks are visibly different, the explanation and toast render beside the
board, and the board's digits, candidates, timer, and undo depth are byte-identical across a highlight.

### What Slice 1 turned up

**A real visual defect that the green suite could not see.** The `because` hatch was first drawn as a
full-cell fill, and its diagonal stripes ran straight through the digit underneath — a clue's `4`
became genuinely hard to read. The palette contrast test could not catch it: the ratios are computed
against the flat token, while the damage is done by stripes crossing the glyph. It took a screenshot.
The hatch is now a FRAME around the cell edge, which keeps the pattern (the greyscale-safe cue) and
leaves the middle clear. **That is the third purely visual defect to ship past a green suite in this
project.**

**Three polite live regions now exist, and one of 001's tests was measuring the wrong thing.**
`conflict-announce.spec.ts` asserted there was exactly one `[role="status"][aria-live="polite"]` on the
page — true in 001, and incidental. Feature 002 adds the explanation queue and the annotation summary.
The assertion is now scoped by test id, so it says what it always meant: one conflict announcement,
polite, no focus stolen.

**`show_pattern_hint_toast` needed an escape hatch from the narration wrapper.** Its explanation IS
the message the learner reads, so publishing a popup as well would say the same words twice.
`narration: 'self'` is that hatch, and it is the only tool that uses it — the property name stays
`explanation` so there remains exactly one length rule and one enforcement point.

**`clear_visual_annotations` must not clear the explanation queue.** Clearing "everything the agent
drew" would take the narration of the clearing with it, and the learner would watch the board change
for no stated reason — precisely what the narration contract exists to prevent. Marks and toast are
cleared; what the agent *said* is not.

**One flaky test, found and fixed rather than retried.** The no-agent keyboard check pressed Tab after
`reload()` but before hydration. It now waits for a clue cell and for the roving tabindex to settle;
three consecutive runs are clean.

---

## Phase 4: User Story 2 — Every Move Comes With a Reason (Priority: P2) — Slice 2

**Goal**: the agent can place a digit — and cannot place one silently. The explanation appears with
the move, the digit is visibly the agent's, and one Undo removes it.

**Independent Test**: with board-reading and cell-filling tools only, confirm a fill cannot be
requested without an explanation, that the explanation surfaces on screen, that the digit is marked as
agent-placed, and that one undo removes it.

**Tools after this phase: 6**

### Tests for User Story 2 (write first, watch fail)

- [X] T056 [P] [US2] Write `tests/unit/actions.enterDigitAt.test.ts` asserting the coordinate-addressed action places correctly, rejects clues, filled cells, off-grid coordinates, and non-`playing` status — and **never changes `session.selection`**, at any coordinate (FR-056)
- [X] T057 [P] [US2] Write `tests/unit/actions.origin-parity.test.ts` running an identical sequence twice differing only in `origin`, asserting identical resulting state and identical undo behaviour (FR-042, SC-005)
- [X] T058 [P] [US2] Write `tests/contract/fillCell.test.ts`: name, schema, `explanation-required`, `explanation-length` with both bounds in `details`, `cell-is-clue`, `cell-not-empty`, `out-of-range`, `wrong-status` while paused and complete, and the success shape including `created_conflict` and `undo_depth` (FR-036, FR-037, FR-045)
- [X] T059 [P] [US2] Write `tests/component/Cell.agent.test.tsx` asserting an agent-placed digit is distinguishable from a clue and from a player entry by italic **and** a sage corner glyph — two cues, so neither colour nor style alone carries it (FR-044)
- [X] T060 [P] [US2] Write `tests/integration/agent-fill-undo.spec.ts`: tool call → digit rendered → explanation rendered → **one** Undo press → digit gone (Principle V's required full-collaboration integration test)
- [X] T061 [P] [US2] Write `tests/integration/agent-hostile-text.spec.ts` driving markup-bearing explanations through `fill_cell` and asserting the popup renders them as literal text with no element and no anchor created (FR-021, SC-012)
- [X] T062 [P] [US2] Write `tests/a11y/agent-fill.spec.ts` asserting the fill is announced politely, focus never moves, and agent/player/clue remain distinguishable under protanopia, deuteranopia, and tritanopia simulation (SC-004, SC-011)

### Implementation for User Story 2

> T063–T067 are the planned `actions.ts` split. **Feature 001's 241 unit tests are the safety net: the
> split lands with the suite green and no test file edited.** That is the evidence it was a move, not
> a rewrite.

- [X] T063 [US2] Extract selection and input-mode handling from `src/state/actions.ts` into `src/state/navigation.ts`
- [X] T064 [US2] Extract puzzle load, session load, pause, resume, tick, and undo into `src/state/lifecycle.ts`
- [X] T065 [US2] Extract cell mutations into `src/state/edits.ts`
- [X] T066 [US2] Create `src/state/reduce.ts`, routing an action to its handler
- [X] T067 [US2] Reduce `src/state/actions.ts` to the vocabulary — the `Action` union, creators, `ACTION_TYPES` — and confirm the full suite passes with **no test file modified**
- [X] T068 [US2] Add `enterDigitAt` to `src/state/edits.ts` and delegate the existing selection-based `enterDigit` to it, so both actors run one implementation
- [X] T069 [US2] Implement `src/tools/tools/fillCell.ts` via `defineWriteTool`, evaluating preconditions against the board **as it stands at the moment of the call** (FR-046)
- [X] T070 [US2] Register `fill_cell` in `src/tools/registry.ts`
- [X] T071 [US2] Render the sage corner glyph on agent-placed digits in `src/ui/Cell.tsx`
- [X] T072 [US2] Add example invocations to [contracts/webmcp-tool-surface.md](./contracts/webmcp-tool-surface.md) and walk **Slice 2** in [quickstart.md](./quickstart.md)

**Checkpoint**: ✅ **SLICE 2 COMPLETE** (2026-08-30). 439 unit/contract/component tests and 143 browser
tests green; lint, typecheck, and static export clean. `getTools()` returns six. Verified end to end:
an agent call fills a cell, the explanation appears with it, the digit is visibly the agent's, and one
press of the learner's own Undo removes it.

### What Slice 2 turned up

**A real defect in how authorship renders, found by a test rather than by looking this time.**
`inkClass` returned early on conflict, which silently dropped the italic from an agent digit that
happened to be wrong. That is exactly the case where authorship matters most: FR-038 deliberately
lets the tutor be wrong so the learner can check it, and a wrong digit that stops looking like the
agent's makes that impossible. Colour now says whether a digit CONFLICTS, slant says WHO WROTE IT, and
neither erases the other. A regression test pins it.

**The `actions.ts` split landed with the suite green and no test file edited** — 296 lines to 87,
across `reduce.ts`, `edits.ts`, `navigation.ts`, `lifecycle.ts`, and a shared `outcome.ts`. That is the
evidence it was a move rather than a rewrite.

**`agentSession.ts` then crossed the same 300-line trigger itself** and was split the same way, into
`annotations.ts` (what the marks are) and `explanations.ts` (what the agent said). The split is not
cosmetic: FR-031 turns on the difference between the two, since clearing the agent's marks must not
erase the record of what it said.

**Coordinate-addressed actions were the right call, and the test says so plainly.** `enterDigitAt` is
asserted not to move the selection *at every one of the 81 coordinates*, because "usually" is not the
claim FR-056 makes.

**Two more test bugs of my own, both instructive.** The origin-parity test generated two puzzles from
one seed and expected them to match — but `sudoku-gen` exposes no seed, so a seed picks a BAND, not a
board (001/R4); it now loads one shared puzzle into both stores. And the reload test raced
persistence's 250 ms debounce, silently testing a freshly generated puzzle instead of the restored
one; it now waits for the write rather than for a duration.

**Slice specs now assert containment, not an exact tool list.** The surface grows every slice by
design, so Slice 1's `toEqual([...five tools])` broke the moment `fill_cell` landed. The exact list
lives in one place, `tests/unit/tools.surface.test.ts`; each slice's spec asserts only what it added.

---

## Phase 5: User Story 3 — Show Me Why It Cannot Go There (Priority: P3) — Slice 3

**Goal**: the agent casts beams along the units that rule a digit out, so the learner sees the
constraint instead of reading about it.

**Independent Test**: ask the agent to justify one elimination. Beams appear along the correct lines,
are distinguishable from feature 001's crosshair, and clear on request.

**Tools after this phase: 7**

### Tests for User Story 3 (write first, watch fail)

- [X] T073 [P] [US3] Write `tests/contract/drawConstraintBeams.test.ts`: name, schema rejection of an empty beam list, an unknown `unit_type`, and a unit number outside 1–9; success shape with `beams_drawn`
- [X] T074 [P] [US3] Write `tests/integration/agent-beams.spec.ts` asserting a row beam and a column beam are both individually discernible where they cross, and that selecting a cell still produces a working, visibly different crosshair (FR-029, FR-032)
- [X] T075 [P] [US3] Write `tests/a11y/agent-beams.spec.ts` asserting beams survive greyscale as lines against fills, and that with `prefers-reduced-motion` they appear at their final state with no sweep (FR-061)

### Implementation for User Story 3

- [X] T076 [US3] Add the `beam` annotation kind to `src/state/agentSession.ts`
- [X] T077 [US3] Render beams in `src/ui/AnnotationLayer.tsx` as dashed centre lines with end caps, spanning the unit and remaining separable where they cross
- [X] T078 [US3] Implement `src/tools/tools/drawConstraintBeams.ts` via `defineWriteTool`
- [X] T079 [US3] Register `draw_constraint_beams` in `src/tools/registry.ts`
- [X] T080 [US3] Gate the beam draw-in in `src/ui/AnnotationLayer.tsx` on the store's `reducedMotion` value rather than on a media query inside the tools layer
- [X] T081 [US3] Add example invocations to [contracts/webmcp-tool-surface.md](./contracts/webmcp-tool-surface.md) and walk **Slice 3** in [quickstart.md](./quickstart.md)

**Checkpoint**: ✅ **SLICE 3 COMPLETE** (2026-08-30). 449 unit/contract/component tests and 155 browser
tests green; lint, typecheck, and static export clean. `getTools()` returns seven.

### What Slice 3 turned up

**Slice 1's annotation layer absorbed beams almost for free**, which is the payoff for building the
overlay as a 9x9 grid of positioned cells rather than doing pixel maths: a row beam is a horizontal
rule in nine cells, a column beam a vertical one in nine others, and they compose at the crossing with
no special case. FR-029's "individually discernible where they cross" is then true because the two
run in different *directions*, not because they are different colours -- so it survives greyscale.

**A box is an area, not a line**, so a box beam is a dotted frame rather than a ray. Drawing it as a
line would have meant choosing an arbitrary axis for something that constrains both.

**The draw-in sweep earns its place and is dropped on request.** A ray that grows along its unit shows
the DIRECTION of the constraint, which is the thing being taught -- so it is real teaching motion
rather than decoration, and FR-061 then has something to actually switch off. The layer reads
`reducedMotion` as a value from the store, published by the View, so the tools layer never queries a
media query.

**`test.use({ reducedMotion })` does not work in this Playwright version** -- 001's
`reduced-motion.spec.ts` already carries that note, and this slice rediscovered it. Emulating
per-test with `page.emulateMedia()` works, and the tests now say so where the next person will look.

---

## Phase 6: User Story 4 — Bookkeeping Done For Me (Priority: P4) — Slice 4

**Goal**: the agent pencils candidates — a whole board in one narrated, single-undo step, or specific
cells as it teaches.

**Independent Test**: on a mid-game board, have the agent fill all candidates and then prune a
specific one. Confirm correctness against the board's constraints and that each is one undo step.

**Tools after this phase: 9**

### Tests for User Story 4 (write first, watch fail)

- [X] T082 [P] [US4] Write `tests/unit/actions.setCandidatesAt.test.ts` asserting a multi-cell write produces **exactly one** `ChangeRecord`, and that one invalid entry in a batch of three changes **nothing at all** (FR-039, FR-043)
- [X] T083 [P] [US4] Write `tests/unit/actions.fillAllCandidates.test.ts` asserting every empty cell receives exactly its legal digits, no filled cell is touched, the whole board is one `ChangeRecord`, the count of overwritten learner candidates is reported, and one undo restores hand-written marks exactly (FR-040, FR-043, US4 scenario 4)
- [X] T084 [P] [US4] Write `tests/contract/updatePencilMarks.test.ts`: schema, all-or-nothing rejection, an empty digit list erasing a cell's marks, success shape
- [X] T085 [P] [US4] Write `tests/contract/autoFillAllPencilMarks.test.ts` asserting `acknowledgement-required` when learner-written marks would be replaced without the flag, success with the flag, and `hand_written_marks_replaced` in the result (FR-041)
- [X] T086 [P] [US4] Write `tests/integration/agent-pencil.spec.ts`: fill all candidates → spot-check a cell against its row, column, and box → one Undo clears the lot
- [X] T087 [P] [US4] Write `tests/component/Cell.agentCandidates.test.tsx` asserting agent-written candidates are distinguishable from the learner's own (FR-044)

### Implementation for User Story 4

- [X] T088 [US4] Add `setCandidatesAt` to `src/state/edits.ts` — one record for the whole batch, all-or-nothing on any invalid entry
- [X] T089 [US4] Add `fillAllCandidates` to `src/state/edits.ts`, deriving digits from the Engine's `allCandidates` over the **visible** board (so it can never leak the solution) and reporting how many learner-written candidates it overwrote
- [X] T090 [P] [US4] Implement `src/tools/tools/updatePencilMarks.ts` via `defineWriteTool`
- [X] T091 [P] [US4] Implement `src/tools/tools/autoFillAllPencilMarks.ts` via `defineWriteTool`, enforcing the acknowledgement flag — the mechanism that makes FR-041 checkable rather than aspirational
- [X] T092 [US4] Register both tools in `src/tools/registry.ts`
- [X] T093 [US4] Mark agent-written candidates in `src/ui/Cell.tsx`
- [X] T094 [US4] Add example invocations to [contracts/webmcp-tool-surface.md](./contracts/webmcp-tool-surface.md) and walk **Slice 4** in [quickstart.md](./quickstart.md)

**Checkpoint**: ✅ **SLICE 4 COMPLETE** (2026-08-30). 479 unit/contract/component tests and 163 browser
tests green; lint, typecheck, and static export clean. `getTools()` returns nine.

### What Slice 4 turned up

**FR-041 was unenforceable as written, and is now mechanical.** It requires the explanation to say
that hand-written marks were replaced -- but text cannot be checked for meaning. Consent CAN be
checked for presence, so `auto_fill_all_pencil_marks` refuses when learner marks exist and
`acknowledges_replacing_marks` is absent, naming how many cells are at stake. That is the same move as
the narration wrapper: make the guarantee structural rather than hope the agent is polite.

**All-or-nothing on `update_pencil_marks` is an argument, not a convenience.** One explanation
accompanied the call, so a half-applied batch would be described on screen by text that no longer
matches the board. Enforced in the state layer, asserted in both the unit and the browser test.

**The integration test checks candidate correctness the way a reviewer would** -- it reads the cell's
row, column, and box off the DOM and confirms the offered digits are exactly the ones none of them
contain. Asserting against `legalCandidates` would have tested the Engine against itself.

**One undo really does restore hand-written marks**, because `fillEveryCandidate` emits a single
`ChangeRecord` covering every cell it touched -- the same compound-record machinery 001 built for
`enterDigit`. US4's fourth scenario needed no new mechanism at all.

---

## Phase 7: User Story 5 — Walk Me Through It (Priority: P5) — Slice 5

**Goal**: a narrated chain of moves that plays in order, explains itself step by step, and stops dead
the moment the learner touches the board.

**Independent Test**: request a three-step walkthrough. Each step shows its own explanation in order,
interrupting mid-sequence stops it cleanly, and the board is coherent afterwards.

**Tools after this phase: 10**

### Tests for User Story 5 (write first, watch fail)

- [X] T095 [P] [US5] Write `tests/unit/playback.sequencer.test.ts` with an **injected fake clock**: steps run in order, a bumped `learnerActivity` counter halts the sequence before the next step, an aborted signal halts it, completed steps are never rolled back, and the reported counts are correct (FR-048, FR-049)
- [X] T096 [P] [US5] Write `tests/contract/playbackDeductionSequence.test.ts` asserting per-action required fields are validated **before step one runs**, that an interruption returns `ok: true` with `stopped_because: 'interrupted'`, and that a failed step returns `playback-step-failed` with the completed count
- [X] T097 [P] [US5] Write `tests/integration/agent-playback.spec.ts` asserting each step's own explanation appears as that step plays — in order, not all at once — that clicking a cell mid-sequence stops it immediately, and that Undo afterwards steps back **one at a time** (FR-047, FR-050)
- [X] T098 [P] [US5] Write `tests/a11y/agent-playback.spec.ts` asserting the board stays visible and writable throughout, no input is refused or delayed, and reduced motion changes pacing without animation (FR-051, SC-007, SC-006)

### Implementation for User Story 5

- [X] T099 [US5] Add `playbackStarted`, `playbackAdvanced`, and `playbackEnded` to `src/state/agentSession.ts`
- [X] T100 [US5] Implement the sequencer in `src/tools/playback.ts` with an injected scheduler (defaulting to `setTimeout`), observing the `learnerActivity` counter and the handler's `AbortSignal` ([research.md § R8](./research.md))
- [X] T101 [US5] Add whole-sequence pre-validation to `src/tools/playback.ts` so a sequence that would fail at step four is rejected at step zero rather than abandoning the learner halfway
- [X] T102 [US5] Implement `src/tools/tools/playbackDeductionSequence.ts`, dispatching one **ordinary** action per step so each stays individually undoable (FR-050)
- [X] T103 [US5] Register `playback_deduction_sequence` in `src/tools/registry.ts`
- [X] T104 [US5] Create `src/ui/PlaybackIndicator.tsx`, a non-blocking progress indicator driven by `PlaybackState` — visible, never modal, never focus-stealing — and render it from `src/ui/GameScreen.tsx`
- [X] T105 [US5] Confirm `learnerActed` fires from `src/ui/Board.tsx` on **both** pointer and keyboard interaction, so interruption cannot be evaded by the input method
- [X] T106 [US5] Add example invocations to [contracts/webmcp-tool-surface.md](./contracts/webmcp-tool-surface.md) and walk **Slice 5** in [quickstart.md](./quickstart.md)

**Checkpoint**: ✅ **SLICE 5 COMPLETE** (2026-08-30). 506 unit/contract/component tests and 175 browser
tests green; lint, typecheck, and static export clean. `getTools()` returns ten.

### What Slice 5 turned up

**Almost all of FR-049 and FR-050 came free**, and that is the clearest payoff yet from 001's decision
to make agent and human writes the same code path. "Completed steps are never rolled back" is true
because each step is an ordinary dispatch already committed to history — stopping is simply not
dispatching the next one. "Each step individually undoable" is true because one step is one ordinary
action with its own `ChangeRecord`. Neither needed a line of new machinery.

**The injected scheduler is what makes the sequencer testable at all.** Fifteen unit tests pin
ordering, pacing, interruption, abort, and no-rollback — instantly and deterministically, with a fake
clock. The browser tests then run against the real 1.2 s pace, because what *they* are testing is that
a human can watch it and take over.

**Activity BEFORE the call must not cancel it.** The first implementation captured the interruption
baseline before the sequence began and re-based it after every step; a test then asserted that a click
before the call stopped playback at step zero. That assertion was wrong, and the design question it
exposed is real: the learner clicking a moment before the agent starts is not an interruption of a
walkthrough that had not begun, and cancelling would look like the tool not working. The baseline is
now captured once, at the start, and never moves.

**An interruption returns `ok: true`.** The learner taking control is the system working as designed,
not a failure to report as one — only a step failing its own precondition is `ok: false`.

**Reduced motion drops the animation time, not the reading time.** The pace falls from 1200 ms to
1000 ms, which is exactly the sweep that no longer plays. Shortening the dwell for a learner who asked
for less motion would make a walkthrough harder to follow, which is backwards.

---

## Phase 8: User Story 6 — Give Me One to Practice On (Priority: P6) — Slice 6

**Goal**: the agent can load a curated drill for a named technique — after the learner agrees, because
this is the only agent action that discards their work.

**Independent Test**: ask for a drill on a named technique from a half-finished board. The learner is
asked first, declining changes nothing, and accepting loads a valid puzzle genuinely requiring that
technique.

**Tools after this phase: 11 — the surface is complete.**

### Tests for User Story 6 (write first, watch fail)

- [X] T107 [P] [US6] Write `tests/unit/requiresTechnique.test.ts` asserting the definition holds in both directions: the reduced technique set stalls, and adding the named technique completes ([research.md § R9](./research.md))
- [X] T108 [P] [US6] Write `tests/unit/drills.test.ts` asserting **every** bundled drill has exactly one solution by our own counting solver and satisfies `requiresTechnique` for its tag (FR-052, SC-009, Principle IV)
- [X] T109 [P] [US6] Write `tests/contract/loadTechniquePractice.test.ts` asserting an unknown technique is rejected with the available list in `details` (FR-054), that a decline returns `ok: true` with `outcome: 'declined'` rather than an error (FR-053), and that an unanswered confirmation resolves as declined after its timeout
- [X] T110 [P] [US6] Write `tests/integration/agent-drill.spec.ts`: confirmation appears on a board with progress → declining leaves the board untouched → accepting loads the drill, resets the timer, and clears history
- [X] T111 [P] [US6] Write `tests/a11y/agent-confirmation.spec.ts` asserting the confirmation is **not** a modal: no focus trap, no backdrop, the board remains playable behind it, and it is announced politely (FR-056, Principle V)

### Implementation for User Story 6

- [X] T112 [US6] Implement `src/engine/requiresTechnique.ts` over the existing technique modules — the decidable definition behind FR-052
- [X] T113 [US6] Author `src/engine/drills.ts`: one verified drill per technique in the registry, each an 81-character puzzle string, bundled as constants with no network access (FR-055)
- [X] T114 [US6] Add `askConfirmation` and `answerConfirmation` to `src/state/agentSession.ts` with the 60-second timeout
- [X] T115 [US6] Create `src/ui/ConfirmationBanner.tsx` — inline, dismissible by answering, never blocking the board
- [X] T116 [US6] Implement `src/tools/tools/loadTechniquePractice.ts`, generating its `technique` enum from the technique registry so the schema cannot go stale
- [X] T117 [US6] Register `load_technique_practice` in `src/tools/registry.ts` and confirm `getTools()` returns **11**
- [X] T118 [US6] Add example invocations to [contracts/webmcp-tool-surface.md](./contracts/webmcp-tool-surface.md) and walk **Slice 6** in [quickstart.md](./quickstart.md)

**Checkpoint**: ✅ **SLICE 6 COMPLETE** (2026-08-30). 537 unit/contract/component tests and 188 browser
tests green; lint, typecheck, and static export clean. **`getTools()` returns eleven — the surface is
complete.**

### What Slice 6 turned up

**Two of the five techniques have no drill, and that is a finding rather than an omission.**
`requiresTechnique` makes "genuinely requires" decidable: the puzzle must stall without the technique
and finish with it, using techniques of the same band or easier. Measured against that bar:

| Technique | Drill | Evidence |
|---|---|---|
| `hidden-single` | ✅ | found in the first sweep |
| `locked-candidates` | ✅ | found in the first sweep |
| `naked-pair` | ✅ | found in the first sweep |
| `naked-single` | ❌ | none in 400,000 candidates — hidden singles subsume naked singles in practice, so a board that stalls on hidden singles alone but yields to naked singles may simply not exist |
| `x-wing` | ❌ | none in a 20-minute search — a puzzle our other four techniques cannot finish usually needs more than an X-Wing to finish it |

**FR-054 anticipated exactly this**, which is why the spec asks for a rejection listing the techniques
that *do* have drills. The alternative — shipping five drills where two do not require their technique
— would teach the wrong lesson, which is the failure that actually matters. **The spec's own worked
example is an X-Wing drill, so this is worth a scope decision**: either accept three, or extend the
technique set (a Swordfish or XY-Wing module would make X-Wing-exact puzzles findable, because the
"stalls without" test would then have a harder ceiling to fail against).

**A real conflict between two correct rules, resolved rather than weakened.** `load_technique_practice`
must verify drill uniqueness (Principle IV), but the Tools layer is banned from importing
`solver.ts` — which also exports `solve()`, the one function that returns a completed grid. Rather
than relax the ban to "import the module but only the safe export" — a rule nothing enforces — the
safe question got its own module: `hasUniqueSolution` returns a boolean and has no shape that could
carry a solution. The module-level ban stands.

**The confirmation is an inline banner, and the tests assert the absence of everything a modal would
bring**: no backdrop, no focus trap, no disabled controls, and the learner can keep solving while it
sits there. Ignoring it for a minute resolves the agent's call as `declined`.

**One promise-unwrapping trap worth recording.** An async helper that `return`ed the in-flight tool
promise meant `await ask(page)` unwrapped it and blocked until the learner answered — deadlocking four
tests at 30 s each. Wrapping it in an object fixed it; the comment explaining why is in the file.

---

## Phase 9: Polish & Cross-Cutting Concerns — Slice 7 (Audit)

**Purpose**: confirm and measure what the earlier slices built. **If they did their job this phase
finds nothing** — though 001's audit found two real bugs, so that is a hope rather than a promise.
Accessibility was a gate on every prior phase, not deferred to here.

- [X] T119 [P] Write `tests/contract/hostile-inputs.test.ts` driving malformed, oversized, out-of-range, markup-bearing, and prototype-polluting inputs through **all eleven** tools, asserting none changes the board and none throws (SC-012)
- [X] T120 [P] Write `tests/integration/agent-no-network.spec.ts` asserting zero network requests across the entire agent surface, drills included (FR-059, Principle II)
- [X] T121 [P] Complete `tests/perf/agent-tools.spec.ts`: p95 under 100 ms for the nine non-exempt tools, with the two exemptions named and cross-referenced to [plan.md § Complexity Tracking](./plan.md)
- [X] T122 [P] Write `tests/a11y/agent-full-sweep.spec.ts` running axe over every agent state — annotations, beams, explanations, toast, confirmation, playback — at 360 px and desktop
- [X] T123 [P] Write `tests/integration/agent-parity.spec.ts` asserting that with no host present the site scores identically against feature 001's success criteria with zero agent-related elements (SC-010)
- [X] T124 [P] Write `tests/unit/tools.layering.test.ts` asserting no tool handler module references `document` or `window` (only `registry.ts` may), `src/tools` imports no UI module, and `src/ui` imports no tools module (Principle III)
- [X] T125 Verify `surface_version` is present in every result from every tool, success and failure alike, and that the version matches `TOOL_SURFACE_VERSION` (FR-010)
- [ ] T126 ⚠️ **NOT DONE — needs you.** **SC-001, the real test**: point a live agent at the site with no site-specific instructions and confirm it can read the board, identify a valid next move, and explain it from the tool descriptions alone. Nothing in this environment implements `document.modelContext`, so the surface has only ever been driven through a spec-conformant fake and through the real API's own shape. This is the one criterion that cannot be self-certified
- [X] T127 Verify SC-004 from a static screenshot in greyscale and under colour-vision-deficiency simulation: learner digits, agent digits, and clues are all identifiable without interaction
- [X] T128 Verify import-direction lint passes and record every module against Principle III's 300-line review trigger, including the post-split `src/state/` modules
- [X] T129 Record the gzipped first-load number as informational output and confirm it still gates nothing, per the deferral carried forward in [plan.md § Complexity Tracking](./plan.md)
- [X] T130 Walk **every** slice script in [quickstart.md](./quickstart.md) end to end against `npm run build && npm start`, including the feature 001 scripts with no agent connected
- [ ] T131 ⚠️ **NOT DONE — nothing is committed.** Confirm the commit history shows failing tests preceding their implementations across all phases (Principle V). Every test in this feature was written and watched fail before its implementation, but that order lives only in the working tree until the slices are committed
- [X] T132 [P] Update the status tables in `README.md` and `CLAUDE.md`, and close or re-scope the open items 001 left behind

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately
- **Foundational (Phase 2 / Slice 0)**: depends on Setup — **blocks every user story**
- **User stories (Phases 3–8)**: all depend on Phase 2. They are written in the spec's own priority
  order, and that order is also the delivery order
- **Polish (Phase 9)**: depends on every story being complete

### User Story Dependencies

- **US1 (P1)**: needs only Phase 2. **This is the MVP.**
- **US2 (P2)**: needs Phase 2. Uses US1's narration wrapper — build US1 first, or build the wrapper as
  part of US2. Independently testable either way.
- **US3 (P3)**: needs Phase 2 and US1's annotation layer (beams add one kind to it).
- **US4 (P4)**: needs Phase 2 and US2's narration path. Independent of US1's visuals.
- **US5 (P5)**: needs US2 and US4 — a walkthrough sequences the write tools those stories deliver.
- **US6 (P6)**: needs Phase 2 and the confirmation surface. Independent of US3–US5.

The honest dependency here is **US1 → US2 → US5**: the narration wrapper must exist before any write
tool, and playback sequences write tools. US3, US4, and US6 are only loosely coupled.

### Within Each Story

Tests first, and watched failing for the right reason. Then: state layer → tools layer → UI → registry
→ contract documentation → quickstart walk. The registry entry comes last within a slice so a
half-built tool is never registered.

### Parallel Opportunities

- All Phase 1 tasks marked [P]
- **Every test task in a phase** — they are separate files with no shared state
- The eleven tool modules are independent of one another; only `registry.ts` serialises them
- `AnnotationLayer`, `ExplanationQueue`, and `AgentToast` are three separate components (T045–T047)
- The five `src/state/` split modules (T063–T066) touch different files, but T067 must follow them all

---

## Parallel Example: User Story 1

```bash
# All eleven US1 tests together — different files, no shared state:
Task: "Extend palette contrast test in tests/unit/palette.contrast.test.ts"
Task: "Write narration contract test in tests/unit/narration.test.ts"
Task: "Write annotation store test in tests/unit/agentSession.annotations.test.ts"
Task: "Write contract test in tests/contract/highlightPatternCells.test.ts"
Task: "Write contract test in tests/contract/showPatternHintToast.test.ts"
Task: "Write contract test in tests/contract/clearVisualAnnotations.test.ts"
Task: "Write store isolation test in tests/unit/agentSession.isolation.test.ts"
Task: "Write untrusted-text test in tests/component/ExplanationQueue.test.tsx"
Task: "Write integration test in tests/integration/agent-annotations.spec.ts"
Task: "Write a11y test in tests/a11y/agent-annotations.spec.ts"
Task: "Write greyscale test in tests/a11y/agent-greyscale.spec.ts"

# Then the three annotation components together:
Task: "Create src/ui/AnnotationLayer.tsx"
Task: "Create src/ui/ExplanationQueue.tsx"
Task: "Create src/ui/AgentToast.tsx"

# Then the three tool modules together:
Task: "Implement src/tools/tools/highlightPatternCells.ts"
Task: "Implement src/tools/tools/showPatternHintToast.ts"
Task: "Implement src/tools/tools/clearVisualAnnotations.ts"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 — Setup
2. Phase 2 — Foundational (Slice 0): two tools, and an agent can read the board
3. Phase 3 — US1 (Slice 1): the agent can point
4. **STOP and VALIDATE**: walk Slices 0 and 1 in [quickstart.md](./quickstart.md) against a real
   `document.modelContext`
5. Deploy. This is already a tutor — it perceives and directs attention, and it cannot touch the
   learner's board.

### Incremental Delivery

Each slice ends in a deployable site with a strictly larger agent surface, so the review question is
always the same and always concrete: **run `getTools()`, then drive the new tools by hand.**

| After | `getTools()` | The thing you can newly do |
|---|---|---|
| Slice 0 | 2 | read the board through the standard |
| Slice 1 | 5 | be pointed at a pattern |
| Slice 2 | 6 | have a digit placed, with a reason, undoable in one press |
| Slice 3 | 7 | see a constraint drawn |
| Slice 4 | 9 | have the whole board pencilled in one undoable step |
| Slice 5 | 10 | watch a deduction play out, and interrupt it |
| Slice 6 | 11 | be handed a drill for the technique you just learned |
| Slice 7 | 11 | read the audit |

### Parallel Team Strategy

After Phase 2, one developer takes US1 → US2 → US5 (the narration spine), while a second takes US3 and
US6 (loosely coupled). US4 joins once US2's narration path exists.

---

## Notes

- `[P]` = different files, no incomplete dependencies
- **Watch each test fail for the right reason before writing the code.** A test that passes on first
  run is testing nothing, and Principle V requires the failing-first order to be visible in history
- Commit after each task or logical group
- **Look at the page.** Two purely visual defects have shipped past a fully green suite in this
  project. Counting elements proves nothing about whether anything is drawn
- The registry entry is the last implementation task in every slice — never register a half-built tool


---

## ✅ FEATURE 002 COMPLETE (2026-08-30)

130 of 132 tasks done. **851 unit/contract/component tests and 204 browser tests green**; lint,
typecheck, and static export clean. The tool surface is eleven tools on `document.modelContext`.

Two tasks are deliberately left open because they cannot be self-certified — see T126 and T131.

### The audit found three real defects

Slice 7 was meant to confirm what the earlier slices built. As in 001, it did not come back empty --
though two of these were caught by the slices themselves rather than here.

**1. An agent digit that was WRONG stopped looking like the agent's.** `inkClass` returned early on
conflict, dropping the italic authorship cue. That is precisely the case where authorship matters
most: FR-038 lets the tutor be wrong so the learner can check it, and a wrong digit that no longer
looks like the agent's makes checking impossible. Colour now says whether a digit conflicts, slant
says who wrote it, and neither erases the other.

**2. The `because` hatch made the digit underneath hard to read.** Hatching the whole cell was the
obvious implementation; its stripes ran straight through a clue's `4`. The palette contrast test could
not catch it -- the ratios are computed against the flat token, while the damage is done by stripes
crossing a glyph. **It took looking at the board.** The hatch is now a frame around the cell edge.
That is the third purely visual defect to ship past a green suite in this project.

**3. The explanation queue's live region rendered with no agent host** -- an empty, labelled
`role="status"` element, which is exactly the kind of agent-related affordance SC-010 forbids on a
host-less page. Found by the parity test. The whole agent UI is now gated on the agent existing,
which also keeps the live region stable for the duration of a real session.

### Two open items, honestly

**Drills exist for three techniques of five.** `requiresTechnique` demands a puzzle that stalls
without the technique and finishes with it. `naked-single` produced nothing in 400,000 candidates
(hidden singles subsume it in practice) and `x-wing` nothing in a 20-minute search (a board our other
four techniques cannot finish usually needs more than an X-Wing). FR-054 is the designed response and
works. But **the spec's own worked example is an X-Wing drill**, so this needs a scope decision:
accept three, or add a harder technique module so X-Wing-exact puzzles become findable.

**SC-001 is unverified against a live agent.** The surface has been driven through a spec-conformant
fake and coded to the published IDL, but no browser here implements `document.modelContext`.

### Verified

| Check | Result |
|---|---|
| Tool surface, enumerated with no DOM | 11 tools, unique snake_case names, strict schemas |
| Agent tool call p95 | `get_board_state` 0.2 ms, `check_for_conflicts` 0.1 ms, `fill_cell` 0.1 ms, `update_pencil_marks` 0.1 ms, `clear_visual_annotations` 0.3 ms, `show_pattern_hint_toast` 0.4 ms, `draw_constraint_beams` 0.7 ms, `auto_fill_all_pencil_marks` 0.7 ms, `highlight_pattern_cells` 1.1 ms — against a 100 ms budget |
| Exempt tools | `playback_deduction_sequence`, `load_technique_practice` — recorded deviation |
| Hostile inputs | 19 payloads × 11 tools; none throws, none changes the board when refused |
| Solution leakage | none, across the whole surface on a nearly-solved board |
| axe | no violations across every agent state, at 360 px and desktop |
| Greyscale + CVD | agent, learner, and clue distinguishable; target vs because distinguishable |
| No-host parity | zero agent elements in DOM or accessibility tree; all of 001 still passes |
| Network requests after load | zero, across all eleven tools including drill loading |
| localStorage | no annotation, explanation, or toast; `origin: 'agent'` persists as `'a'` |
| Layer boundaries | `ui ↔ tools` forbidden both ways; `document` only in `registry.ts`; lint clean |
| Largest module | 276 lines (`src/tools/playback.ts`) — everything under the 300-line trigger |
| Long tasks during tool calls | none |
| Bundle | **195.4 KB gzipped first load**, informational only (budget still deferred) |
