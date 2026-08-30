# CLAUDE.md

Guidance for AI assistants working in this repository.

**This file is subordinate to [`.specify/memory/constitution.md`](.specify/memory/constitution.md).**
Where they disagree, the constitution wins. Read it before making structural decisions —
it is short, and several of its rules are non-obvious.

## What this is

A browser-based Sudoku board that a human and an AI agent solve together, the agent
participating through the [WebMCP](https://webmachinelearning.github.io/webmcp/)
standard. 100% client-side: no server, no database, no network request after load.

| Feature | State |
|---|---|
| [001 — Core play experience](specs/001-sudoku-play-experience/) | **Complete.** 124/124 tasks, 241 unit + 90 browser tests |
| [002 — WebMCP agent tutor](specs/002-webmcp-agent-tutor/) | **Complete.** 132/132 tasks, 851 unit + 204 browser tests, 11 tools |

## Commands

```bash
npm test          # Vitest: unit, property, component
npm run test:e2e  # Playwright end-to-end
npm run test:a11y # axe, keyboard-only, greyscale
npm run test:perf # budgets
npm run lint      # includes layer-boundary enforcement
npm run typecheck
```

**Verify builds the way they ship.** `npm run dev` cannot prove there is no server
runtime — the dev server *is* a server:

```bash
npm run build && npm start
```

## Layers — enforced by lint, not by review

```
engine  ←  state  ←  ui          workers → engine only
              ↑
            tools                tools ↔ ui: FORBIDDEN, both directions
```

- `src/engine/` — pure, deterministic. **No DOM, React, storage, or timers.** Runs in bare Node.
- `src/state/` — single source of truth. **Imports no React.** Every mutation goes through a named action in `actions.ts`; there is no other write path.
- `src/ui/` — React client components. Renders state, dispatches actions. No game rules, no gameplay state of its own.
- `src/tools/` — the WebMCP adapter. Thin handlers over State actions; **no game rules**, and **no
  `document` outside `registry.ts`** (both asserted by `tests/unit/tools.layering.test.ts`).
- `app/` — Next.js shell and design tokens only. Never put logic here. The one exception is
  `<AgentBootstrap />`: a server component's imports never reach the browser, and a static export has
  no server runtime, so registration has to be pulled in by a client module.

`eslint-plugin-import` will fail the build on a wrong-direction import. That rule has
already caught one real violation (Engine importing types from State); trust it.

## Constraints that will bite you

These are easy to violate by accident and each has tests guarding it.

- **The palette lives only in `app/globals.css`.** Raw hex or arbitrary-value colour
  utilities in a component are a lint error. `tests/unit/palette.contrast.test.ts`
  parses that block, so changing a token can fail the suite on contrast grounds.
- **A puzzle's solution must never leave `src/engine/`.** Not into store state, not
  into persisted data, not into any future agent tool result. Three tests assert this.
- **Difficulty is derived, never trusted.** It comes from which techniques a puzzle
  actually requires — re-derived even when restoring from storage. `sudoku-gen`'s own
  label is only a hint about which band to draw from.
- **Every puzzle is verified unique by our own solver**, whatever the generator claims,
  including puzzles restored from storage.
- **Stored data is untrusted input.** Validate every field on read; discard rather than
  partially apply.
- **Tests come first.** Principle V is NON-NEGOTIABLE and requires the failing test to
  arrive before or with the code, visible in commit history.
- **`origin` is a parameter on every mutating action** (`'clue' | 'player' | 'agent'`).
  Do not hardcode `'player'` — feature 002 reuses these actions unchanged, and that is
  what makes "an agent's move undoes exactly like a human's" true by construction.
- **Agent writes are coordinate-addressed** (`enterDigitAt`, not `enterDigit`). An agent must never
  move the learner's selection; the selection-based forms delegate to the coordinate ones so both
  actors run one implementation.
- **Every write tool goes through `defineWriteTool`.** It injects `explanation` into the schema and
  validates it before the handler runs, so "nothing changes silently" is structural rather than
  nine implementations being careful.
- **Nothing in `src/tools/` may import `@/engine/solver`** — it exports `solve()`, which returns a
  completed grid. Ask `@/engine/uniqueness` instead; it answers with a boolean.

## Why State is framework-agnostic

The most consequential decision in the codebase. Constitution Principle I requires the
WebMCP tool surface to be registered **outside the component tree** and enumerable with
**no DOM mounted**. State reachable only through a React hook makes that impossible —
which is also why the `webmcp-react` wrapper was evaluated and rejected.

So the store is a plain TypeScript module bound into React through
`useSyncExternalStore`. `tests/unit/store.headless.test.ts` plays a full puzzle to
completion in a `node` environment with no DOM. **If that test ever needs a browser,
feature 002 is no longer buildable.**

## Spec Kit workflow

Features proceed `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement`. Artifacts live in `specs/<NNN-name>/`.

**Gotcha:** `.specify/feature.json` names the feature those commands target, and it is
gitignored — machine-local, absent in a fresh clone. `setup-plan.sh` overwrites
`plan.md` unconditionally, so pointing it at an already-planned feature destroys that
plan. Check it before running `/speckit-plan`:

```bash
cat .specify/feature.json
```

It currently points at `specs/002-webmcp-agent-tutor`.

## Delivery style

Work proceeds in **vertical slices**, each ending in a deployable site that can be
opened and reviewed — not "add the data layer" but "the board now does X". Each slice's
demo script is in [quickstart.md](specs/001-sudoku-play-experience/quickstart.md), and
each checkpoint in [tasks.md](specs/001-sudoku-play-experience/tasks.md) records what
was found along the way.

**Look at the page, don't just run the tests.** Two purely visual defects have shipped
past a fully green suite in this project: an invisible grid (all 81 cells in the DOM,
zero borders rendered) and a board shrink-wrapped to half size. Counting elements
proves nothing about whether anything is drawn.

## Open items

- **SC-009's offline-*reload* clause is unmet.** Generation, play, and saving work
  offline; reloading needs a service worker, which no requirement calls for. Documented
  in `tests/integration/offline.spec.ts`. Needs a scope decision.
- **The 250 KB bundle budget is deferred** by author decision, recorded in
  [plan.md § Complexity Tracking](specs/001-sudoku-play-experience/plan.md). CI reports
  the number (currently ~189 KB gzipped) but nothing gates on it.
- **Drills exist for three of five techniques.** `naked-single` and `x-wing` have none: measured
  against `requiresTechnique`, no qualifying puzzle appeared in hundreds of thousands of candidates.
  FR-054 handles it by design, but **the spec's own worked example is an X-Wing drill**, so this
  wants a scope decision — accept three, or add a harder technique module so X-Wing-exact puzzles
  become findable.
- **SC-001 has not been verified against a live agent.** Nothing in this environment implements
  `document.modelContext`, so the surface has only ever been driven through a spec-conformant fake.
  Point a real agent at it before believing the "no site-specific instructions" claim.
