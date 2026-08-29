# Phase 0 Research: Core Sudoku Play Experience

**Feature**: `001-sudoku-play-experience` | **Date**: 2026-08-29

All Technical Context unknowns are resolved below. No `NEEDS CLARIFICATION` remains.

---

## R1. Framework and build target

**Decision**: Next.js 16 (App Router) with React 19, configured `output: 'export'`. One route (`/`).
All interactive components are client components. `images.unoptimized: true`. No Route Handlers, no
middleware, no Server Actions.

**Rationale**: Mandated by constitution v1.2.0. Static export produces a plain HTML/JS/CSS bundle
deployable by file copy, satisfying Principle II. Server Components still run — but only at build
time — so the App Router contributes routing and build output without any server runtime.

**Enforcement**: `output: 'export'` makes server-only features a *build error* rather than a silent
runtime dependency, which is what the constitution demands ("unavailable by configuration"). CI runs
the export and then serves `out/` from a plain static file server to prove the claim.

**Alternatives considered**: Vite + React (lighter baseline, ~40 KB less) — rejected, constitution
mandates Next.js. Pages Router — rejected, constitution specifies App Router.

---

## R2. Styling and the Japandi token layer

**Decision**: Tailwind CSS v4 with CSS-first `@theme` configuration in `app/globals.css`. The entire
palette is declared once as `@theme` tokens. Components use only token-derived utilities; raw hex and
arbitrary-value utilities (`bg-[#F6F2EA]`) are banned and caught by lint.

**Rationale**: Constitution requires the palette to have "exactly one place it can be audited for
contrast". Tailwind v4's `@theme` block is that place, and it exposes the same tokens as CSS
variables for the few places custom CSS is needed (grid line weights, the selection ring).

**Note**: Next.js still needs a thin `postcss.config.mjs` with `@tailwindcss/postcss`; the zero-config
story applies to Vite only.

**Alternatives considered**: CSS Modules with hand-rolled variables — rejected, constitution mandates
Tailwind. Tailwind v3 with `tailwind.config.js` — rejected, v4 is current and the CSS-first token
block is a materially better audit surface.

---

## R3. The Japandi palette, verified rather than eyeballed

This was the risk flagged when the aesthetic was adopted. Contrast was **computed**, not judged.

**First attempt failed.** A conventional four-tier wash (ground → crosshair → matching → selected,
each a progressively deeper sand) put text on a surface too dark to support it:

| Failure | Measured | Required |
|---|---|---|
| Pencil notes on `selected` | 2.97:1 | 4.5:1 |
| Pencil notes on `matching` | 3.81:1 | 4.5:1 |
| Player ink vs agent ink (greyscale) | 1.14:1 | perceptible separation |
| Box grid lines on ground | 2.81:1 | 3.0:1 |

**Two design changes fixed it:**

1. **The selected cell is a ring, not a fill.** Removing the fourth (darkest) wash from under text
   frees the entire luminance budget. A 2px charcoal ring is also the strongest possible greyscale and
   colour-blind cue, and it satisfies FR-009's demand that tiers separate by something other than hue —
   here, border weight. Selection reads at 9.61:1 against the deepest wash it can sit on.
2. **Two inks, not three.** Solving analytically: with three inks all required to clear 4.5:1 on the
   deepest wash, every ink is squeezed into the luminance band `L ≤ 0.093`, leaving room for roughly
   2.86:1 of total spread — just barely enough for two 1.5:1 gaps, with no margin for any future tweak.
   A three-ink scheme is technically feasible and practically fragile. Agent-placed digits (feature 002)
   therefore share the player ink and are distinguished by **italic plus a sage corner mark** — which is
   greyscale-safe, colour-blind-safe, and strictly better than a third hue.

**Final palette** (all values verified, see the table below):

| Token | Value | Role |
|---|---|---|
| `--color-ground` | `#F6F2EA` | Board and page paper |
| `--color-surface` | `#FCFAF6` | Raised panels, keypad |
| `--color-wash-crosshair` | `#EAE2D2` | Row/column/box tint |
| `--color-wash-matching` | `#D9C9AC` | Same-digit tint |
| `--color-wash-conflict` | `#E6C9BD` | Clay conflict wash |
| `--color-ring-selected` | `#26231F` | 2px selection ring |
| `--color-ink-clue` | `#26231F` | Starting clues |
| `--color-ink-player` | `#2F4E63` | Player entries (and agent entries) |
| `--color-ink-note` | `#544E44` | Pencil candidates |
| `--color-ink-conflict` | `#8A3B29` | Conflicting digit |
| `--color-line-hairline` | `#DCD3C3` | Cell separators |
| `--color-line-box` | `#8B8175` | 3x3 box framing |
| `--color-mark-agent` | `#5E7A63` | Agent corner mark (feature 002) |

**Verified contrast:**

| Check | Worst case | Threshold | Result |
|---|---|---|---|
| Clue ink on any wash | 9.61:1 | 4.5 | pass |
| Player ink on any wash | 5.40:1 | 4.5 | pass |
| Conflict ink on any wash | 4.71:1 | 4.5 | pass |
| Pencil notes on any wash | 5.06:1 | 4.5 | pass |
| Selection ring on any wash | 9.61:1 | 3.0 (1.4.11) | pass |
| Box lines on ground | 3.42:1 | 3.0 (1.4.11) | pass |
| Clue vs player ink, greyscale | 1.78:1 | perceptible | pass |
| Tier span ground → matching | 1.46:1 | perceptible | pass |

Hairlines at 1.33:1 are deliberately below 3.0: they subdivide cells decoratively and carry no
information, so WCAG 1.4.11 does not apply. The **box** lines carry the 3x3 structure and do clear 3.0.

**Standing obligation**: these ratios are a build-time test (`tests/unit/palette.contrast.test.ts`),
not a one-off calculation. Changing any token fails the suite.

---

## R4. Puzzle generation, uniqueness, and difficulty

**Decision**: `sudoku-gen` supplies candidate puzzles. The Engine then (a) verifies uniqueness with its
own counting solver, and (b) rates difficulty by which techniques the puzzle actually requires,
rejecting and re-drawing until the rating matches the requested band.

**Rationale**: Two constitutional obligations force this.

- Principle IV requires independent uniqueness verification — the library claims none. (Its
  transformations are isomorphisms that preserve solution count, so derived puzzles are unique *if* the
  bundled seeds are; that is an inference about an unverified seed set, and inference is not evidence.)
- Principle IV also requires difficulty derived from techniques required, not clue count. `sudoku-gen`
  labels puzzles `easy | medium | hard | expert` by its own undocumented measure, so its label is
  treated as a *hint for which band to draw from*, never as the rating we present.

**Reproducibility**: `getSudoku(difficulty?)` takes no seed. Per the constitution's widened Principle IV
rule, the returned 81-character puzzle string is itself recorded with the session, which reproduces any
board exactly.

**Solution quarantine**: `getSudoku` returns the solution alongside the puzzle. The solution never
leaves the Engine, never enters the store's readable state, and is never persisted in readable form —
enforced by a test asserting the solution string is absent from serialised session state.

**Alternatives considered**: generating from scratch with a backtracking generator — rejected,
constitution mandates `sudoku-gen`. Trusting the library's difficulty label — rejected, violates
Principle IV.

---

## R5. Where generation runs

**Decision**: puzzle generation, uniqueness verification, and difficulty rating run in a **Web Worker**.
The UI requests a puzzle and renders a skeleton board until it arrives.

**Rationale**: Principle IV allows 500 ms for generation but forbids blocking the main thread beyond one
16 ms frame. Draw-verify-rate-retry can plausibly run into the hundreds of milliseconds; on the main
thread that is a visible freeze and a direct violation.

**Fallback**: if Workers are unavailable, generation runs on the main thread in time-sliced chunks that
yield between attempts. Correctness is identical; only smoothness differs.

---

## R6. State management

**Decision**: a **framework-agnostic TypeScript store module** — plain object, explicit named actions,
subscribe/notify — bound into React through `useSyncExternalStore`. No state library.

**Rationale**: This is the single most consequential structural decision in the feature, and it is
driven by feature 002. Constitution Principle I requires WebMCP tool registration to be *isolated from
UI rendering* and *executable headlessly with no DOM mounted*. If game state lives in React context or
a hook, agent tools can only reach it from inside the component tree — which is exactly the pattern the
constitution forbids and the reason `webmcp-react` was rejected. A framework-agnostic store lets both
the React view and the (future) tool layer call the same actions, satisfying 001/FR-020's "identical
results" rule and 002/FR-042's "indistinguishable from a learner's own" undo rule for free.

**Alternatives considered**: `useReducer` + Context — rejected, unreachable headlessly, and would force
a rewrite at feature 002. Zustand/Jotai — rejected as an unjustified dependency; the store is roughly
150 lines and adding a library buys nothing the constitution does not already require us to hand-build.

---

## R7. Testing stack

**Decision**:

| Layer | Tool | What it proves |
|---|---|---|
| Engine, State, palette | Vitest | Purity, invariants, contrast, determinism |
| Engine invariants | Vitest + fast-check | Uniqueness and solver correctness over generated input |
| Components | Vitest + React Testing Library | Rendering and keyboard behaviour |
| End-to-end, a11y, perf | Playwright + `@axe-core/playwright` | Real browser, real budgets, real screen-reader semantics |

**Rationale**: Principle V demands every module be testable without a browser (Vitest covers Engine and
State with zero DOM) while the accessibility and performance budgets in Principles IV and V are only
meaningfully verifiable in a real browser (Playwright). `fast-check` earns its place because Principle V
explicitly requires *property-based* tests for uniqueness and seed determinism.

---

## R8. Bundle budget — deferred by author decision

**Decision**: the 250 KB gzipped first-load budget is **not enforced**. Deferred on 2026-08-29 at the
author's direction, scoped to bundle size only; all timing budgets continue to gate. CI reports the
number as informational output so the trend stays visible. Recorded as a deviation in plan.md §
Complexity Tracking, per the constitution's rule that deliberate deviations be documented rather than
silently dropped.

**Finding**: Next.js 16 + React 19 baseline first-load JS is roughly 100–130 KB gzipped before a single
line of feature code. That leaves ~120–150 KB for the Engine, store, UI, and `sudoku-gen`. The Engine is
pure computation with no dependencies, Tailwind ships only used utilities, and Lucide icons are imported
individually — so the budget is achievable, but it is no longer comfortable.

**Mitigation if breached**: the worker chunk loads separately and does not count against first load;
Lucide can be replaced with inline SVG paths (~2 KB) if needed. Both are noted, neither is pre-emptively
applied.

**Obligation on reinstatement**: governance requires budget re-validation whenever a runtime dependency
is added or the build target changes. The deferral should be revisited at the first such change rather
than left open indefinitely.

---

## R9. Vertical slicing strategy

**Decision**: eight slices, each ending in a **reviewable, deployable website state** with a stated
demo script. No slice is "add the data layer"; every slice changes what a person sees in a browser.

**Rationale**: Direct requirement from the author — "a tangible feature is developed in each step. I
want to review and test the state of the website after each task is completed." This also happens to
match the spec's own priority ordering (P1–P6), which was written so each story is independently
shippable.

**Accessibility is not the last slice.** Each slice carries its own keyboard, screen-reader, contrast,
and reduced-motion obligations, because the constitution states accessibility is "a gate, not a
follow-up task". The final slice is an *audit and budget verification* slice — it confirms and measures
what earlier slices already built, and is allowed to find nothing.

See `plan.md` § Vertical Slice Plan for the slice definitions and their review checkpoints.
