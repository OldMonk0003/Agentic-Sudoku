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

- [X] T001 Initialize Node project and commit `package.json` at repository root
- [X] T002 Install runtime dependencies: `next@16`, `react@19`, `react-dom@19`, `sudoku-gen`, `lucide-react`
- [X] T003 Install dev dependencies: `typescript`, `vitest`, `fast-check`, `@testing-library/react`, `@playwright/test`, `@axe-core/playwright`, `eslint`, `eslint-plugin-import`, `tailwindcss@4`, `@tailwindcss/postcss`
- [X] T004 [P] Create `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`, and path alias `@/*` → `src/*`
- [X] T005 [P] Create `next.config.ts` with `output: 'export'` and `images.unoptimized: true`
- [X] T006 [P] Create `postcss.config.mjs` registering `@tailwindcss/postcss`
- [X] T007 [P] Create `vitest.config.ts` with a `node` environment for `tests/unit` and `tests/property`, and `jsdom` for `tests/component`
- [X] T008 [P] Create `playwright.config.ts` pointing at the static `out/` directory served by a plain file server
- [X] T009 Create `eslint.config.mjs` with an `import/no-restricted-paths` rule enforcing `engine ← state ← ui` and banning deep imports past module entry points
- [X] T010 Add npm scripts to `package.json`: `dev`, `build`, `test`, `test:perf`, `test:a11y`, `lint`

---

## Phase 2: Foundational (Blocking Prerequisites) — Slice 0

**Purpose**: The palette contract, grid primitives, and store skeleton every story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

**Slice 0 demo**: an empty 9×9 Japandi grid with shoji line weights, served from `out/` as static files.

### Tests for Phase 2 (write first, watch fail)

- [X] T011 [P] Write `tests/unit/palette.contrast.test.ts` asserting every ratio in [research.md § R3](./research.md): clue/player/conflict/note ink ≥ 4.5:1 on ground, crosshair, matching, and conflict washes; selection ring ≥ 3.0:1; box lines ≥ 3.0:1; clue-vs-player ink ≥ 1.5:1 in greyscale
- [X] T012 [P] Write `tests/unit/grid.test.ts` covering index↔coordinate round-trips, box computation, and that `peersOf` returns exactly 20 cells for every index
- [X] T013 [P] Write `tests/unit/store.skeleton.test.ts` asserting `getState`/`subscribe`/`dispatch` exist, subscribe returns a working unsubscribe, and an unknown action returns `ok: false` without throwing
- [X] T014 [P] Write `tests/integration/static-export.spec.ts` asserting the built site loads and renders the grid when served from a plain file server with no Next.js runtime

### Implementation for Phase 2

- [X] T015 Create `app/globals.css` with the Tailwind v4 `@theme` block declaring all 13 palette tokens from [research.md § R3](./research.md) — the only place palette values may exist
- [X] T016 [P] Create `src/engine/grid.ts` with `Digit`, `CellIndex`, `Coord`, index↔coordinate helpers, `boxOf`, and a memoised `peersOf`
- [X] T017 [P] Create `src/engine/prng.ts` exporting `createPrng(seed)` — the single source of first-party randomness
- [X] T018 [P] Create `src/state/types.ts` with `Cell`, `CellOrigin`, `GameSession`, `SessionStatus`, and `ChangeRecord` per [data-model.md](./data-model.md)
- [X] T019 Create `src/state/history.ts` with `pushRecord`, `revertRecord`, and `canUndo` — the undo machinery the Undo *control* will use in US5
- [X] T020 Create `src/state/store.ts` with `getState`, `subscribe`, `dispatch`, and the `DispatchResult`/`RejectionReason` types from [contracts/store-actions.md](./contracts/store-actions.md); no React import
- [X] T021 Create `src/ui/useStore.ts` binding the store to React through `useSyncExternalStore`
- [X] T022 [P] Create `app/layout.tsx` importing `globals.css` and setting page metadata and language
- [X] T023 [P] Create `src/ui/Cell.tsx` rendering one static cell with token-derived classes and no interactivity yet
- [X] T024 Create `src/ui/Board.tsx` rendering the 9×9 grid with hairline cell separators and heavier 3×3 box framing (FR-053)
- [X] T025 Create `src/ui/GameScreen.tsx` composing the board shell
- [X] T026 Create `app/page.tsx` mounting `<GameScreen />` as the single route
- [X] T027 Add `npm run test:perf` harness in `tests/perf/budgets.spec.ts` enforcing the timing budgets, and **reporting first-load gzipped JS as informational output only** (bundle budget deferred — see [plan.md § Complexity Tracking](./plan.md))
- [X] T028 Verify `npm run build` emits `out/` and `npx serve out` renders the grid with zero network requests after load

**Checkpoint**: ✅ **Slice 0 COMPLETE** (2026-08-29). Build green, static export verified from a plain
file server, 40 unit tests and 10 browser tests passing, lint clean, typecheck clean.

Notes from implementation:

- **A regression was caught visually that the tests missed.** The first build had all 81 cells in the
  DOM and every test passing, but rendered an *invisible* grid: `border-hairline` is not a Tailwind v4
  width utility (`--spacing-*` does not generate border widths) and preflight sets `border-width: 0`.
  Counting elements proved nothing. Three tests were added asserting computed border widths are
  non-zero and that box seams measure heavier than hairlines (FR-053).
- **Two type-scale tokens were added** (`--text-cell`, `--text-candidate`) because the palette lint rule
  correctly rejected an arbitrary-value `text-[clamp(...)]` in a component. Components stay token-only.
- **`@vitest/coverage-v8` was dropped and `.npmrc` sets `legacy-peer-deps`.** npm's arborist crashes
  walking vitest's optional peer graph (`@vitest/browser` → `webdriverio`), which this project does not
  use. No task required coverage reporting.
- **Informational bundle reading: 167 KB gzipped first-load JS** (553 KB raw). Comfortably under the
  deferred 250 KB budget even with the framework baseline.

---

## Phase 3: User Story 1 — Sit Down and Solve (Priority: P1) 🎯 MVP — Slice 1

**Goal**: A real, uniquely-solvable puzzle on screen that accepts digits by mouse and keyboard,
protects clues, and regenerates on difficulty change.

**Independent Test**: Open the site cold, place digits into every empty cell of an Easy puzzle using
mouse and keypad, and reach a completed grid — with no highlighting, notes, timer, or persistence.

### Tests for User Story 1 (write first, watch fail)

- [X] T029 [P] [US1] Write `tests/unit/solver.test.ts` asserting `countSolutions` returns 0, 1, and 2 correctly and never exceeds its cap
- [X] T030 [P] [US1] Write `tests/property/uniqueness.property.test.ts` using fast-check over ≥10,000 generated puzzles asserting exactly one solution (SC-003)
- [X] T031 [P] [US1] Write `tests/unit/rating.test.ts` asserting difficulty derives from techniques required and never from clue count
- [X] T032 [P] [US1] Write `tests/unit/generate.test.ts` asserting a puzzle whose uniqueness check fails is discarded and redrawn, and that `puzzleString` round-trips to the same clues
- [X] T033 [P] [US1] Write `tests/unit/solution-quarantine.test.ts` asserting no value returned by `generatePuzzle` and no serialised store state contains a complete 81-digit grid
- [X] T034 [P] [US1] Write `tests/unit/actions.entry.test.ts` covering `selectCell`, `moveSelection` (no wrap at edges), `enterDigit`, and `eraseCell`, including that every clue-targeting action returns `ok: false` with reason `cell-is-clue` and changes nothing
- [X] T035 [P] [US1] Write `tests/unit/store.headless.test.ts` driving a full puzzle to completion through `dispatch` alone with **no DOM mounted** (Principle I prerequisite for feature 002)
- [X] T036 [P] [US1] Write `tests/component/Keypad.test.tsx` asserting keypad and keyboard dispatch identical actions (FR-020)
- [X] T037 [P] [US1] Write `tests/integration/play.spec.ts` covering the US1 acceptance scenarios end to end
- [X] T038 [P] [US1] Write `tests/a11y/board.spec.ts` asserting axe passes, the board exposes grid semantics, and selection moves programmatic focus

### Implementation for User Story 1

- [X] T039 [P] [US1] Create `src/engine/solver.ts` with `countSolutions(clues, cap = 2)` and `solve`
- [X] T040 [P] [US1] Create `src/engine/techniques/nakedSingle.ts` implementing the `Technique` interface from [contracts/engine-api.md](./contracts/engine-api.md)
- [X] T041 [P] [US1] Create `src/engine/techniques/hiddenSingle.ts` implementing the same interface
- [X] T042 [US1] Create `src/engine/techniques/index.ts` registering techniques in band order (no switch statement)
- [X] T043 [US1] Create `src/engine/rating.ts` with `rateDifficulty` solving via technique modules only
- [X] T044 [US1] Create `src/engine/generate.ts` with `generatePuzzle`: draw from `sudoku-gen`, verify uniqueness, re-rate by technique, redraw on mismatch, and never return the solution
- [X] T045 [US1] Create `src/workers/generate.worker.ts` running generation off the main thread, with a main-thread time-sliced fallback when Workers are unavailable
- [X] T046 [US1] Implement `newPuzzle` and `selectCell` in `src/state/actions.ts`
- [X] T047 [US1] Implement `moveSelection` in `src/state/actions.ts` with edge clamping (FR-019)
- [X] T048 [US1] Implement `enterDigit` and `eraseCell` in `src/state/actions.ts`, each recording exactly one `ChangeRecord` and rejecting clue cells
- [X] T049 [US1] Extend `src/ui/Cell.tsx` with click selection and clue-versus-player ink styling (FR-005)
- [X] T050 [P] [US1] Create `src/ui/Keypad.tsx` with digits 1–9 and touch targets ≥ 44 px
- [X] T051 [P] [US1] Create `src/ui/DifficultySelect.tsx` dispatching `newPuzzle` on change
- [X] T052 [US1] Add board keyboard handling in `src/ui/Board.tsx` for digits, `Backspace`/`Delete`, arrows and `WASD`, scoped so shortcuts do not fire while a control holds focus; render a skeleton board during `generating` and a brief non-blocking indication on clue rejection (FR-021)

**Checkpoint**: ✅ **Slice 1 COMPLETE** (2026-08-29) — the MVP. 90 unit tests and 22 browser tests
green, lint and typecheck clean, static export verified. A real puzzle generates on load; mouse and
keyboard entry, clue protection, erase, and difficulty switching all work.

Notes from implementation — three findings worth carrying forward:

1. **The task breakdown under-specified the technique set.** T040/T041 scoped only naked and hidden
   singles, both band `easy`, so `rateDifficulty` could only ever return `easy` — medium and hard were
   unreachable and generation for those difficulties failed outright. Three technique-derived bands
   require techniques in three bands. Added `lockedCandidates` and `nakedPair` (medium) and `xWing`
   (hard), and extended the technique interface to express ELIMINATION findings, not just placements.
2. **Rating is now tiered, and deliberately so.** sudoku-gen essentially never emits X-Wing puzzles, so
   defining `hard` as "requires x-wing" left the band unreachable. `hard` now means *demonstrably needs
   more than the medium set* — proven by running that set to exhaustion and watching it stall. That is
   a statement about techniques required (a lower bound), which is what Principle IV asks for, and it
   deliberately declines to name a technique we did not derive.
3. **The Web Worker was justified by measurement, not assumption.** Generation costs: easy p95 0.8ms,
   medium p95 9.3ms, hard p95 19.5ms with a 29.2ms max. Hard exceeds the 16ms frame budget, so
   Principle IV's off-main-thread rule genuinely binds. All generation runs in the worker, with a
   synchronous fallback where Workers are unavailable.

Bugs caught and fixed during the slice:

- **Layer violation caught by our own lint**: the Engine was importing `Difficulty` and `Puzzle` from
  `@/state/types` — backwards. They are Engine-produced types; they now live in `src/engine/types.ts`
  and State re-exports them.
- **Critical ARIA bug**: `role="grid"` requires `role="row"` children. axe flagged it. Rows are now
  real elements with `display: contents`, so the CSS grid layout is untouched.
- **Two test bugs, not app bugs**: a `[data-origin="empty"].first()` locator re-resolves to a
  *different* cell once a digit lands; and every cell reads `empty` while status is `generating`, so
  tests that touch the board before generation finishes can latch onto a cell that becomes a clue.
  Both were invisible single-threaded and failed under parallel load. Specs now gate on
  `aria-busy="false"` plus a visible clue.

Modules added beyond the task list, each needed by a listed task:
`src/engine/puzzleString.ts` (the reproducibility record), `src/engine/types.ts` (layer fix),
`src/engine/candidates.ts` (**completes T081 early** — rating cannot run without it),
`src/engine/techniques/{lockedCandidates,nakedPair,xWing}.ts`, `src/ui/puzzleLoader.ts` (worker
client), and `tests/unit/solver.crosscheck.test.ts` (validates our solver against 200 of the
generator's own solutions, and measures the per-puzzle cost that drove the worker decision).

---

## Phase 4: User Story 2 — See the Board at a Glance (Priority: P2) — Slice 2

**Goal**: Crosshair and matching-digit highlighting that reduces scanning effort and changes nothing.

**Independent Test**: With a static pre-filled board, click cells and confirm correct tinting appears
and clears, and that no game state changes as a result.

### Tests for User Story 2 (write first, watch fail)

- [X] T053 [P] [US2] Write `tests/unit/selectors.highlight.test.ts` asserting `crosshairSet` covers row, column, and box, `matchingSet` covers equal values including clues, and both are empty-safe when the selected cell is empty (FR-011)
- [X] T054 [P] [US2] Write `tests/unit/selectors.purity.test.ts` asserting selecting a cell leaves values, candidates, elapsed time, and history untouched (FR-010)
- [X] T055 [P] [US2] Write `tests/component/Cell.tiers.test.tsx` asserting tier precedence resolves to the correct class per [data-model.md](./data-model.md)
- [X] T056 [P] [US2] Write `tests/a11y/greyscale.spec.ts` asserting crosshair, matching, and selected states remain distinguishable with colour removed (SC-010)

### Implementation for User Story 2

- [X] T057 [P] [US2] Create `src/state/selectors.ts` with `crosshairSet` and `matchingSet`, computed not stored
- [X] T058 [US2] Add crosshair and matching wash classes to `src/ui/Cell.tsx` using palette tokens only
- [X] T059 [US2] Implement the 2px selection **ring** in `src/ui/Cell.tsx` — a ring, not a fill, per [research.md § R3](./research.md); this is what keeps every tier legible
- [X] T060 [US2] Implement tier precedence composition (conflict > matching > crosshair, ring over any) in `src/ui/Cell.tsx`
- [X] T061 [US2] Render matching-digit cells at medium type weight as the non-colour cue (FR-009)
- [X] T062 [US2] Wire highlight selectors into `src/ui/Board.tsx` via `useStore.ts`

**Checkpoint**: ✅ **Slice 2 COMPLETE** (2026-08-29). 111 unit tests and 26 browser tests green, lint
and typecheck clean. Selecting a cell tints its row, column and box; selecting a digit lights every
other instance of it, bolder; the selected cell carries the ring over whichever wash applies.

Notes from implementation:

- **The ring design paid off exactly as research.md R3 predicted.** `washClass` resolves what a
  selected cell *would* have shown and renders that, with the ring composed on top — so the selection
  never introduces a fourth, darker fill for text to fight. Verified in the browser with crosshair and
  matching tiers on screen simultaneously.
- **`boardTiers` computes all 81 tiers in one pass.** The per-cell `highlightTier` recomputes both sets
  on every call, which is fine for a single lookup and wasteful for a full board. Both are exported;
  the Board uses the batch form.
- **`conflictSet` already has its slot.** `highlightTier` and `boardTiers` take conflicts as an
  optional argument defaulting to empty, so User Story 3 plugs in without touching any caller.
- **Unhighlighted cells now paint `bg-ground` explicitly.** They previously inherited from the board,
  so their computed background was transparent and read as luminance 0 — which failed the greyscale
  ladder test against a board that actually rendered correctly. The test now throws on a transparent
  background rather than silently measuring zero.
- **One test assumption was wrong, not the code**: a precedence test assumed cell (1,1) was empty. On
  the puzzle it drew, (1,1) held a digit that (9,9) matched, so `matching` was the correct answer. The
  test now selects a known-empty cell and picks a cell outside its crosshair.

**A real bug surfaced as a flaky test.** The property suite failed roughly 1 run in 8, on
`["hard", <seed>]`. It was not a flaky test — `generatePuzzle` was genuinely returning `ok: false`
for hard puzzles. Measured per-draw hit rates for our hard band (n=400 each): sudoku-gen `hard`
**0.125**, `expert` **0.372**. Drawing 50/50 gave ~0.25 per attempt, so a 25-attempt budget exhausted
about 1 generation in 1350 — rare enough to look like test noise, frequent enough to strand a real
player on a blank board. Two fixes: the hard band now draws from `expert` only and the attempt cap
rose to 60 (~1e-13 exhaustion rate), and `puzzleLoader` retries with a fresh seed on exhaustion rather
than leaving the board empty forever. A regression test generates 120 hard puzzles across fixed seeds.

**A second flaky test WAS a bad assumption**: `matchingSet` asserted the first clue's digit appears
more than once, which is puzzle-dependent. It now picks the most frequent digit on the board.

Stability verified over 25 consecutive full runs, zero failures.

Informational bundle reading: 187.8 KB gzipped (up from 167 KB at Slice 0).

---

## Phase 5: User Story 3 — Catch Mistakes Early (Priority: P3) — Slice 3

**Goal**: Duplicate digits flagged in clay with a non-colour cue, plus completion detection.

**Independent Test**: On a pre-filled board, place known duplicates in a row, a column, and a box;
confirm each is flagged and clears when resolved. Then finish a board and see the completion banner.

### Tests for User Story 3 (write first, watch fail)

- [X] T063 [P] [US3] Write `tests/unit/conflicts.test.ts` covering duplicates in row, column, and box, that all participants are returned, and that a clue participating in a conflict is included
- [X] T064 [P] [US3] Write `tests/unit/conflicts.no-solution-peek.test.ts` asserting a digit that is legal but wrong against the real solution is **not** flagged (FR-029)
- [X] T065 [P] [US3] Write `tests/unit/completion.test.ts` asserting completion requires all 81 filled **and** zero conflicts, and that a full board with a conflict is not complete
- [X] T066 [P] [US3] Write `tests/component/CompletionBanner.test.tsx` asserting the banner is non-modal, shows final time, and never takes focus
- [X] T067 [P] [US3] Write `tests/integration/conflicts.spec.ts` covering the US3 acceptance scenarios
- [X] T068 [P] [US3] Write `tests/a11y/conflict-announce.spec.ts` asserting conflicts are announced politely without stealing focus (FR-026)

### Implementation for User Story 3

- [X] T069 [P] [US3] Create `src/engine/conflicts.ts` with `findConflicts`, duplicate-constraint only
- [X] T070 [US3] Add `conflictSet` and `isComplete` to `src/state/selectors.ts`, recomputed after every change
- [X] T071 [US3] Add conflict wash, conflict ink, and a corner marker to `src/ui/Cell.tsx` (FR-025, FR-026)
- [X] T072 [US3] Add a polite live-region announcement for conflicts in `src/ui/Board.tsx`
- [X] T073 [P] [US3] Create `src/ui/CompletionBanner.tsx` as an inline, dismissible, non-modal banner
- [X] T074 [US3] Transition `status` to `complete` in `src/state/actions.ts` when completion is detected, freezing the board (FR-039)
- [X] T075 [US3] Reject cell mutations while `status` is `complete` in `src/state/actions.ts` with reason `wrong-status`

**Checkpoint**: ✅ **Slice 3 COMPLETE** (2026-08-29). 142 unit tests and 35 browser tests green, lint
and typecheck clean, verified live in the browser.

Verified in the running app with a deliberate row conflict:

| Check | Result |
|---|---|
| Both participants flagged | 2 cells, clue included |
| Accessible labels | `"Row 2, column 1, 7, given, conflict"` — names it in place |
| Non-colour cue | 6px corner wedge, rendered |
| Ink / wash | `#8A3B29` on `#E6C9BD` — the exact palette tokens |
| Live region | `"2 cells in conflict"`, polite |
| Focus | stayed on the player's cell, never stolen |
| Contrast on the conflict wash | ≥ 4.5:1, asserted in browser |

Notes from implementation:

- **`conflictSet` slotted in without touching a single caller**, exactly as Slice 2 set up. The optional
  `conflicts` argument on `highlightTier`/`boardTiers` was already there and already defaulted to empty.
- **T075 needed no work** — `guardCellEdit` already rejected any edit outside `status === 'playing'`,
  so a completed board was frozen the moment the status transition landed.
- **Completion is detected in `withRecord`, not in the UI.** That means it holds for every actor: the
  agent filling the last cell in feature 002 completes the puzzle exactly as a human does (FR-037).
- **A selected cell that is also in conflict keeps the conflict wash**, not the crosshair. Losing it
  would hide the more important signal behind the less important one.
- **The completion banner is deliberately not a dialog.** FR-038 requires non-blocking, and Principle V
  is explicit that a dismiss-required modal is the blocking feedback the constitution bans. It is an
  inline `role="status"` banner that never takes focus.
- Five spec files had inline `import('@playwright/test').Page` annotations, which the
  `consistent-type-imports` rule flagged. Converted to real type imports.

Informational bundle reading: 188.4 KB gzipped.

---

## Phase 6: User Story 4 — Think in Pencil (Priority: P4) — Slice 4

**Goal**: Pencil candidates with a mode toggle, and automatic peer-candidate cleanup on placement.

**Independent Test**: Toggle to pencil mode, add and remove candidates, place a digit, and verify peer
notes update — then verify one undo restores digit and candidates together.

### Tests for User Story 4 (write first, watch fail)

- [X] T076 [P] [US4] Write `tests/unit/candidates.test.ts` asserting `legalCandidates` excludes every digit present among peers
- [X] T077 [P] [US4] Write `tests/unit/actions.candidates.test.ts` asserting `toggleCandidate` adds then removes, is rejected on a cell holding a value, and is rejected on clues
- [X] T078 [P] [US4] Write `tests/unit/actions.autoremove.test.ts` — **the critical test** — asserting a placement that clears six peer candidates produces **exactly one** `ChangeRecord` covering seven cells, and that one revert restores all seven (FR-024)
- [X] T079 [P] [US4] Write `tests/component/ModeToggle.test.tsx` asserting the toggle, `Space`, and `N` all switch mode and the active mode is always visible
- [X] T080 [P] [US4] Write `tests/integration/notes.spec.ts` covering the US4 acceptance scenarios

### Implementation for User Story 4

- [X] T081 [P] [US4] Create `src/engine/candidates.ts` with `legalCandidates` *(done early in Slice 1 — rating depends on it)*
- [X] T082 [US4] Implement `setInputMode` and `toggleInputMode` in `src/state/actions.ts`
- [X] T083 [US4] Implement `toggleCandidate` in `src/state/actions.ts` recording one `ChangeRecord`
- [X] T084 [US4] Extend `enterDigit` in `src/state/actions.ts` to clear the cell's own candidates and strip the digit from all 20 peers, **all within one `ChangeRecord`** (FR-017, FR-023, FR-024)
- [X] T085 [P] [US4] Create `src/ui/ModeToggle.tsx` with a persistently visible active-mode indicator
- [X] T086 [US4] Render candidates in fixed 3×3 positions within `src/ui/Cell.tsx` so a missing candidate reads as a gap (FR-022)
- [X] T087 [US4] Bind `Space` and `N` to mode toggling in `src/ui/Board.tsx`, scoped to board focus only

**Checkpoint**: ✅ **SLICE 4 COMPLETE** (2026-08-29). 178 unit tests and 42 browser tests green, lint
and typecheck clean, verified live in the browser.

**T078 — the task flagged at planning as most likely to be got wrong — passes.** A placement that
clears six peer candidates produces **exactly one** `ChangeRecord` covering seven cells, and one
revert restores all seven together. Seven separate assertions guard it, including that peers which
never held the digit are *not* in the record, and that a placement with nothing to strip still
records exactly one step.

Verified live: pencilled 1/5/9 into one cell and 2/4/8 into another, both rendering in fixed 3×3
positions with visible gaps (FR-022), then committed a digit and watched the matching candidate
vanish from its peers.

Notes from implementation:

- **A real UX bug, not a test bug.** Clicking the Pencil toggle left focus on the button, so the
  player's next keystroke went nowhere — and *toggle then type* is the primary flow. `ModeToggle` now
  returns focus to the selected cell. The refocus is **synchronous, not deferred**: an initial
  `requestAnimationFrame` version let a fast keystroke land before focus moved, which Playwright
  caught immediately.
- **T082 and T084 needed no work** — `setInputMode`/`toggleInputMode` and `enterDigit`'s peer-stripping
  were both already implemented in Slice 1, and T081 (`candidates.ts`) was done early because rating
  depends on it. Only `toggleCandidate` was genuinely new.
- **The keypad respects the active mode too**, routing through the same branch as the keyboard, so
  FR-020's "identical results" still holds now that a digit means two different things.
- **A synthetic-JS check misled me briefly**: driving clicks through `dispatchEvent` in one tick meant
  React batched the updates and the handler never saw the mode change. The app was fine; the harness
  was wrong. Real events via the browser tool confirmed correct behaviour.

Informational bundle reading: 190.6 KB gzipped.

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
