---

description: "Task list for 001-sudoku-play-experience"
---

# Tasks: Core Sudoku Play Experience

**Input**: Design documents from `/specs/001-sudoku-play-experience/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **MANDATORY, not optional.** Constitution v1.2.0 Principle V is NON-NEGOTIABLE: *"Tests MUST
be written before the code they test… Tests retrofitted after the implementation do not satisfy this
principle. The commit history MUST show the failing test arriving before or with the code that
satisfies it."* Every phase below therefore lists its tests first, and they must be seen to fail before
the implementation tasks in that phase begin.

**Organization**: Phases map one-to-one onto the eight vertical slices in
[plan.md § Vertical Slice Plan](./plan.md). **Every phase from Phase 2 onward ends in a website you can
open, click, and review** — walk that slice's demo script in [quickstart.md](./quickstart.md) before
moving on.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story this task serves (US1–US6). Setup, Foundational, and Polish carry no label.

## Path Conventions

Paths follow [plan.md § Source Code](./plan.md): `app/` (Next.js shell), `src/engine/`, `src/state/`,
`src/ui/`, `src/workers/`, `tests/`. Import direction is `engine ← state ← ui`, enforced by lint.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization. Combined with Phase 2 this forms **Slice 0**.

- [ ] T001 Initialize Node project and commit `package.json` at repository root
- [ ] T002 Install runtime dependencies: `next@16`, `react@19`, `react-dom@19`, `sudoku-gen`, `lucide-react`
- [ ] T003 Install dev dependencies: `typescript`, `vitest`, `fast-check`, `@testing-library/react`, `@playwright/test`, `@axe-core/playwright`, `eslint`, `eslint-plugin-import`, `tailwindcss@4`, `@tailwindcss/postcss`
- [ ] T004 [P] Create `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`, and path alias `@/*` → `src/*`
- [ ] T005 [P] Create `next.config.ts` with `output: 'export'` and `images.unoptimized: true`
- [ ] T006 [P] Create `postcss.config.mjs` registering `@tailwindcss/postcss`
- [ ] T007 [P] Create `vitest.config.ts` with a `node` environment for `tests/unit` and `tests/property`, and `jsdom` for `tests/component`
- [ ] T008 [P] Create `playwright.config.ts` pointing at the static `out/` directory served by a plain file server
- [ ] T009 Create `eslint.config.mjs` with an `import/no-restricted-paths` rule enforcing `engine ← state ← ui` and banning deep imports past module entry points
- [ ] T010 Add npm scripts to `package.json`: `dev`, `build`, `test`, `test:perf`, `test:a11y`, `lint`

---

## Phase 2: Foundational (Blocking Prerequisites) — Slice 0

**Purpose**: The palette contract, grid primitives, and store skeleton every story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

**Slice 0 demo**: an empty 9×9 Japandi grid with shoji line weights, served from `out/` as static files.

### Tests for Phase 2 (write first, watch fail)

- [ ] T011 [P] Write `tests/unit/palette.contrast.test.ts` asserting every ratio in [research.md § R3](./research.md): clue/player/conflict/note ink ≥ 4.5:1 on ground, crosshair, matching, and conflict washes; selection ring ≥ 3.0:1; box lines ≥ 3.0:1; clue-vs-player ink ≥ 1.5:1 in greyscale
- [ ] T012 [P] Write `tests/unit/grid.test.ts` covering index↔coordinate round-trips, box computation, and that `peersOf` returns exactly 20 cells for every index
- [ ] T013 [P] Write `tests/unit/store.skeleton.test.ts` asserting `getState`/`subscribe`/`dispatch` exist, subscribe returns a working unsubscribe, and an unknown action returns `ok: false` without throwing
- [ ] T014 [P] Write `tests/integration/static-export.spec.ts` asserting the built site loads and renders the grid when served from a plain file server with no Next.js runtime

### Implementation for Phase 2

- [ ] T015 Create `app/globals.css` with the Tailwind v4 `@theme` block declaring all 13 palette tokens from [research.md § R3](./research.md) — the only place palette values may exist
- [ ] T016 [P] Create `src/engine/grid.ts` with `Digit`, `CellIndex`, `Coord`, index↔coordinate helpers, `boxOf`, and a memoised `peersOf`
- [ ] T017 [P] Create `src/engine/prng.ts` exporting `createPrng(seed)` — the single source of first-party randomness
- [ ] T018 [P] Create `src/state/types.ts` with `Cell`, `CellOrigin`, `GameSession`, `SessionStatus`, and `ChangeRecord` per [data-model.md](./data-model.md)
- [ ] T019 Create `src/state/history.ts` with `pushRecord`, `revertRecord`, and `canUndo` — the undo machinery the Undo *control* will use in US5
- [ ] T020 Create `src/state/store.ts` with `getState`, `subscribe`, `dispatch`, and the `DispatchResult`/`RejectionReason` types from [contracts/store-actions.md](./contracts/store-actions.md); no React import
- [ ] T021 Create `src/ui/useStore.ts` binding the store to React through `useSyncExternalStore`
- [ ] T022 [P] Create `app/layout.tsx` importing `globals.css` and setting page metadata and language
- [ ] T023 [P] Create `src/ui/Cell.tsx` rendering one static cell with token-derived classes and no interactivity yet
- [ ] T024 Create `src/ui/Board.tsx` rendering the 9×9 grid with hairline cell separators and heavier 3×3 box framing (FR-053)
- [ ] T025 Create `src/ui/GameScreen.tsx` composing the board shell
- [ ] T026 Create `app/page.tsx` mounting `<GameScreen />` as the single route
- [ ] T027 Add `npm run test:perf` harness in `tests/perf/budgets.spec.ts` enforcing the timing budgets, and **reporting first-load gzipped JS as informational output only** (bundle budget deferred — see [plan.md § Complexity Tracking](./plan.md))
- [ ] T028 Verify `npm run build` emits `out/` and `npx serve out` renders the grid with zero network requests after load

**Checkpoint**: Slice 0 complete — walk the Slice 0 demo in [quickstart.md](./quickstart.md).

---

## Phase 3: User Story 1 — Sit Down and Solve (Priority: P1) 🎯 MVP — Slice 1

**Goal**: A real, uniquely-solvable puzzle on screen that accepts digits by mouse and keyboard,
protects clues, and regenerates on difficulty change.

**Independent Test**: Open the site cold, place digits into every empty cell of an Easy puzzle using
mouse and keypad, and reach a completed grid — with no highlighting, notes, timer, or persistence.

### Tests for User Story 1 (write first, watch fail)

- [ ] T029 [P] [US1] Write `tests/unit/solver.test.ts` asserting `countSolutions` returns 0, 1, and 2 correctly and never exceeds its cap
- [ ] T030 [P] [US1] Write `tests/property/uniqueness.property.test.ts` using fast-check over ≥10,000 generated puzzles asserting exactly one solution (SC-003)
- [ ] T031 [P] [US1] Write `tests/unit/rating.test.ts` asserting difficulty derives from techniques required and never from clue count
- [ ] T032 [P] [US1] Write `tests/unit/generate.test.ts` asserting a puzzle whose uniqueness check fails is discarded and redrawn, and that `puzzleString` round-trips to the same clues
- [ ] T033 [P] [US1] Write `tests/unit/solution-quarantine.test.ts` asserting no value returned by `generatePuzzle` and no serialised store state contains a complete 81-digit grid
- [ ] T034 [P] [US1] Write `tests/unit/actions.entry.test.ts` covering `selectCell`, `moveSelection` (no wrap at edges), `enterDigit`, and `eraseCell`, including that every clue-targeting action returns `ok: false` with reason `cell-is-clue` and changes nothing
- [ ] T035 [P] [US1] Write `tests/unit/store.headless.test.ts` driving a full puzzle to completion through `dispatch` alone with **no DOM mounted** (Principle I prerequisite for feature 002)
- [ ] T036 [P] [US1] Write `tests/component/Keypad.test.tsx` asserting keypad and keyboard dispatch identical actions (FR-020)
- [ ] T037 [P] [US1] Write `tests/integration/play.spec.ts` covering the US1 acceptance scenarios end to end
- [ ] T038 [P] [US1] Write `tests/a11y/board.spec.ts` asserting axe passes, the board exposes grid semantics, and selection moves programmatic focus

### Implementation for User Story 1

- [ ] T039 [P] [US1] Create `src/engine/solver.ts` with `countSolutions(clues, cap = 2)` and `solve`
- [ ] T040 [P] [US1] Create `src/engine/techniques/nakedSingle.ts` implementing the `Technique` interface from [contracts/engine-api.md](./contracts/engine-api.md)
- [ ] T041 [P] [US1] Create `src/engine/techniques/hiddenSingle.ts` implementing the same interface
- [ ] T042 [US1] Create `src/engine/techniques/index.ts` registering techniques in band order (no switch statement)
- [ ] T043 [US1] Create `src/engine/rating.ts` with `rateDifficulty` solving via technique modules only
- [ ] T044 [US1] Create `src/engine/generate.ts` with `generatePuzzle`: draw from `sudoku-gen`, verify uniqueness, re-rate by technique, redraw on mismatch, and never return the solution
- [ ] T045 [US1] Create `src/workers/generate.worker.ts` running generation off the main thread, with a main-thread time-sliced fallback when Workers are unavailable
- [ ] T046 [US1] Implement `newPuzzle` and `selectCell` in `src/state/actions.ts`
- [ ] T047 [US1] Implement `moveSelection` in `src/state/actions.ts` with edge clamping (FR-019)
- [ ] T048 [US1] Implement `enterDigit` and `eraseCell` in `src/state/actions.ts`, each recording exactly one `ChangeRecord` and rejecting clue cells
- [ ] T049 [US1] Extend `src/ui/Cell.tsx` with click selection and clue-versus-player ink styling (FR-005)
- [ ] T050 [P] [US1] Create `src/ui/Keypad.tsx` with digits 1–9 and touch targets ≥ 44 px
- [ ] T051 [P] [US1] Create `src/ui/DifficultySelect.tsx` dispatching `newPuzzle` on change
- [ ] T052 [US1] Add board keyboard handling in `src/ui/Board.tsx` for digits, `Backspace`/`Delete`, arrows and `WASD`, scoped so shortcuts do not fire while a control holds focus; render a skeleton board during `generating` and a brief non-blocking indication on clue rejection (FR-021)

**Checkpoint**: Slice 1 complete and independently demoable — this is the MVP.

---

## Phase 4: User Story 2 — See the Board at a Glance (Priority: P2) — Slice 2

**Goal**: Crosshair and matching-digit highlighting that reduces scanning effort and changes nothing.

**Independent Test**: With a static pre-filled board, click cells and confirm correct tinting appears
and clears, and that no game state changes as a result.

### Tests for User Story 2 (write first, watch fail)

- [ ] T053 [P] [US2] Write `tests/unit/selectors.highlight.test.ts` asserting `crosshairSet` covers row, column, and box, `matchingSet` covers equal values including clues, and both are empty-safe when the selected cell is empty (FR-011)
- [ ] T054 [P] [US2] Write `tests/unit/selectors.purity.test.ts` asserting selecting a cell leaves values, candidates, elapsed time, and history untouched (FR-010)
- [ ] T055 [P] [US2] Write `tests/component/Cell.tiers.test.tsx` asserting tier precedence resolves to the correct class per [data-model.md](./data-model.md)
- [ ] T056 [P] [US2] Write `tests/a11y/greyscale.spec.ts` asserting crosshair, matching, and selected states remain distinguishable with colour removed (SC-010)

### Implementation for User Story 2

- [ ] T057 [P] [US2] Create `src/state/selectors.ts` with `crosshairSet` and `matchingSet`, computed not stored
- [ ] T058 [US2] Add crosshair and matching wash classes to `src/ui/Cell.tsx` using palette tokens only
- [ ] T059 [US2] Implement the 2px selection **ring** in `src/ui/Cell.tsx` — a ring, not a fill, per [research.md § R3](./research.md); this is what keeps every tier legible
- [ ] T060 [US2] Implement tier precedence composition (conflict > matching > crosshair, ring over any) in `src/ui/Cell.tsx`
- [ ] T061 [US2] Render matching-digit cells at medium type weight as the non-colour cue (FR-009)
- [ ] T062 [US2] Wire highlight selectors into `src/ui/Board.tsx` via `useStore.ts`

**Checkpoint**: Slice 2 complete — Slices 1 and 2 both work independently.

---

## Phase 5: User Story 3 — Catch Mistakes Early (Priority: P3) — Slice 3

**Goal**: Duplicate digits flagged in clay with a non-colour cue, plus completion detection.

**Independent Test**: On a pre-filled board, place known duplicates in a row, a column, and a box;
confirm each is flagged and clears when resolved. Then finish a board and see the completion banner.

### Tests for User Story 3 (write first, watch fail)

- [ ] T063 [P] [US3] Write `tests/unit/conflicts.test.ts` covering duplicates in row, column, and box, that all participants are returned, and that a clue participating in a conflict is included
- [ ] T064 [P] [US3] Write `tests/unit/conflicts.no-solution-peek.test.ts` asserting a digit that is legal but wrong against the real solution is **not** flagged (FR-029)
- [ ] T065 [P] [US3] Write `tests/unit/completion.test.ts` asserting completion requires all 81 filled **and** zero conflicts, and that a full board with a conflict is not complete
- [ ] T066 [P] [US3] Write `tests/component/CompletionBanner.test.tsx` asserting the banner is non-modal, shows final time, and never takes focus
- [ ] T067 [P] [US3] Write `tests/integration/conflicts.spec.ts` covering the US3 acceptance scenarios
- [ ] T068 [P] [US3] Write `tests/a11y/conflict-announce.spec.ts` asserting conflicts are announced politely without stealing focus (FR-026)

### Implementation for User Story 3

- [ ] T069 [P] [US3] Create `src/engine/conflicts.ts` with `findConflicts`, duplicate-constraint only
- [ ] T070 [US3] Add `conflictSet` and `isComplete` to `src/state/selectors.ts`, recomputed after every change
- [ ] T071 [US3] Add conflict wash, conflict ink, and a corner marker to `src/ui/Cell.tsx` (FR-025, FR-026)
- [ ] T072 [US3] Add a polite live-region announcement for conflicts in `src/ui/Board.tsx`
- [ ] T073 [P] [US3] Create `src/ui/CompletionBanner.tsx` as an inline, dismissible, non-modal banner
- [ ] T074 [US3] Transition `status` to `complete` in `src/state/actions.ts` when completion is detected, freezing the board (FR-039)
- [ ] T075 [US3] Reject cell mutations while `status` is `complete` in `src/state/actions.ts` with reason `wrong-status`

**Checkpoint**: Slice 3 complete — Slices 1–3 all work independently.

---

## Phase 6: User Story 4 — Think in Pencil (Priority: P4) — Slice 4

**Goal**: Pencil candidates with a mode toggle, and automatic peer-candidate cleanup on placement.

**Independent Test**: Toggle to pencil mode, add and remove candidates, place a digit, and verify peer
notes update — then verify one undo restores digit and candidates together.

### Tests for User Story 4 (write first, watch fail)

- [ ] T076 [P] [US4] Write `tests/unit/candidates.test.ts` asserting `legalCandidates` excludes every digit present among peers
- [ ] T077 [P] [US4] Write `tests/unit/actions.candidates.test.ts` asserting `toggleCandidate` adds then removes, is rejected on a cell holding a value, and is rejected on clues
- [ ] T078 [P] [US4] Write `tests/unit/actions.autoremove.test.ts` — **the critical test** — asserting a placement that clears six peer candidates produces **exactly one** `ChangeRecord` covering seven cells, and that one revert restores all seven (FR-024)
- [ ] T079 [P] [US4] Write `tests/component/ModeToggle.test.tsx` asserting the toggle, `Space`, and `N` all switch mode and the active mode is always visible
- [ ] T080 [P] [US4] Write `tests/integration/notes.spec.ts` covering the US4 acceptance scenarios

### Implementation for User Story 4

- [ ] T081 [P] [US4] Create `src/engine/candidates.ts` with `legalCandidates`
- [ ] T082 [US4] Implement `setInputMode` and `toggleInputMode` in `src/state/actions.ts`
- [ ] T083 [US4] Implement `toggleCandidate` in `src/state/actions.ts` recording one `ChangeRecord`
- [ ] T084 [US4] Extend `enterDigit` in `src/state/actions.ts` to clear the cell's own candidates and strip the digit from all 20 peers, **all within one `ChangeRecord`** (FR-017, FR-023, FR-024)
- [ ] T085 [P] [US4] Create `src/ui/ModeToggle.tsx` with a persistently visible active-mode indicator
- [ ] T086 [US4] Render candidates in fixed 3×3 positions within `src/ui/Cell.tsx` so a missing candidate reads as a gap (FR-022)
- [ ] T087 [US4] Bind `Space` and `N` to mode toggling in `src/ui/Board.tsx`, scoped to board focus only

**Checkpoint**: Slice 4 complete — Slices 1–4 all work independently.

---

## Phase 7: User Story 5 — Take Back and Take a Break (Priority: P5) — Slice 5

**Goal**: Full-depth undo, an elapsed timer, and a pause that obscures the board.

**Independent Test**: Make a series of changes, undo them all the way back to the starting position,
then pause and resume the timer.

### Tests for User Story 5 (write first, watch fail)

- [ ] T088 [P] [US5] Write `tests/unit/actions.undo.test.ts` asserting five changes then five undos restores the untouched board, that undo on empty history returns `ok: false` with `nothing-to-undo`, and that `newPuzzle` clears history so undo cannot cross the boundary (FR-033)
- [ ] T089 [P] [US5] Write `tests/unit/timer.test.ts` asserting `tick` accumulates only while `playing`, and is rejected while `paused` and `complete`
- [ ] T090 [P] [US5] Write `tests/component/Controls.test.tsx` asserting Undo renders visibly disabled when there is nothing to undo (FR-032)
- [ ] T091 [P] [US5] Write `tests/integration/undo-timer.spec.ts` covering the US5 acceptance scenarios
- [ ] T092 [P] [US5] Write `tests/a11y/reduced-motion.spec.ts` asserting the pause overlay appears without transition under `prefers-reduced-motion` (FR-049)

### Implementation for User Story 5

- [ ] T093 [US5] Implement `undo` in `src/state/actions.ts`, replaying the newest record's `before` and making no distinction by `origin`
- [ ] T094 [US5] Implement `pause`, `resume`, and `tick` in `src/state/actions.ts` with the status guards from [contracts/store-actions.md](./contracts/store-actions.md)
- [ ] T095 [P] [US5] Create `src/ui/Timer.tsx` displaying `MM:SS` and owning the interval that dispatches `tick`
- [ ] T096 [P] [US5] Create `src/ui/Controls.tsx` with Erase and Undo, using per-icon Lucide imports
- [ ] T097 [US5] Add the pause overlay to `src/ui/GameScreen.tsx` — player-dismissible, obscuring the board, honouring reduced motion
- [ ] T098 [US5] Stop the timer permanently on completion in `src/ui/Timer.tsx` (FR-036)
- [ ] T099 [US5] Wire the Erase control in `src/ui/Controls.tsx` to the existing `eraseCell` action

**Checkpoint**: Slice 5 complete — Slices 1–5 all work independently.

---

## Phase 8: User Story 6 — Pick Up Where You Left Off (Priority: P6) — Slice 6

**Goal**: The board, notes, difficulty, and elapsed time survive a reload, and storage failure degrades
gracefully.

**Independent Test**: Play partway through a puzzle, reload the page, and confirm the exact board state
returns.

### Tests for User Story 6 (write first, watch fail)

- [ ] T100 [P] [US6] Write `tests/unit/persistence.roundtrip.test.ts` asserting a session serialises and restores with identical cells, candidates, origins, difficulty, and elapsed time
- [ ] T101 [P] [US6] Write `tests/unit/persistence.resilience.test.ts` asserting an unknown `schemaVersion`, corrupt payload, and a throwing storage backend each yield a fresh puzzle with no thrown error (FR-042, FR-044)
- [ ] T102 [P] [US6] Write `tests/unit/persistence.quarantine.test.ts` asserting the persisted payload never contains a complete 81-digit solution grid
- [ ] T103 [P] [US6] Write `tests/integration/persistence.spec.ts` covering reload mid-game and the blocked-storage path

### Implementation for User Story 6

- [ ] T104 [P] [US6] Create `src/state/persistence.ts` with the `PersistedSession` v1 shape from [data-model.md](./data-model.md)
- [ ] T105 [US6] Implement `serialiseSession` in `src/state/persistence.ts`, excluding history, selection, input mode, derived sets, and the solution
- [ ] T106 [US6] Implement `restoreSession` in `src/state/persistence.ts` with version checking and safe discard on any failure
- [ ] T107 [US6] Subscribe persistence to the store with a ~250 ms debounce in `src/state/persistence.ts`
- [ ] T108 [US6] Load any saved session at startup in `src/ui/GameScreen.tsx`, falling back to a fresh puzzle
- [ ] T109 [US6] Add a one-time unobtrusive notice in `src/ui/GameScreen.tsx` when storage is unavailable (FR-042)
- [ ] T110 [US6] Guard every storage call in `src/state/persistence.ts` with try/catch so a failure never reaches a dispatch

**Checkpoint**: Slice 6 complete — all six user stories work independently.

---

## Phase 9: Polish & Cross-Cutting Concerns — Slice 7 (Audit)

**Purpose**: Confirm and measure what earlier slices already built. **If they did their job, this phase
finds nothing.** Accessibility was a gate on every prior phase, not deferred to here.

- [ ] T111 [P] Run the full axe sweep across every board state in `tests/a11y/full-sweep.spec.ts`
- [ ] T112 [P] Add `tests/a11y/keyboard-only.spec.ts` completing an entire puzzle without a pointing device (SC-005)
- [ ] T113 [P] Add `tests/integration/responsive.spec.ts` asserting no horizontal page scroll at a 360 px viewport (FR-050)
- [ ] T114 [P] Add `tests/perf/generation.spec.ts` asserting generation including uniqueness proof stays within 500 ms p95
- [ ] T115 [P] Add `tests/perf/interaction.spec.ts` asserting interaction to next paint stays within 100 ms and validation within 16 ms
- [ ] T116 [P] Add `tests/perf/tti.spec.ts` asserting time to interactive within 2 s on simulated 4G (SC-001)
- [ ] T117 [P] Add `tests/integration/offline.spec.ts` completing a full session with the network disconnected (SC-009)
- [ ] T118 [P] Add `tests/unit/no-statistics.test.ts` asserting no win rate, streak, or solve-history value is ever computed or stored (FR-051)
- [ ] T119 Verify no gameplay information is conveyed by colour alone across every state, with greyscale and colour-blind simulation (FR-048)
- [ ] T120 Verify import-direction lint passes and no module exceeds the review thresholds in Principle III
- [ ] T121 Confirm the informational bundle report is emitted and blocks nothing, per the deferral in [plan.md § Complexity Tracking](./plan.md)
- [ ] T122 Walk every slice demo script in [quickstart.md](./quickstart.md) end to end against `npx serve out`
- [ ] T123 [P] Write `README.md` documenting setup, the npm scripts, and the layer rules
- [ ] T124 Confirm the commit history shows failing tests preceding their implementations across all phases (Principle V)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies
- **Phase 2 (Foundational)**: depends on Phase 1 — **blocks every user story**
- **Phase 3–8 (User Stories)**: each depends only on Phase 2
- **Phase 9 (Polish)**: depends on all stories being complete

### User Story Dependencies

All six stories depend only on Phase 2 and are independently testable. Two soft couplings exist by
design and do **not** break independence:

- **US3 → US2**: conflicts add a wash tier to the composition US2 built. US3 works without US2; the
  conflict tier simply composes over ground instead of over a highlight.
- **US5 → US1/US4**: undo reverts records that US1 and US4 actions create. The undo *machinery* is
  Foundational (T019), so US5 adds only the control, timer, and pause.

### Within Each Story

Tests are written and seen to fail → engine modules → store actions → UI components → wiring.
Engine before state before UI, always, per the layer rule.

### Parallel Opportunities

- Phase 1: T004–T008 all parallel
- Phase 2: T011–T014 parallel; T016–T018 parallel; T022–T023 parallel
- Every phase's test block is fully parallel — different files, no shared state
- Engine modules within a story are parallel (T039–T041, T040–T041)
- With a team, US2 through US6 can proceed in parallel once Phase 2 lands

---

## Parallel Example: User Story 1

```bash
# Write all US1 tests together first, and watch them fail:
Task: "tests/unit/solver.test.ts"
Task: "tests/property/uniqueness.property.test.ts"
Task: "tests/unit/rating.test.ts"
Task: "tests/unit/generate.test.ts"
Task: "tests/unit/solution-quarantine.test.ts"
Task: "tests/unit/actions.entry.test.ts"
Task: "tests/unit/store.headless.test.ts"
Task: "tests/component/Keypad.test.tsx"
Task: "tests/integration/play.spec.ts"
Task: "tests/a11y/board.spec.ts"

# Then the independent engine modules together:
Task: "src/engine/solver.ts"
Task: "src/engine/techniques/nakedSingle.ts"
Task: "src/engine/techniques/hiddenSingle.ts"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 → Phase 2 → **Slice 0 review** (empty Japandi grid, static export proven)
2. Phase 3 → **Slice 1 review** — this is the MVP: a working Sudoku game
3. Stop and validate against the Slice 1 demo script before going further

### Incremental Delivery

Each phase from 2 onward ends in a deployable site. After every phase:

1. `npm test` green, with failing-test-first visible in history
2. `npm run build` then `npx serve out`
3. Walk that slice's demo script in [quickstart.md](./quickstart.md)
4. Confirm zero network requests after load
5. Only then start the next phase

---

## Notes

- `[P]` means different files with no incomplete dependencies
- Every phase from 2 onward is a reviewable website state — that is the point of the slicing
- Tests are mandatory and must fail before implementation; this is a constitutional gate, not a preference
- The palette lives only in `app/globals.css`; raw hex in a component is a lint failure
- The solution never leaves `src/engine/` — three separate tests assert this
- Commit after each task or logical group
