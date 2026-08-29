# Implementation Plan: Core Sudoku Play Experience

**Branch**: `main` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-sudoku-play-experience/spec.md`

## Summary

Build the human half of Agentic Sudoku: a static, offline, single-page Sudoku board with intelligent
highlighting, dual keypad/keyboard input with pencil mode, conflict feedback, undo, a pausable timer,
and on-device session restore — rendered in a verified Japandi palette.

The technical approach is shaped by three forces. The constitution mandates Next.js static export with
zero server runtime, so everything runs in the browser. Principle IV demands provably unique puzzles
inside a 500 ms budget, so generation, uniqueness verification, and technique-based difficulty rating
run in a Web Worker. And feature 002 — the WebMCP agent — requires game state to be reachable
*without a mounted DOM*, so state lives in a framework-agnostic store bound into React through
`useSyncExternalStore`, not in React context. That last decision is what makes the agent layer
addable later without reworking the board.

Delivery is **eight vertical slices**, each ending in a deployable website you can open and review.

## Technical Context

**Language/Version**: TypeScript 5.x in `strict` mode; React 19; Node 20+ for tooling only

**Primary Dependencies**: Next.js 16 (App Router, `output: 'export'`), React 19, Tailwind CSS v4,
Lucide React (per-icon imports), `sudoku-gen`

**Storage**: `localStorage`, versioned schema, tolerant of unavailability. No server, no database.

**Testing**: Vitest (Engine, State, palette), `fast-check` (property-based invariants), React Testing
Library (components), Playwright + `@axe-core/playwright` (end-to-end, accessibility, performance)

**Target Platform**: Evergreen browsers, desktop and touch, down to a 360 px viewport. Static hosting
over HTTPS.

**Project Type**: Client-only static web application

**Performance Goals**: Generation incl. uniqueness proof ≤ 500 ms p95 (off main thread); board
validation ≤ 16 ms; interaction to next paint ≤ 100 ms; sustained 60 fps during interaction

**Constraints**: TTI ≤ 2 s on simulated 4G; zero runtime network requests; no main-thread block
beyond one 16 ms frame; WCAG 2.1 AA. **The 250 KB gzipped first-load JS budget is deferred by author
decision** — see Complexity Tracking.

**Scale/Scope**: One route, one board, 81 cells, three difficulties, ~10 UI components, ~54 functional
requirements

## Constitution Check

*GATE: evaluated before Phase 0, re-evaluated after Phase 1 design. Both passes recorded.*

| Principle | Gate | Pre-Phase 0 | Post-Phase 1 |
|---|---|---|---|
| **I. WebMCP compliance** | No agent surface in this feature, but state must be reachable headlessly so 002 can register tools outside the component tree | PASS (n/a) | **PASS** — framework-agnostic store (R6) makes the whole game controllable with no DOM mounted |
| **II. Zero-backend** | No runtime network calls; local generation; browser-local persistence; deployable by file copy | PASS | **PASS** — `output: 'export'`, `sudoku-gen` bundled, `localStorage` only; CI serves `out/` from a plain file server |
| **III. Modularity** | Engine ← State ← View one-way; Engine DOM-free; single responsibility; no circular deps; techniques as individual modules | PASS | **PASS** — four-layer tree below; import-direction lint; one module per technique |
| **IV. Puzzle integrity & budgets** | Exactly one solution, proven; reproducible; technique-derived difficulty; sound hints; stated budgets | PASS | **PASS with one recorded deviation** — own counting solver gates every puzzle (R4); puzzle string recorded for reproducibility; worker keeps generation off the main thread (R5). The bundle-size budget is deferred; every timing budget still gates. See Complexity Tracking |
| **V. Test-first & non-blocking** | TDD before code; contract tests; property tests; non-blocking feedback; reduced motion; non-colour cues | PASS | **PASS** — test stack in R7; palette verified by computation, not judgement (R3); selection is a ring so every tier survives greyscale |

**Security posture**: no `eval`, no `innerHTML` with non-constant input, no remote script or style.
Nothing in this feature accepts external input; the untrusted-input rules bind at feature 002.

**Solution quarantine**: `sudoku-gen` returns the solution with the puzzle. It stays inside the Engine,
never enters store state, and never reaches persistence — asserted by test, per constitution.

**Result: PASS on both evaluations, with one deliberate deviation recorded below.** All integrity
rules and all timing budgets hold; only the bundle-size budget is deferred.

## Project Structure

### Documentation (this feature)

```text
specs/001-sudoku-play-experience/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── engine-api.md
│   ├── store-actions.md
│   └── interaction-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Created by /speckit-tasks, not by this command
```

### Source Code (repository root)

```text
app/                          # Next.js App Router — thin, routing and shell only
├── layout.tsx
├── page.tsx                  # Mounts <GameScreen />, the single route
└── globals.css               # Tailwind v4 @theme — the ONLY place palette values exist

src/
├── engine/                   # Layer 1 — pure, deterministic, no DOM, Node-runnable
│   ├── grid.ts               # 81-cell representation, peers, box math
│   ├── prng.ts               # the single seeded PRNG
│   ├── solver.ts             # counting solver, terminates at 2 solutions
│   ├── generate.ts           # sudoku-gen draw -> verify unique -> rate -> accept/redraw
│   ├── rating.ts             # difficulty from techniques required
│   ├── conflicts.ts          # duplicate detection within row/column/box
│   ├── candidates.ts         # legal-candidate computation
│   └── techniques/           # one module per technique, uniform interface
│       ├── index.ts
│       ├── nakedSingle.ts
│       └── hiddenSingle.ts
│
├── state/                    # Layer 2 — framework-agnostic single source of truth
│   ├── store.ts              # subscribe/notify, no React import
│   ├── actions.ts            # every mutation, named and explicit
│   ├── history.ts            # undo stack; one entry per player action
│   ├── persistence.ts        # versioned localStorage read/write/migrate
│   └── selectors.ts          # derived view data (highlight tiers, conflict set)
│
├── ui/                       # Layer 3 — React client components, render + dispatch only
│   ├── GameScreen.tsx
│   ├── Board.tsx
│   ├── Cell.tsx
│   ├── Keypad.tsx
│   ├── ModeToggle.tsx
│   ├── DifficultySelect.tsx
│   ├── Controls.tsx          # Erase, Undo
│   ├── Timer.tsx
│   ├── CompletionBanner.tsx
│   └── useStore.ts           # the single useSyncExternalStore binding
│
└── workers/
    └── generate.worker.ts    # generation + uniqueness + rating, off the main thread

tests/
├── unit/                     # Engine, State, palette contrast — no DOM
├── property/                 # fast-check invariants
├── component/                # React Testing Library
├── integration/              # Playwright end-to-end
├── a11y/                     # axe + keyboard + screen-reader semantics
└── perf/                     # budget enforcement, fails the build when breached
```

**Structure Decision**: Four layers with a one-way dependency rule — `engine ← state ← ui`, `workers`
depending only on `engine`. `app/` is deliberately near-empty: it holds the shell and the token block,
nothing else, so the App Router never becomes a place where logic hides. `src/tools/` is *not* created
here; it is where feature 002 will register WebMCP tools, importing `state/actions.ts` alongside `ui/`
rather than through it. Import direction is enforced by lint (`eslint-plugin-import` boundaries), not
by review, per Principle III.

## Vertical Slice Plan

Eight slices. **Each one ends in a website you can open, click, and judge.** No slice delivers only
infrastructure; every slice changes what a person sees. Each carries its own accessibility obligations
rather than deferring them, because the constitution treats accessibility as a gate.

| # | Slice | What you can do at the end | Spec coverage |
|---|---|---|---|
| **0** | **Foundation & aesthetic** | Open a deployed static page showing an empty 9×9 Japandi grid with correct shoji line weights. Verify the palette and the recorded bundle number. | FR-045, FR-052–054; budget baseline |
| **1** | **Playable board** | Select a difficulty, get a real puzzle, click or arrow to a cell, type digits, erase, and be blocked from editing clues. | US1 · FR-001–006, 012, 015, 018–021, 030 |
| **2** | **Intelligent highlighting** | Click any cell and see the crosshair; click a digit and see every match light up. | US2 · FR-007–011 |
| **3** | **Conflicts & completion** | Place a duplicate and watch both cells flag; finish a board and get the completion banner. | US3 · FR-025–029, 037–039 |
| **4** | **Pencil notes** | Toggle to notes, pencil candidates, place a digit, watch peer candidates clear themselves. | US4 · FR-013–014, 016–017, 022–024 |
| **5** | **Undo, timer, pause** | Step all the way back to a fresh board; pause the clock and see the board covered. | US5 · FR-031–036 |
| **6** | **Session continuity** | Refresh mid-puzzle and land exactly where you left off, including elapsed time. | US6 · FR-040–044 |
| **7** | **Audit & budgets** | Read a report proving contrast, keyboard, screen-reader, reduced-motion, and every performance budget. | FR-046–051; SC-001–011 |

**Review checkpoint on every slice**: the build produces a static export, `out/` is served from a plain
file server, the demo script in `quickstart.md` is walked end to end, and the slice's tests pass — with
the failing-test-first order visible in the commit history, per Principle V.

**Why this order**: it follows the spec's own P1–P6 priorities, which were written so each story ships
independently. Slice 0 exists because the bundle budget must be measured *before* feature code exists
to blame (R8), and because the palette is a build-time contract that everything else renders against.
Slice 7 is an audit, not a remediation phase — if earlier slices did their job it finds nothing.

## Complexity Tracking

### Recorded deviation

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Principle IV — the 250 KB gzipped first-load JS budget is not enforced.** Deferred by author decision on 2026-08-29, scoped to bundle size only. | The mandated stack (Next.js 16 + React 19) consumes roughly 100–130 KB of that ceiling before any feature code exists. Gating on it now would force premature optimisation decisions — dropping Lucide, hand-rolling components — before there is any evidence the budget is actually at risk. The author chose to build first and measure later. | Amending the constitution to raise or remove the budget was rejected because the deferral is explicitly temporary ("for now"). Recording it as a deviation keeps the rule intact and the exception visible, which is what the governance mechanism exists for. Silently omitting it was rejected outright — undocumented deviations block merge. |

**Scope of the deferral**: bundle size only. Every other Principle IV budget continues to gate the
build — generation ≤ 500 ms, validation ≤ 16 ms, interaction to paint ≤ 100 ms, and TTI ≤ 2 s on
simulated 4G, which also carries spec criterion SC-001.

**Still measured, never blocking**: CI reports the gzipped first-load number as informational output so
the trend is visible when the budget is reinstated. It fails nothing.

**To reinstate**: re-enable the bundle assertion in `npm run test:perf` and delete this entry. Per
governance, the budget must be re-validated whenever a runtime dependency is added or the build target
changes — so this deferral should be revisited at the first such change rather than left indefinitely.

### Deliberate design choices

Two decisions that *look* like added complexity are recorded here as deliberate and cheaper than the
alternative:

| Decision | Why it is not gold-plating |
|---|---|
| Hand-built framework-agnostic store instead of React context | Context is unreachable without a mounted DOM, which Principle I forbids for the agent surface. Context now means a rewrite at feature 002. ~150 lines, zero dependencies. |
| Web Worker for generation | Principle IV forbids blocking the main thread beyond 16 ms, and generate-verify-rate can run into the hundreds. The worker is the compliant option, not the fancy one. |
